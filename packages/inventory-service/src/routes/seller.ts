/**
 * Seller-scoped routes — all require seller authentication.
 * Mounted at /seller in the inventory service.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  successResponse, errorResponse, logger,
} from '@nirmalmandi/shared';

export const sellerRouter = Router();

// All routes require seller auth
sellerRouter.use(authenticate, requireRole('seller', 'admin'));

// ── GET /seller/listings ──────────────────────────────────────────────────────
sellerRouter.get('/listings', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const status = req.query.status as string | undefined;
    const sort = (req.query.sort as string) || 'newest';
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      `l.seller_id = (SELECT id FROM seller_profiles WHERE user_id = $1)`,
      `l.deleted_at IS NULL`,
    ];
    const params: unknown[] = [req.user!.sub];
    let p = 2;

    if (status) { conditions.push(`l.status = $${p++}`); params.push(status); }
    if (search) {
      conditions.push(`l.title ILIKE $${p++}`);
      params.push(`%${search}%`);
    }

    const orderMap: Record<string, string> = {
      newest: 'l.created_at DESC',
      price_desc: 'l.asking_price DESC',
      views_desc: 'l.view_count DESC',
      aging: 'l.created_at ASC',
    };
    const orderBy = orderMap[sort] || 'l.created_at DESC';

    const rows = await query(
      `SELECT l.id, l.title, l.asking_price, l.status, l.images,
              l.view_count, l.watchlist_count, l.created_at,
              l.ai_urgency_score, l.sale_velocity_7d,
              s.name as sector_name, s.slug as sector_slug
       FROM listings l
       LEFT JOIN sectors s ON s.id = l.sector_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [{ count }] = await query(
      `SELECT COUNT(*) as count FROM listings l
       WHERE ${conditions.join(' AND ')}`,
      params
    ) as { count: string }[];

    res.json(successResponse({ data: rows, total: parseInt(count), page, limit }));
  } catch (err: any) {
    logger.error('Failed to fetch seller listings', { error: err.message });
    res.status(500).json(errorResponse('Failed to fetch listings'));
  }
});

// ── PATCH /seller/listings/:id/status ───────────────────────────────────────
sellerRouter.patch('/listings/:id/status', async (req: Request, res: Response) => {
  const schema = z.object({ status: z.enum(['live', 'paused', 'delisted']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse('Invalid status'));
    return;
  }
  try {
    const existing = await queryOne<{ seller_id: string }>(
      `SELECT sp.id as seller_id FROM listings l
       JOIN seller_profiles sp ON l.seller_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!existing) { res.status(404).json(errorResponse('Listing not found')); return; }

    await query(
      'UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2',
      [parsed.data.status, req.params.id]
    );
    res.json(successResponse({ id: req.params.id, status: parsed.data.status }));
  } catch (err: any) {
    res.status(500).json(errorResponse('Failed to update status'));
  }
});

// ── PATCH /seller/listings/bulk ──────────────────────────────────────────────
sellerRouter.patch('/listings/bulk', async (req: Request, res: Response) => {
  const schema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(50),
    action: z.enum(['pause', 'unpause', 'delist', 'change_price']),
    new_price: z.number().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse(parsed.error.errors[0].message));
    return;
  }
  const { ids, action, new_price } = parsed.data;

  try {
    const statusMap: Record<string, string> = {
      pause: 'paused',
      unpause: 'live',
      delist: 'delisted',
    };

    if (action === 'change_price') {
      if (!new_price) { res.status(400).json(errorResponse('new_price required')); return; }
      await query(
        `UPDATE listings SET asking_price = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])
           AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $3)`,
        [new_price, ids, req.user!.sub]
      );
    } else {
      await query(
        `UPDATE listings SET status = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])
           AND seller_id = (SELECT id FROM seller_profiles WHERE user_id = $3)`,
        [statusMap[action], ids, req.user!.sub]
      );
    }
    res.json(successResponse({ updated: ids.length, action }));
  } catch (err: any) {
    res.status(500).json(errorResponse('Bulk action failed'));
  }
});

// ── GET /seller/listings/:id/performance ─────────────────────────────────────
// Proxied to analytics service via gateway — kept here as fallback
sellerRouter.get('/listings/:id/performance', async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT
         ROUND(l.view_count::numeric / GREATEST(EXTRACT(DAY FROM NOW() - l.created_at), 1), 1) AS views_per_day,
         l.watchlist_count,
         CASE WHEN l.view_count > 0
              THEN ROUND((SELECT COUNT(*) FROM orders WHERE listing_id = l.id)::numeric / l.view_count * 100, 2)
              ELSE 0 END AS conversion_pct
       FROM listings l
       WHERE l.id = $1 AND l.seller_id = (SELECT id FROM seller_profiles WHERE user_id = $2)`,
      [req.params.id, req.user!.sub]
    );
    if (!rows.length) { res.status(404).json(errorResponse('Listing not found')); return; }
    res.json(successResponse({ ...(rows[0] as object), inquiries_count: 0, trend: [] }));
  } catch (err: any) {
    res.status(500).json(errorResponse('Failed to fetch performance data'));
  }
});
