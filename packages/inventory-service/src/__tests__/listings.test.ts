/**
 * Inventory service — listings CRUD + browse.
 * Shared DB / stock / view-count helpers are mocked. The Elasticsearch sync
 * module is mocked so no ES client is constructed. computeUrgencyScore runs real.
 */
import express from 'express';
import request from 'supertest';
import { makeToken } from '../../../shared/src/__tests__/testHelpers';

const SELLER_PROFILE = 'seller-profile-1';

// ── Programmable DB state ──────────────────────────────────────────────────────
const db: {
  browseRows: any[];
  browseCount: string;
  listingById: any | null;
  patchExisting: { seller_id: string; status: string } | null;
} = {
  browseRows: [],
  browseCount: '0',
  listingById: null,
  patchExisting: null,
};

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    rateLimiter: () => (_req: any, _res: any, next: any) => next(),
    reserveStock: jest.fn().mockResolvedValue(true),
    releaseStockReservation: jest.fn().mockResolvedValue(undefined),
    bufferViewCount: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(async (sql: string) => {
      if (/SELECT COUNT\(\*\) as count FROM listings/i.test(sql)) {
        return [{ count: db.browseCount }];
      }
      if (/FROM listings l/i.test(sql)) return db.browseRows;
      if (/UPDATE listings/i.test(sql)) return [];
      return [];
    }),
    queryOne: jest.fn(async (sql: string) => {
      if (/SELECT seller_id, status FROM listings/i.test(sql)) return db.patchExisting;
      if (/SELECT \* FROM listings WHERE id/i.test(sql)) return db.listingById;
      if (/FROM listings l/i.test(sql)) return db.listingById;
      return null;
    }),
    withTransaction: jest.fn(async (fn: any) =>
      fn({
        query: jest.fn(async (sql: string) => {
          if (/SELECT \* FROM listings WHERE id/i.test(sql)) return { rows: [db.listingById] };
          return { rows: [] };
        }),
      })
    ),
  };
});

// Mock the local ES sync module to avoid pulling @elastic/elasticsearch.
jest.mock('../services/elasticsearch', () => ({
  syncListingToElasticsearch: jest.fn().mockResolvedValue(undefined),
  deleteListingFromEs: jest.fn().mockResolvedValue(undefined),
}));

import { listingsRouter } from '../routes/listings';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/listings', listingsRouter);
  return app;
}
const app = buildApp();

const sellerToken = makeToken({ role: 'seller', profile_id: SELLER_PROFILE });
const buyerToken = makeToken({ role: 'buyer' });

const validCreateBody = {
  sector_id: '22222222-2222-2222-2222-222222222222',
  title: 'Surplus FMCG Lot 500 units',
  description: 'Grade A excess stock',
  dead_stock_type: 'excess',
  condition_grade: 'A',
  lot_type: 'full_lot',
  total_quantity: 500,
  moq: 10,
  unit: 'pcs',
  price_type: 'fixed',
  asking_price: 250,
  state: 'Maharashtra',
  city: 'Mumbai',
  images: ['https://cdn.example.com/a.jpg'],
};

beforeEach(() => {
  db.browseRows = [];
  db.browseCount = '0';
  db.listingById = null;
  db.patchExisting = null;
});

describe('POST /listings', () => {
  it('creates a listing for an authenticated seller (201)', async () => {
    db.listingById = { id: 'new-listing-1', ...validCreateBody, status: 'live' };
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCreateBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('new-listing-1');
  });

  it('rejects creation by a buyer with 403', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(validCreateBody);
    expect(res.status).toBe(403);
  });

  it('rejects creation with no token (401)', async () => {
    const res = await request(app).post('/listings').send(validCreateBody);
    expect(res.status).toBe(401);
  });

  it('rejects invalid payload (missing title) with 400 VALIDATION_ERROR', async () => {
    const { title, ...bad } = validCreateBody;
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(bad);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /listings (browse)', () => {
  it('returns paginated rows with total', async () => {
    db.browseRows = [
      { id: 'l1', title: 'Lot 1', asking_price: 100 },
      { id: 'l2', title: 'Lot 2', asking_price: 200 },
    ];
    db.browseCount = '2';
    const res = await request(app).get('/listings?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.page).toBe(1);
  });

  it('accepts sector / price / sort filters without error', async () => {
    db.browseRows = [{ id: 'l1', title: 'Cheap', asking_price: 50 }];
    db.browseCount = '1';
    const res = await request(app).get(
      '/listings?sector=fmcg&min_price=10&max_price=100&sort_by=price_asc'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.rows[0].id).toBe('l1');
  });
});

describe('GET /listings/:id', () => {
  it('returns a single live listing', async () => {
    db.listingById = {
      id: 'l1',
      seller_id: SELLER_PROFILE,
      title: 'Lot 1',
      status: 'live',
      cost_price_enc: 'SECRET',
    };
    const res = await request(app).get('/listings/l1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('l1');
  });

  it('hides cost_price_enc from non-owner viewers', async () => {
    db.listingById = {
      id: 'l1',
      seller_id: 'someone-else',
      title: 'Lot 1',
      status: 'live',
      cost_price_enc: 'SECRET',
    };
    const res = await request(app).get('/listings/l1');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('cost_price_enc');
  });

  it('returns 404 for an unknown / non-live listing', async () => {
    db.listingById = null;
    const res = await request(app).get('/listings/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /listings/:id', () => {
  it('lets a seller edit their own listing', async () => {
    db.patchExisting = { seller_id: SELLER_PROFILE, status: 'live' };
    db.listingById = { id: 'l1', title: 'Updated Title', status: 'live' };
    const res = await request(app)
      .patch('/listings/l1')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it("blocks a seller from editing another seller's listing (403)", async () => {
    db.patchExisting = { seller_id: 'other-seller', status: 'live' };
    const res = await request(app)
      .patch('/listings/l1')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'Hijack' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when the listing does not exist', async () => {
    db.patchExisting = null;
    const res = await request(app)
      .patch('/listings/ghost')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /listings/:id', () => {
  it('soft-deletes (delists) a listing for the seller', async () => {
    const res = await request(app)
      .delete('/listings/l1')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/delisted/i);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).delete('/listings/l1');
    expect(res.status).toBe(401);
  });
});
