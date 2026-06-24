/**
 * Auth service — middleware behaviour as seen through a protected route.
 * Verifies the shared `authenticate` middleware (re-exported via @nirmalmandi/shared)
 * guards endpoints correctly: valid HS256 token, expired token, missing token,
 * wrong algorithm.
 */
import express from 'express';
import request from 'supertest';
import { authenticate } from '@nirmalmandi/shared';
import { makeToken, makeExpiredToken } from '../../../shared/src/__tests__/testHelpers';

function buildApp() {
  const app = express();
  app.use(express.json());
  // A minimal protected route that echoes the authenticated user.
  app.get('/protected', authenticate, (req: any, res) => {
    res.json({ success: true, user: req.user });
  });
  return app;
}

const app = buildApp();

describe('authenticate middleware (auth-service)', () => {
  it('allows access with a valid HS256 token', async () => {
    const token = makeToken({ role: 'seller', profile_id: 'sp-1' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('seller');
    expect(res.body.user.profile_id).toBe('sp-1');
  });

  it('rejects an expired token with 401 TOKEN_INVALID', async () => {
    const token = makeExpiredToken();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('rejects a missing Authorization header with 401 AUTH_REQUIRED', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = makeToken({ secret: 'attacker-secret' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an unsigned (alg=none) token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'x', role: 'admin' })).toString('base64url');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${header}.${body}.`);
    expect(res.status).toBe(401);
  });
});
