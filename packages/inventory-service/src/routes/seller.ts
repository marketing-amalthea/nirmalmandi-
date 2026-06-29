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
    // Accept both `sort` and `sort_by` (the web client sends `sort_by`).
    const sort = (req.query.sort as string) || (req.query.sort_by as string) || 'newest';
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
      views_desc: 'l.views_count DESC',
      aging: 'l.created_at ASC',
    };
    const orderBy = orderMap[sort] || 'l.created_at DESC';

    // NOTE: the canonical counter columns (populated by seed data + triggers) are
    // `views_count` / `inquiries_count` / `watchlist_count`. We also alias them to
    // the singular variants (`view_count` etc.) that some legacy clients read.
    const rows = await query(
      `SELECT l.id, l.title, l.sector_id, l.dead_stock_type, l.condition_grade,
              l.lot_type, l.total_quantity, l.available_quantity,
              l.asking_price, l.mrp, l.status, l.is_featured,
              l.views_count, l.inquiries_count, l.watchlist_count,
              l.views_count   AS view_count,
              l.inquiries_count AS inquiry_count,
              l.images, l.state, l.city,
              l.created_at, l.updated_at,
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

    // `listings` is the documented key; `data` is kept as an alias for the
    // existing web client (`/seller/listings` page reads `data.data`).
    res.json(successResponse({
      listings: rows,
      data: rows,
      total: parseInt(count),
      page,
      limit,
    }));
  } catch (err: any) {
    logger.error('Failed to fetch seller listings', { error: err.message });
    res.status(500).json(errorResponse('Failed to fetch listings'));
  }
});

// ── GET /seller/listings/:id ──────────────────────────────────────────────────
// Single listing scoped to the authenticated seller (for the edit page).
sellerRouter.get('/listings/:id', async (req: Request, res: Response) => {
  try {
    const row = await queryOne(
      `SELECT l.id, l.title, l.description, l.sector_id, l.dead_stock_type,
              l.condition_grade, l.lot_type, l.total_quantity, l.available_quantity,
              l.moq, l.unit, l.price_type, l.asking_price, l.floor_price,
              l.reserve_price, l.mrp, l.status, l.is_featured,
              l.views_count, l.inquiries_count, l.watchlist_count,
              l.views_count AS view_count, l.inquiries_count AS inquiry_count,
              l.images, l.video_url, l.state, l.city, l.urgency_days,
              l.expiry_date, l.sector_specific_fields,
              l.created_at, l.updated_at,
              s.name as sector_name, s.slug as sector_slug
       FROM listings l
       LEFT JOIN sectors s ON s.id = l.sector_id
       WHERE l.id = $1
         AND l.seller_id = (SELECT id FROM seller_profiles WHERE user_id = $2)
         AND l.deleted_at IS NULL`,
      [req.params.id, req.user!.sub]
    );
    if (!row) { res.status(404).json(errorResponse('Listing not found')); return; }
    res.json(successResponse(row));
  } catch (err: any) {
    logger.error('Failed to fetch seller listing', { error: err.message });
    res.status(500).json(errorResponse('Failed to fetch listing'));
  }
});

// ── PATCH /seller/listings/bulk-pause ─────────────────────────────────────────
// Pauses every live listing owned by the seller (used by the danger zone in
// the settings page). Returns how many listings were paused.
sellerRouter.patch('/listings/bulk-pause', async (req: Request, res: Response) => {
  try {
    const rows = await query<{ id: string }>(
      `UPDATE listings SET status = 'paused', updated_at = NOW()
       WHERE seller_id = (SELECT id FROM seller_profiles WHERE user_id = $1)
         AND status IN ('live','active')
         AND deleted_at IS NULL
       RETURNING id`,
      [req.user!.sub]
    );
    res.json(successResponse({ paused: rows.length }));
  } catch (err: any) {
    logger.error('Bulk pause failed', { error: err.message });
    res.status(500).json(errorResponse('Failed to pause listings'));
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
         l.views_count,
         ROUND(l.views_count::numeric / GREATEST(EXTRACT(DAY FROM NOW() - l.created_at), 1), 1) AS views_per_day,
         l.watchlist_count,
         l.inquiries_count,
         CASE WHEN l.views_count > 0
              THEN ROUND((SELECT COUNT(*) FROM orders WHERE listing_id = l.id)::numeric / l.views_count * 100, 2)
              ELSE 0 END AS conversion_pct
       FROM listings l
       WHERE l.id = $1 AND l.seller_id = (SELECT id FROM seller_profiles WHERE user_id = $2)`,
      [req.params.id, req.user!.sub]
    );
    if (!rows.length) { res.status(404).json(errorResponse('Listing not found')); return; }
    res.json(successResponse({ ...(rows[0] as object), trend: [] }));
  } catch (err: any) {
    res.status(500).json(errorResponse('Failed to fetch performance data'));
  }
});
