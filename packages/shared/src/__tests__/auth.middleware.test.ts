/**
 * Unit tests for the shared auth middleware:
 *   - authenticate (HS256 verify, missing header, expired, wrong algorithm)
 *   - requireRole (allow / deny / unauthenticated)
 *
 * No DB or network — pure middleware exercised with fake req/res/next.
 */
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../middleware/auth';
import { makeToken, makeExpiredToken, TEST_JWT_SECRET } from './testHelpers';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c: number) => { res.statusCode = c; return res; });
  res.json = jest.fn((b: unknown) => { res.body = b; return res; });
  return res;
}

describe('authenticate middleware', () => {
  it('accepts a valid HS256 Bearer token and populates req.user', () => {
    const token = makeToken({ role: 'seller', phone: '9811111111' });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('seller');
    expect(req.user.phone).toBe('9811111111');
  });

  it('rejects a request with no Authorization header → 401 AUTH_REQUIRED', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a header that is not "Bearer ..." → 401', () => {
    const req: any = { headers: { authorization: 'Token abc' } };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an expired token → 401 TOKEN_INVALID', () => {
    const token = makeExpiredToken();
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('rejects a token signed with the wrong secret → 401', () => {
    const token = makeToken({ secret: 'a-different-secret' });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with a non-HS256 algorithm (alg=none)', () => {
    // jsonwebtoken refuses to sign HS256-verified payload with alg "none" using a
    // secret, so we craft an unsecured token manually.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'x', role: 'admin' })).toString('base64url');
    const noneToken = `${header}.${body}.`;
    const req: any = { headers: { authorization: `Bearer ${noneToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('the signed token uses HS256 and carries the expected claims', () => {
    const token = makeToken({ role: 'admin' });
    const decoded = jwt.decode(token, { complete: true }) as any;
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload).toHaveProperty('sub');
    expect(decoded.payload).toHaveProperty('profile_id');
    // verifiable with the same secret
    expect(() => jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] })).not.toThrow();
  });
});

describe('requireRole middleware', () => {
  it('calls next when the user has an allowed role', () => {
    const req: any = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('admin', 'super_admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN when the role is not allowed', () => {
    const req: any = { user: { role: 'buyer' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('seller')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 401 when there is no authenticated user', () => {
    const req: any = {};
    const res = mockRes();
    const next = jest.fn();

    requireRole('seller')(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });
});
