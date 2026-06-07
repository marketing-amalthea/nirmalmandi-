import { Router, Request, Response } from 'express';
import { query, queryOne, authenticate, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminInventoryRouter = Router();

// Admin role guard
function requireAdmin(req: Request, res: Response, next: () => void): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json(errorResponse('Forbidden: admin access required', '403'));
    return;
  }
  next();
}

// GET /admin/inventory
adminInventoryRouter.get('/', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;
    const { status, sector, search } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`l.status = $${idx++}`);
      params.push(status);
    }
    if (sector) {
      conditions.push(`l.sector_id = $${idx++}`);
      params.push(sector);
    }
    if (search) {
      conditions.push(`(l.title ILIKE $${idx} OR COALESCE(sp.business_name, u.name) ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM listings l
       LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
       LEFT JOIN users u ON sp.user_id = u.id
       LEFT JOIN sectors sec ON l.sector_id = sec.id
       ${where}`,
      params
    );
    const total = parseInt((countRows[0] as any).total as string, 10);

    params.push(limit, offset);
    const rows = await query(
      `SELECT l.id, l.title, l.status, l.asking_price AS "askingPrice",
              l.available_quantity AS "availableQty",
              l.created_at AS "createdAt",
              COALESCE(sp.business_name, u.name) AS "sellerName",
              u.phone AS "sellerPhone",
              COALESCE(sec.name, '') AS "sector",
              EXTRACT(DAY FROM NOW() - l.created_at)::int AS "daysListed",
              COALESCE(l.views_count, 0) AS "viewsCount"
       FROM listings l
       LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
       LEFT JOIN users u ON sp.user_id = u.id
       LEFT JOIN sectors sec ON l.sector_id = sec.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json(successResponse({ rows, total }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', '500'));
  }
});

// PATCH /admin/inventory/:id/feature
adminInventoryRouter.patch('/:id/feature', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await queryOne(
      `UPDATE listings SET is_featured = true, updated_at = NOW() WHERE id = $1 RETURNING id, title, status, is_featured`,
      [id]
    );
    if (!listing) {
      res.status(404).json(errorResponse('Listing not found', '404'));
      return;
    }
    res.json(successResponse(listing));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', '500'));
  }
});

// PATCH /admin/inventory/:id/unfeature
adminInventoryRouter.patch('/:id/unfeature', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await queryOne(
      `UPDATE listings SET is_featured = false, updated_at = NOW() WHERE id = $1 RETURNING id, title, status, is_featured`,
      [id]
    );
    if (!listing) {
      res.status(404).json(errorResponse('Listing not found', '404'));
      return;
    }
    res.json(successResponse(listing));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', '500'));
  }
});

// PATCH /admin/inventory/:id/pause
adminInventoryRouter.patch('/:id/pause', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await queryOne(
      `UPDATE listings SET status = 'paused', updated_at = NOW() WHERE id = $1 RETURNING id, title, status`,
      [id]
    );
    if (!listing) {
      res.status(404).json(errorResponse('Listing not found', '404'));
      return;
    }
    res.json(successResponse(listing));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', '500'));
  }
});

// PATCH /admin/inventory/:id/delist
adminInventoryRouter.patch('/:id/delist', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listing = await queryOne(
      `UPDATE listings SET status = 'delisted', updated_at = NOW() WHERE id = $1 RETURNING id, title, status`,
      [id]
    );
    if (!listing) {
      res.status(404).json(errorResponse('Listing not found', '404'));
      return;
    }
    res.json(successResponse(listing));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', '500'));
  }
});

// POST /admin/inventory/bulk
adminInventoryRouter.post('/bulk', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { ids, action } = req.body as { ids?: string[]; action?: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json(errorResponse('ids must be a non-empty array', '400'));
      return;
    }
    if (!action) {
      res.status(400).json(errorResponse('action is required', '400'));
      return;
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

    let sql: string;
    switch (action) {
      case 'feature':
        sql = `UPDATE listings SET is_featured = true, updated_at = NOW() WHERE id IN (${placeholders})`;
        break;
      case 'unfeature':
        sql = `UPDATE listings SET is_featured = false, updated_at = NOW() WHERE id IN (${placeholders})`;
        break;
      case 'pause':
        sql = `UPDATE listings SET status = 'paused', updated_at = NOW() WHERE id IN (${placeholders})`;
        break;
      case 'delist':
        sql = `UPDATE listings SET status = 'delisted', updated_at = NOW() WHERE id IN (${placeholders})`;
        break;
      case 'activate':
        sql = `UPDATE listings SET status = 'active', updated_at = NOW() WHERE id IN (${placeholders})`;
        break;
      default:
        res.status(400).json(errorResponse(`Unknown action: ${action}`, '400'));
        return;
    }

    await query(sql, ids);
    res.json(successResponse({ updated: ids.length, action }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', '500'));
  }
});
