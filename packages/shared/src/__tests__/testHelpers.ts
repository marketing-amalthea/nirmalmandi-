/**
 * Shared test helpers — JWT generation, mock user/entity factories, and a
 * lightweight in-memory mock for the `query` / `queryOne` / `withTransaction`
 * DB helpers exported by `@nirmalmandi/shared`.
 *
 * These helpers let every service test run WITHOUT a live Neon/Postgres
 * connection. Each service test file installs the DB mock via `jest.mock`
 * and drives responses through `mockDb` (see usage in service __tests__).
 */
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// The middleware/auth + auth-service sign tokens with this exact secret.
export const TEST_JWT_SECRET =
  (process.env.INTERNAL_SERVICE_SECRET || 'nm-jwt-secret-2026').replace(/['"]/g, '');

export interface TestUserOptions {
  sub?: string;
  phone?: string;
  role?: 'buyer' | 'seller' | 'admin' | 'super_admin';
  profile_id?: string;
  expiresIn?: string | number;
  /** override the algorithm — used to test rejection of wrong-alg tokens */
  algorithm?: jwt.Algorithm;
  secret?: string;
}

/** Build a valid HS256 JWT matching the platform's JwtPayload shape. */
export function makeToken(opts: TestUserOptions = {}): string {
  const payload = {
    sub: opts.sub ?? uuidv4(),
    phone: opts.phone ?? '9900000001',
    role: opts.role ?? 'buyer',
    profile_id: opts.profile_id ?? uuidv4(),
  };
  return jwt.sign(payload, opts.secret ?? TEST_JWT_SECRET, {
    algorithm: opts.algorithm ?? 'HS256',
    expiresIn: opts.expiresIn ?? '1h',
  });
}

/** An already-expired token (exp in the past). */
export function makeExpiredToken(opts: TestUserOptions = {}): string {
  const payload = {
    sub: opts.sub ?? uuidv4(),
    phone: opts.phone ?? '9900000001',
    role: opts.role ?? 'buyer',
    profile_id: opts.profile_id ?? uuidv4(),
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };
  return jwt.sign(payload, opts.secret ?? TEST_JWT_SECRET, { algorithm: 'HS256' });
}

export function authHeader(opts: TestUserOptions = {}): { Authorization: string } {
  return { Authorization: `Bearer ${makeToken(opts)}` };
}

// ── Mock user / entity factories ───────────────────────────────────────────────
export function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: uuidv4(),
    phone: '9900000001',
    email: 'buyer@example.com',
    name: 'Test Buyer',
    role: 'buyer',
    status: 'active',
    referral_code: 'TEST1234',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function mockSellerProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: uuidv4(),
    user_id: uuidv4(),
    business_name: 'Test Traders',
    business_type: 'wholesaler',
    gst_number: '27AAPFU0939F1ZV',
    verification_tier: 'basic',
    kyc_status: 'approved',
    ...overrides,
  };
}

export function mockBuyerProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: uuidv4(),
    user_id: uuidv4(),
    business_name: 'Buyer Corp',
    verification_tier: 'tier1',
    ai_credits_balance: 50,
    ...overrides,
  };
}

export function mockListing(overrides: Record<string, unknown> = {}) {
  return {
    id: uuidv4(),
    seller_id: uuidv4(),
    sector_id: uuidv4(),
    title: 'Excess FMCG Lot — 500 units',
    description: 'Surplus inventory, grade A',
    dead_stock_type: 'excess',
    condition_grade: 'A',
    lot_type: 'full_lot',
    total_quantity: 500,
    available_quantity: 500,
    moq: 10,
    unit: 'pcs',
    price_type: 'fixed',
    asking_price: 250.0,
    state: 'Maharashtra',
    city: 'Mumbai',
    sector_slug: 'fmcg',
    status: 'live',
    images: ['https://cdn.example.com/img1.jpg'],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: uuidv4(),
    order_number: 'NM-ABC123',
    buyer_id: uuidv4(),
    seller_id: uuidv4(),
    listing_id: uuidv4(),
    quantity: 20,
    unit_price: 250,
    subtotal: 5000,
    total_amount: 5600,
    status: 'payment_pending',
    escrow_id: uuidv4(),
    ...overrides,
  };
}

// ── In-memory DB mock ──────────────────────────────────────────────────────────
type QueryHandler = (sql: string, params?: unknown[]) => unknown[] | undefined;

/**
 * A programmable mock for the shared DB helpers. Register handlers keyed by a
 * substring of the SQL; the first matching handler's rows are returned.
 *
 * Usage inside a test file:
 *   jest.mock('@nirmalmandi/shared', () => {
 *     const actual = jest.requireActual('@nirmalmandi/shared');
 *     const { createDbMock } = require('./testHelpers');
 *     return { ...actual, ...createDbMock() };
 *   });
 */
export function createDbMock() {
  const handlers: { match: string | RegExp; rows: QueryHandler }[] = [];

  function resolve(sql: string, params?: unknown[]): unknown[] {
    for (const h of handlers) {
      const hit =
        typeof h.match === 'string' ? sql.includes(h.match) : h.match.test(sql);
      if (hit) {
        const r = h.rows(sql, params);
        if (r !== undefined) return r;
      }
    }
    return [];
  }

  const query = jest.fn(async (sql: string, params?: unknown[]) => resolve(sql, params));
  const queryOne = jest.fn(async (sql: string, params?: unknown[]) => {
    const rows = resolve(sql, params);
    return rows[0] ?? null;
  });
  const withTransaction = jest.fn(async (fn: (client: unknown) => Promise<unknown>) => {
    const client = {
      query: jest.fn(async (sql: string, params?: unknown[]) => ({ rows: resolve(sql, params) })),
    };
    return fn(client);
  });

  return {
    query,
    queryOne,
    withTransaction,
    getDb: jest.fn(() => ({ query })),
    /** Register a SQL → rows handler. */
    on(match: string | RegExp, rows: QueryHandler | unknown[]) {
      handlers.push({
        match,
        rows: typeof rows === 'function' ? (rows as QueryHandler) : () => rows as unknown[],
      });
      return this;
    },
    /** Clear all handlers + call history. */
    reset() {
      handlers.length = 0;
      query.mockClear();
      queryOne.mockClear();
      withTransaction.mockClear();
    },
  };
}

export const validUuid = uuidv4;
