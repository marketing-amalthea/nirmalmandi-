/**
 * Dispute service — raise, duplicate guard, admin resolve (refund-buyer triggers
 * escrow refund via payment-service; release-to-seller triggers force-release).
 *
 * AWS S3 SDK + presigner are mocked (module imported at top of route file).
 * axios (notifications + payment-service calls) is mocked. Shared DB mocked.
 */
import express from 'express';
import request from 'supertest';
import { makeToken } from '../../../shared/src/__tests__/testHelpers';

const BUYER_PROFILE = 'buyer-profile-1';
const SELLER_PROFILE = 'seller-profile-1';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/upload?sig=abc'),
}));

const axiosPost = jest.fn().mockResolvedValue({ data: {} });
jest.mock('axios', () => ({ __esModule: true, default: { post: (...a: any[]) => axiosPost(...a) } }));

const db: { order: any | null; existingDispute: any | null; resolveDispute: any | null } = {
  order: null,
  existingDispute: null,
  resolveDispute: null,
};

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    query: jest.fn(async (sql: string) => {
      if (/FROM users WHERE role = 'admin'/i.test(sql)) return [{ id: 'admin-1' }];
      return [];
    }),
    queryOne: jest.fn(async (sql: string) => {
      if (/FROM orders o\s+JOIN seller_profiles/i.test(sql)) return db.order;
      if (/SELECT id FROM disputes WHERE order_id/i.test(sql)) return db.existingDispute;
      if (/FROM disputes d\s+JOIN orders o/i.test(sql)) return db.resolveDispute;
      return null;
    }),
    withTransaction: jest.fn(async (fn: any) =>
      fn({ query: jest.fn().mockResolvedValue({ rows: [] }) })
    ),
  };
});

import { disputesRouter } from '../routes/disputes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/disputes', disputesRouter);
  return app;
}
const app = buildApp();

const buyerToken = makeToken({ role: 'buyer', profile_id: BUYER_PROFILE });
const adminToken = makeToken({ role: 'admin' });

const raiseBody = {
  orderId: '77777777-7777-7777-7777-777777777777',
  reason: 'damaged',
  description: 'The goods arrived crushed and unusable on delivery.',
};

beforeEach(() => {
  db.order = null;
  db.existingDispute = null;
  db.resolveDispute = null;
  axiosPost.mockClear();
});

describe('POST /disputes/raise', () => {
  it('lets the buyer raise a dispute on a delivered order (201)', async () => {
    db.order = {
      id: raiseBody.orderId,
      buyer_id: BUYER_PROFILE,
      seller_id: SELLER_PROFILE,
      status: 'delivered',
      order_number: 'NM-DDD444',
      seller_user_id: 'seller-user-1',
    };
    const res = await request(app)
      .post('/disputes/raise')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(raiseBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('disputeId');
    expect(res.body.data).toHaveProperty('slaDeadline');
  });

  it('rejects a duplicate open dispute with 409', async () => {
    db.order = {
      id: raiseBody.orderId,
      buyer_id: BUYER_PROFILE,
      seller_id: SELLER_PROFILE,
      status: 'delivered',
      order_number: 'NM-DDD444',
      seller_user_id: 'seller-user-1',
    };
    db.existingDispute = { id: 'existing-dispute' };
    const res = await request(app)
      .post('/disputes/raise')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(raiseBody);
    expect(res.status).toBe(409);
  });

  it('blocks a non-buyer-of-the-order from raising (403)', async () => {
    db.order = {
      id: raiseBody.orderId,
      buyer_id: 'another-buyer',
      seller_id: SELLER_PROFILE,
      status: 'delivered',
      order_number: 'NM-DDD444',
      seller_user_id: 'seller-user-1',
    };
    const res = await request(app)
      .post('/disputes/raise')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(raiseBody);
    expect(res.status).toBe(403);
  });

  it('rejects raising a dispute for an order in a non-disputable status (409)', async () => {
    db.order = {
      id: raiseBody.orderId,
      buyer_id: BUYER_PROFILE,
      seller_id: SELLER_PROFILE,
      status: 'payment_pending',
      order_number: 'NM-DDD444',
      seller_user_id: 'seller-user-1',
    };
    const res = await request(app)
      .post('/disputes/raise')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(raiseBody);
    expect(res.status).toBe(409);
  });

  it('rejects a too-short description (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .post('/disputes/raise')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ ...raiseBody, description: 'too short' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the order does not exist', async () => {
    db.order = null;
    const res = await request(app)
      .post('/disputes/raise')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(raiseBody);
    expect(res.status).toBe(404);
  });
});

describe('POST /disputes/:id/resolve (admin only)', () => {
  const openDispute = {
    id: 'dispute-1',
    order_id: 'order-1',
    buyer_id: BUYER_PROFILE,
    seller_id: SELLER_PROFILE,
    status: 'open',
    order_number: 'NM-EEE555',
    buyer_user_id: 'buyer-user-1',
    seller_user_id: 'seller-user-1',
  };

  it('rejects a non-admin (403)', async () => {
    const res = await request(app)
      .post('/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ outcome: 'refund_buyer', resolution: 'Buyer provided clear damage evidence.' });
    expect(res.status).toBe(403);
  });

  it('resolves in the buyer favour → calls payment-service refund endpoint', async () => {
    db.resolveDispute = { ...openDispute };
    const res = await request(app)
      .post('/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'refund_buyer', resolution: 'Buyer provided clear damage evidence here.' });

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('refund_buyer');
    const refundCalled = axiosPost.mock.calls.some(([url]) =>
      String(url).includes('/payments/admin/refund')
    );
    expect(refundCalled).toBe(true);
  });

  it('resolves in the seller favour → calls payment-service force-release', async () => {
    db.resolveDispute = { ...openDispute };
    const res = await request(app)
      .post('/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'release_to_seller', resolution: 'Seller proof of delivery is conclusive.' });

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('release_to_seller');
    const releaseCalled = axiosPost.mock.calls.some(([url]) =>
      String(url).includes('/payments/admin/force-release')
    );
    expect(releaseCalled).toBe(true);
  });

  it('returns 409 when the dispute is already resolved', async () => {
    db.resolveDispute = { ...openDispute, status: 'resolved' };
    const res = await request(app)
      .post('/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'refund_buyer', resolution: 'Trying to re-resolve a closed dispute now.' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when the dispute does not exist', async () => {
    db.resolveDispute = null;
    const res = await request(app)
      .post('/disputes/ghost/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'refund_buyer', resolution: 'Resolving a dispute that is not present.' });
    expect(res.status).toBe(404);
  });
});
