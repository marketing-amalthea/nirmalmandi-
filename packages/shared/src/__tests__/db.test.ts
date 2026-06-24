/**
 * Unit tests for the shared DB helpers (query / queryOne / withTransaction).
 * The `pg` Pool is fully mocked — no live Postgres connection required.
 */

// Mock the pg module before importing the client under test.
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockQuery,
      connect: mockConnect,
      on: jest.fn(),
    })),
  };
});

import { query, queryOne, withTransaction, getDb } from '../db/client';

beforeEach(() => {
  mockQuery.mockReset();
  mockConnect.mockReset();
  mockRelease.mockReset();
});

describe('query()', () => {
  it('executes SQL with params and returns rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }] });
    const rows = await query('SELECT * FROM users WHERE role = $1', ['buyer']);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE role = $1', ['buyer']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: '1', name: 'A' });
  });

  it('returns an empty array when no rows match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const rows = await query('SELECT * FROM users WHERE id = $1', ['nope']);
    expect(rows).toEqual([]);
  });
});

describe('queryOne()', () => {
  it('returns the first row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }, { id: '2' }] });
    const row = await queryOne('SELECT id FROM users LIMIT 1');
    expect(row).toEqual({ id: '1' });
  });

  it('returns null when there are no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const row = await queryOne('SELECT id FROM users WHERE id = $1', ['missing']);
    expect(row).toBeNull();
  });
});

describe('withTransaction()', () => {
  it('wraps the callback in BEGIN / COMMIT and releases the client', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: mockRelease };
    mockConnect.mockResolvedValueOnce(client);

    const result = await withTransaction(async (c) => {
      await c.query('INSERT INTO users (id) VALUES ($1)', ['1']);
      return 'done';
    });

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(mockRelease).toHaveBeenCalled();
    expect(result).toBe('done');
  });

  it('rolls back and rethrows when the callback throws', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: mockRelease };
    mockConnect.mockResolvedValueOnce(client);

    await expect(
      withTransaction(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockRelease).toHaveBeenCalled();
  });
});

describe('getDb()', () => {
  it('returns a singleton pool', () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });
});
