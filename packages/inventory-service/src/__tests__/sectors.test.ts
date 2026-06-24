/**
 * Inventory service — sectors listing.
 * GET /sectors must return only sectors with status = 'active'.
 */
import express from 'express';
import request from 'supertest';
import { makeToken } from '../../../shared/src/__tests__/testHelpers';

const db: { sectors: any[]; sectorBySlug: any | null } = { sectors: [], sectorBySlug: null };

jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    query: jest.fn(async (sql: string, params?: any[]) => {
      // The handler filters status = 'active' via the param; assert it's passed.
      if (/FROM sectors WHERE status/i.test(sql)) {
        expect(params?.[0]).toBe('active');
        return db.sectors;
      }
      return [];
    }),
    queryOne: jest.fn(async (sql: string) => {
      if (/FROM sectors WHERE slug/i.test(sql)) return db.sectorBySlug;
      return null;
    }),
  };
});

import { sectorsRouter } from '../routes/sectors';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/sectors', sectorsRouter);
  return app;
}
const app = buildApp();

beforeEach(() => {
  db.sectors = [];
  db.sectorBySlug = null;
});

describe('GET /sectors', () => {
  it('returns active sectors only (status filter applied at query layer)', async () => {
    db.sectors = [
      { id: 's1', name: 'Automobiles', slug: 'automobiles', status: 'active', commission_rate: 0.015 },
      { id: 's2', name: 'Clothing & Textiles', slug: 'clothing', status: 'active', commission_rate: 0.03 },
    ];
    const res = await request(app).get('/sectors');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((s: any) => s.status === 'active')).toBe(true);
  });

  it('returns an empty array when no active sectors exist', async () => {
    db.sectors = [];
    const res = await request(app).get('/sectors');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /sectors/:slug', () => {
  it('returns a sector by slug', async () => {
    db.sectorBySlug = { id: 's1', name: 'FMCG & Food', slug: 'fmcg', status: 'active' };
    const res = await request(app).get('/sectors/fmcg');
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('fmcg');
  });

  it('returns 404 for an unknown slug', async () => {
    db.sectorBySlug = null;
    const res = await request(app).get('/sectors/nope');
    expect(res.status).toBe(404);
  });
});

describe('POST /sectors (admin only)', () => {
  it('rejects a non-admin user with 403', async () => {
    const res = await request(app)
      .post('/sectors')
      .set('Authorization', `Bearer ${makeToken({ role: 'seller' })}`)
      .send({ name: 'New', slug: 'new' });
    expect(res.status).toBe(403);
  });

  it('allows an admin to create a sector (201)', async () => {
    const res = await request(app)
      .post('/sectors')
      .set('Authorization', `Bearer ${makeToken({ role: 'admin' })}`)
      .send({ name: 'New Sector', slug: 'new-sector' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });
});
