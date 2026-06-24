/**
 * Order service — place order, stock guard, GST/freight, listing buyer/seller views,
 * confirm-delivery. Shared DB + stock helpers are mocked; axios (Delhivery freight,
 * Razorpay pre-create, notifications) is mocked so no network calls occur.
 * calculatePayout / computeGST / generateOrderNumber run for real.
 */
import express from 'express';
import request from 'supertest';
import { makeToken } from '../../../shared/src/__tests__/testHelpers';

const BUYER_PROFILE = 'buyer-profile-1';
const SELLER_PROFILE = 'seller-profile-1';

const db: {
  listing: any | null;
  sellerProfile: any | null;
  buyerOrders: any[];
  buyerCount: string;
  sellerOrders: any[];
  sellerCount: string;
  confirmOrder: any | null;
} = {
  listing: null,
  sellerProfile: { id: SELLER_PROFILE, user_id: 'seller-user', state: 'Maharashtra' },
  buyerOrders: [],
  buyerCount: '0',
  sellerOrders: [],
  sellerCount: '0',
  confirmOrder: null,
};

// axios is used for freight estimate, razorpay pre-create, and notifications.
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: [{ total_amount: 120 }] }),
    post: jest.fn().mockResolvedValue({ data: { data: { razorpayOrderId: 'rzp_test_1' } } }),
  },
}));

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    reserveStock: jest.fn().mockResolvedValue(true),
    releaseStockReservation: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(async (sql: string) => {
      if (/COUNT\(\*\) FROM orders WHERE buyer_id/i.test(sql)) return [{ count: db.buyerCount }];
      if (/COUNT\(\*\) FROM orders WHERE seller_id/i.test(sql)) return [{ count: db.sellerCount }];
      if (/o\.buyer_id = \$1/i.test(sql)) return db.buyerOrders;
      if (/o\.seller_id = \$1/i.test(sql)) return db.sellerOrders;
      return [];
    }),
    queryOne: jest.fn(async (sql: string) => {
      if (/FROM listings l\s+JOIN sectors s/i.test(sql)) return db.listing;
      if (/FROM seller_profiles sp/i.test(sql)) return db.sellerProfile;
      if (/FROM addresses WHERE id/i.test(sql)) return { id: 'addr-1', state: 'Karnataka', pincode: '560001' };
      if (/SELECT id, buyer_id, seller_id, status, escrow_id FROM orders/i.test(sql)) return db.confirmOrder;
      return null;
    }),
    withTransaction: jest.fn(async (fn: any) =>
      fn({ query: jest.fn().mockResolvedValue({ rows: [] }) })
    ),
  };
});

import { ordersRouter } from '../routes/orders';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/orders', ordersRouter);
  return app;
}
const app = buildApp();

const buyerToken = makeToken({ role: 'buyer', profile_id: BUYER_PROFILE });
const sellerToken = makeToken({ role: 'seller', profile_id: SELLER_PROFILE });

const liveListing = {
  id: '33333333-3333-3333-3333-333333333333',
  seller_id: SELLER_PROFILE,
  title: 'FMCG Lot',
  status: 'live',
  available_quantity: 100,
  asking_price: 250,
  sector_slug: 'fmcg',
  state: 'Maharashtra',
  city: 'Mumbai',
};

beforeEach(() => {
  db.listing = null;
  db.buyerOrders = [];
  db.buyerCount = '0';
  db.sellerOrders = [];
  db.sellerCount = '0';
  db.confirmOrder = null;
});

describe('POST /orders', () => {
  it('places an order when listing is live and stock is available (201)', async () => {
    db.listing = { ...liveListing };
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ listing_id: liveListing.id, quantity: 10 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('order_number');
    // subtotal = 250 * 10 = 2500
    expect(res.body.data.subtotal).toBe(2500);
    expect(res.body.data.razorpay_order_id).toBe('rzp_test_1');
  });

  it('returns 404 when the listing is not live', async () => {
    db.listing = { ...liveListing, status: 'paused' };
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ listing_id: liveListing.id, quantity: 10 });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LISTING_UNAVAILABLE');
  });

  it('returns 400 INSUFFICIENT_STOCK when quantity exceeds available', async () => {
    db.listing = { ...liveListing, available_quantity: 5 };
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ listing_id: liveListing.id, quantity: 50 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects a non-buyer (seller) with 403', async () => {
    db.listing = { ...liveListing };
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ listing_id: liveListing.id, quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('validates the body (400 on non-positive quantity)', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ listing_id: liveListing.id, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /orders/my/buyer', () => {
  it("returns the buyer's own orders", async () => {
    db.buyerOrders = [{ id: 'o1', order_number: 'NM-AAA111', listing_title: 'FMCG Lot' }];
    db.buyerCount = '1';
    const res = await request(app)
      .get('/orders/my/buyer')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('rejects a seller (403)', async () => {
    const res = await request(app)
      .get('/orders/my/buyer')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /orders/my/seller', () => {
  it("returns the seller's own orders", async () => {
    db.sellerOrders = [{ id: 'o9', order_number: 'NM-BBB222' }];
    db.sellerCount = '1';
    const res = await request(app)
      .get('/orders/my/seller')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
  });
});

describe('PATCH /orders/:id/confirm-delivery', () => {
  it('confirms delivery for the owning buyer when order is shipped', async () => {
    db.confirmOrder = {
      id: 'o1',
      buyer_id: BUYER_PROFILE,
      seller_id: SELLER_PROFILE,
      status: 'shipped',
      escrow_id: 'esc-1',
    };
    const res = await request(app)
      .patch('/orders/o1/confirm-delivery')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('delivered');
  });

  it('rejects confirming a non-shippable status (400 INVALID_STATUS)', async () => {
    db.confirmOrder = {
      id: 'o1',
      buyer_id: BUYER_PROFILE,
      seller_id: SELLER_PROFILE,
      status: 'payment_pending',
      escrow_id: 'esc-1',
    };
    const res = await request(app)
      .patch('/orders/o1/confirm-delivery')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS');
  });

  it('blocks a buyer who does not own the order (403)', async () => {
    db.confirmOrder = {
      id: 'o1',
      buyer_id: 'another-buyer',
      seller_id: SELLER_PROFILE,
      status: 'shipped',
      escrow_id: 'esc-1',
    };
    const res = await request(app)
      .patch('/orders/o1/confirm-delivery')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown order', async () => {
    db.confirmOrder = null;
    const res = await request(app)
      .patch('/orders/ghost/confirm-delivery')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(404);
  });
});
