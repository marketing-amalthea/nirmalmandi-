/**
 * Inventory service — seller-scoped routes (mounted at /seller).
 * GET /seller/listings returns only the authenticated seller's own listings
 * (the SQL scopes by seller_profiles.user_id = req.user.sub). We assert the
 * query is parameterised with the seller's user id and that auth is enforced.
 */
import express from 'express';
import request from 'supertest';
import { makeToken } from '../../../shared/src/__tests__/testHelpers';

const SELLER_USER_ID = 'seller-user-1';

const db: { rows: any[]; count: string; lastParams: any[] | undefined } = {
  rows: [],
  count: '0',
  lastParams: undefined,
};

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    query: jest.fn(async (sql: string, params?: any[]) => {
      db.lastParams = params;
      if (/SELECT COUNT\(\*\) as count FROM listings/i.test(sql)) {
        return [{ count: db.count }];
      }
      if (/FROM listings l/i.test(sql)) return db.rows;
      return [];
    }),
    queryOne: jest.fn(async () => null),
  };
});

import { sellerRouter } from '../routes/seller';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/seller', sellerRouter);
  return app;
}
const app = buildApp();

beforeEach(() => {
  db.rows = [];
  db.count = '0';
  db.lastParams = undefined;
});

describe('GET /seller/listings', () => {
  it("returns only the seller's own listings, scoped by their user id", async () => {
    db.rows = [
      { id: 'l1', title: 'My Lot 1', status: 'live' },
      { id: 'l2', title: 'My Lot 2', status: 'paused' },
    ];
    db.count = '2';
    const token = makeToken({ role: 'seller', sub: SELLER_USER_ID });

    const res = await request(app).get('/seller/listings').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    // The seller's user id must be the first bound parameter (ownership scope).
    expect(db.lastParams?.[0]).toBe(SELLER_USER_ID);
  });

  it('supports a status filter', async () => {
    db.rows = [{ id: 'l1', title: 'Paused Lot', status: 'paused' }];
    db.count = '1';
    const token = makeToken({ role: 'seller', sub: SELLER_USER_ID });
    const res = await request(app)
      .get('/seller/listings?status=paused')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(db.lastParams).toContain('paused');
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await request(app).get('/seller/listings');
    expect(res.status).toBe(401);
  });

  it('rejects a buyer (403 — seller/admin only)', async () => {
    const res = await request(app)
      .get('/seller/listings')
      .set('Authorization', `Bearer ${makeToken({ role: 'buyer' })}`);
    expect(res.status).toBe(403);
  });
});
