/**
 * Auth service — email + password register / login.
 * The shared DB helpers and session store are mocked; bcrypt runs for real so
 * password hashing / comparison is genuinely exercised. No live DB or network.
 */
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ── Programmable DB mock state ─────────────────────────────────────────────────
const db = {
  existingEmail: null as string | null,
  loginUser: null as
    | { id: string; role: string; name: string; password_hash: string | null }
    | null,
};

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    setSession: jest.fn().mockResolvedValue(undefined),
    setOtp: jest.fn().mockResolvedValue(undefined),
    verifyAndDeleteOtp: jest.fn().mockResolvedValue(true),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    otpRateLimiter: () => (_req: any, _res: any, next: any) => next(),
    rateLimiter: () => (_req: any, _res: any, next: any) => next(),
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn(async (sql: string) => {
      if (/SELECT id FROM users WHERE email/i.test(sql)) {
        return db.existingEmail ? { id: 'existing-user-id' } : null;
      }
      if (/SELECT id, role, name, password_hash FROM users WHERE email/i.test(sql)) {
        return db.loginUser;
      }
      if (/INSERT INTO users/i.test(sql)) return { id: '11111111-1111-1111-1111-111111111111' };
      if (/INSERT INTO buyer_profiles/i.test(sql)) return { id: 'buyer-profile-id' };
      if (/INSERT INTO seller_profiles/i.test(sql)) return { id: 'seller-profile-id' };
      if (/FROM buyer_profiles WHERE user_id/i.test(sql)) return { id: 'buyer-profile-id' };
      return null;
    }),
    withTransaction: jest.fn(async (fn: any) =>
      fn({ query: jest.fn().mockResolvedValue({ rows: [{ id: 'x' }] }) })
    ),
  };
});

// Mock external service calls used in other routes (not under test but imported).
jest.mock('../services/otp', () => ({
  sendOtp: jest.fn().mockResolvedValue(undefined),
  sendEmailOtp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/gstn', () => ({ validateGstin: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/kyc', () => ({
  verifyBankAccount: jest.fn().mockResolvedValue({ valid: true, name_match_score: 0.99 }),
}));

import { authRouter } from '../routes/auth';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  return app;
}

const app = buildApp();

beforeEach(() => {
  db.existingEmail = null;
  db.loginUser = null;
});

describe('POST /auth/email/register', () => {
  it('registers a new buyer and returns tokens (201)', async () => {
    const res = await request(app)
      .post('/auth/email/register')
      .send({ email: 'New.User@Example.com', password: 'secret123', name: 'New User', role: 'buyer' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('access_token');
    expect(res.body.data).toHaveProperty('refresh_token');
    expect(res.body.data.user.role).toBe('buyer');
    // email is lowercased
    expect(res.body.data.user.email).toBe('new.user@example.com');
  });

  it('registers a seller and creates a seller profile', async () => {
    const res = await request(app)
      .post('/auth/email/register')
      .send({ email: 'seller@example.com', password: 'secret123', name: 'Shop', role: 'seller' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('seller');
  });

  it('rejects a duplicate email with 409 EMAIL_EXISTS', async () => {
    db.existingEmail = 'dup@example.com';
    const res = await request(app)
      .post('/auth/email/register')
      .send({ email: 'dup@example.com', password: 'secret123', name: 'Dup' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('rejects a weak (<6 char) password with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/auth/email/register')
      .send({ email: 'weak@example.com', password: '123', name: 'Weak' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid email format with 400', async () => {
    const res = await request(app)
      .post('/auth/email/register')
      .send({ email: 'not-an-email', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('issues a verifiable HS256 access token with the right claims', async () => {
    const res = await request(app)
      .post('/auth/email/register')
      .send({ email: 'claims@example.com', password: 'secret123', name: 'Claims', role: 'buyer' });

    const token = res.body.data.access_token;
    const decoded = jwt.decode(token, { complete: true }) as any;
    expect(decoded.header.alg).toBe('HS256');
    const verified = jwt.verify(token, 'nm-jwt-secret-2026') as any;
    expect(verified.role).toBe('buyer');
    expect(verified).toHaveProperty('sub');
    expect(verified).toHaveProperty('profile_id');
  });
});

describe('POST /auth/email/login', () => {
  it('logs in with correct credentials and returns tokens', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    db.loginUser = { id: 'user-1', role: 'seller', name: 'Seller One', password_hash: hash };

    const res = await request(app)
      .post('/auth/email/login')
      .send({ email: 'seller@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('access_token');
    expect(res.body.data.user.role).toBe('seller');
  });

  it('rejects a wrong password with 401 AUTH_FAILED', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    db.loginUser = { id: 'user-1', role: 'buyer', name: 'B', password_hash: hash };

    const res = await request(app)
      .post('/auth/email/login')
      .send({ email: 'buyer@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_FAILED');
  });

  it('rejects a nonexistent user with 401 AUTH_FAILED', async () => {
    db.loginUser = null;
    const res = await request(app)
      .post('/auth/email/login')
      .send({ email: 'ghost@example.com', password: 'whatever1' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_FAILED');
  });

  it('rejects a user with no password hash (OTP-only account) with 401', async () => {
    db.loginUser = { id: 'user-1', role: 'buyer', name: 'B', password_hash: null };
    const res = await request(app)
      .post('/auth/email/login')
      .send({ email: 'otponly@example.com', password: 'whatever1' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing password with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/auth/email/login')
      .send({ email: 'x@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
