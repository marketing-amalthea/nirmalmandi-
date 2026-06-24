/**
 * Analytics service — admin dashboard + GMV time-series.
 * Shared `query` is mocked to return deterministic aggregate rows; the route's
 * Promise.all fan-out and numeric coercion are exercised end-to-end.
 */
import express from 'express';
import request from 'supertest';

// Each call to query() returns the next queued result, in the order the route issues them.
const queryResults: any[][] = [];
jest.mock('@nirmalmandi/shared', () => {
  const actual = jest.requireActual('@nirmalmandi/shared');
  return {
    ...actual,
    query: jest.fn(async () => queryResults.shift() ?? []),
  };
});

import { adminStatsRouter } from '../routes/adminStats';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/stats', adminStatsRouter);
  return app;
}
const app = buildApp();

beforeEach(() => {
  queryResults.length = 0;
});

describe('GET /admin/stats/dashboard', () => {
  it('returns GMV, active listings, seller/buyer counts, commission, disputes', async () => {
    // Order matches Promise.all in the route: gmv, listings, sellers, buyers, commission, disputes
    queryResults.push(
      [{ total: '1250000.50' }], // gmv
      [{ total: '42' }],         // active listings
      [{ total: '15' }],         // sellers
      [{ total: '230' }],        // buyers
      [{ total: '3750.25' }],    // today's commission
      [{ total: '3' }]           // open disputes
    );

    const res = await request(app).get('/admin/stats/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d.totalGmv).toBe(1250000.5);
    expect(d.activeListings).toBe(42);
    expect(d.activeSellers).toBe(15);
    expect(d.activeBuyers).toBe(230);
    expect(d.todaysCommission).toBe(3750.25);
    expect(d.openDisputes).toBe(3);
  });

  it('coerces empty aggregates to 0', async () => {
    queryResults.push(
      [{ total: '0' }], [{ total: '0' }], [{ total: '0' }],
      [{ total: '0' }], [{ total: '0' }], [{ total: '0' }]
    );
    const res = await request(app).get('/admin/stats/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.totalGmv).toBe(0);
    expect(res.body.data.activeListings).toBe(0);
  });
});

describe('GET /admin/stats/gmv', () => {
  it('returns a GMV time series for the requested window', async () => {
    queryResults.push([
      { date: '2026-06-19', gmv: '10000' },
      { date: '2026-06-20', gmv: '0' },
      { date: '2026-06-21', gmv: '25000.5' },
    ]);

    const res = await request(app).get('/admin/stats/gmv?days=30');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0]).toEqual({ date: '2026-06-19', gmv: 10000 });
    expect(res.body.data[2].gmv).toBe(25000.5);
  });

  it('defaults to 30 days and returns an array', async () => {
    queryResults.push([{ date: '2026-06-21', gmv: '0' }]);
    const res = await request(app).get('/admin/stats/gmv');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
