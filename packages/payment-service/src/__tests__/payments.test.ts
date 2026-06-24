/**
 * Payment service — initiate Razorpay order + webhook signature verification.
 *
 * The `razorpay` npm package is mocked at the module boundary so the real
 * `services/razorpay.ts` loads (giving us the genuine HMAC `verifyWebhookSignature`)
 * without needing live Razorpay credentials. Network transfer/refund calls are
 * stubbed on the mocked Razorpay instance. Shared DB helpers are mocked.
 */
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { makeToken } from '../../../shared/src/__tests__/testHelpers';

const BUYER_PROFILE = 'buyer-profile-1';
const WEBHOOK_SECRET = 'whsec_test';

// Mock the razorpay SDK so services/razorpay.ts can construct an instance.
const rzpOrdersCreate = jest.fn().mockResolvedValue({ id: 'order_rzp_123', amount: 560000 });
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: { create: rzpOrdersCreate },
    payments: { transfer: jest.fn(), refund: jest.fn() },
  }));
});

// axios used by the notify() helper.
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: {} }) },
}));

const db: { order: any | null; webhookOrder: any | null } = { order: null, webhookOrder: null };

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    query: jest.fn(async (sql: string) => {
      if (/UPDATE orders/i.test(sql)) return [];
      return [];
    }),
    queryOne: jest.fn(async (sql: string) => {
      if (/SELECT id, buyer_id, status FROM orders/i.test(sql)) return db.order;
      if (/FROM orders o\s+JOIN listings/i.test(sql)) return db.webhookOrder;
      if (/SELECT seller_id, order_number FROM orders/i.test(sql)) return db.webhookOrder;
      return null;
    }),
    withTransaction: jest.fn(async (fn: any) =>
      fn({ query: jest.fn().mockResolvedValue({ rows: [{ id: 'escrow-new' }] }) })
    ),
  };
});

import { paymentsRouter } from '../routes/payments';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/payments', paymentsRouter);
  return app;
}
const app = buildApp();

const buyerToken = makeToken({ role: 'buyer', profile_id: BUYER_PROFILE });

beforeEach(() => {
  db.order = null;
  db.webhookOrder = null;
  rzpOrdersCreate.mockClear();
});

const initiateBody = {
  orderId: '44444444-4444-4444-4444-444444444444',
  amountPaisa: 560000,
  listingId: '55555555-5555-5555-5555-555555555555',
  sellerId: '66666666-6666-6666-6666-666666666666',
};

describe('POST /payments/initiate', () => {
  it('creates a Razorpay order for a valid order awaiting payment', async () => {
    db.order = { id: initiateBody.orderId, buyer_id: BUYER_PROFILE, status: 'pending_payment' };
    const res = await request(app)
      .post('/payments/initiate')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(initiateBody);

    expect(res.status).toBe(200);
    expect(res.body.data.razorpayOrderId).toBe('order_rzp_123');
    expect(rzpOrdersCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the order does not exist', async () => {
    db.order = null;
    const res = await request(app)
      .post('/payments/initiate')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(initiateBody);
    expect(res.status).toBe(404);
  });

  it('returns 403 when the order belongs to another buyer', async () => {
    db.order = { id: initiateBody.orderId, buyer_id: 'someone-else', status: 'pending_payment' };
    const res = await request(app)
      .post('/payments/initiate')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(initiateBody);
    expect(res.status).toBe(403);
  });

  it('returns 409 when the order is not awaiting payment', async () => {
    db.order = { id: initiateBody.orderId, buyer_id: BUYER_PROFILE, status: 'paid' };
    const res = await request(app)
      .post('/payments/initiate')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(initiateBody);
    expect(res.status).toBe(409);
  });

  it('rejects a malformed payload (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .post('/payments/initiate')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});

describe('POST /payments/webhook — HMAC signature verification', () => {
  function sign(body: object): string {
    return crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  it('processes a payment.captured event with a valid signature', async () => {
    db.webhookOrder = {
      id: 'order-1',
      buyer_id: BUYER_PROFILE,
      seller_id: 'seller-1',
      total_amount: 5600,
      razorpay_order_id: 'order_rzp_123',
      sector_slug: 'fmcg',
      buyer_state: 'MH',
      seller_state: 'MH',
      order_number: 'NM-CCC333',
    };
    const event = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_rzp_123' } } },
    };
    const res = await request(app)
      .post('/payments/webhook')
      .set('x-razorpay-signature', sign(event))
      .send(event);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('rejects a webhook with an invalid signature (400)', async () => {
    const event = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_rzp_123' } } },
    };
    // Provide a wrong-but-equal-length hex signature so timingSafeEqual compares cleanly.
    const badSig = crypto
      .createHmac('sha256', 'wrong-secret')
      .update(JSON.stringify(event))
      .digest('hex');

    const res = await request(app)
      .post('/payments/webhook')
      .set('x-razorpay-signature', badSig)
      .send(event);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });
});
