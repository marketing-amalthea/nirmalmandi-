import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  bufferViewCount,
  reserveStock, releaseStockReservation,
  successResponse, errorResponse,
  rateLimiter, logger,
} from '@nirmalmandi/shared';
import { syncListingToElasticsearch, deleteListingFromEs } from '../services/elasticsearch';
import { computeUrgencyScore } from '../services/urgency';

export const listingsRouter = Router();

const createListingSchema = z.object({
  sector_id: z.string().uuid(),
  title: z.string().min(5).max(500),
  description: z.string().optional(),
  dead_stock_type: z.enum(['excess', 'near_expiry', 'obsolete', 'seasonal', 'returns', 'damaged_packaging']),
  condition_grade: z.enum(['A', 'B', 'C', 'D']),
  lot_type: z.enum(['full_lot', 'partial', 'per_unit']),
  total_quantity: z.number().int().positive(),
  moq: z.number().int().min(1).default(1),
  unit: z.string().min(1),
  price_type: z.enum(['fixed', 'offer', 'auction', 'flash']),
  asking_price: z.number().positive(),
  floor_price: z.number().positive().optional(),
  reserve_price: z.number().positive().optional(),
  mrp: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  sector_specific_fields: z.record(z.unknown()).default({}),
  images: z.array(z.string()).default([]),
  state: z.string().min(2),
  city: z.string().min(2),
  urgency_days: z.number().int().positive().optional(),
  expiry_date: z.string().optional(),
  auction_ends_at: z.string().datetime().optional(),
  flash_sale_ends_at: z.string().datetime().optional(),
  warehouse_location_id: z.string().uuid().optional(),
});

// ── POST /listings ────────────────────────────────────────────
listingsRouter.post(
  '/',
  authenticate,
  requireRole('seller'),
  rateLimiter(20),
  async (req: Request, res: Response) => {
    const parsed = createListingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }
    const data = parsed.data;
    const urgency_score = computeUrgencyScore(data.urgency_days, data.dead_stock_type, data.expiry_date);

    try {
      const listing = await withTransaction(async (client) => {
        const id = uuidv4();
        await client.query(
          `INSERT INTO listings
            (id, seller_id, sector_id, title, description, dead_stock_type, condition_grade,
             lot_type, total_quantity, available_quantity, moq, unit, price_type, asking_price,
             floor_price, mrp, sector_specific_fields, images, state, city,
             urgency_days, urgency_score, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,
                   $17::text[],$18,$19,$20,$21,$22,'live')`,
          [
            id, req.user!.profile_id, data.sector_id, data.title, data.description ?? null,
            data.dead_stock_type, data.condition_grade, data.lot_type,
            data.total_quantity, data.moq, data.unit, data.price_type,
            data.asking_price, data.floor_price ?? null,
            data.mrp ?? null, JSON.stringify(data.sector_specific_fields),
            data.images, data.state, data.city,
            data.urgency_days ?? null, urgency_score,
          ]
        );
        const listing = await client.query('SELECT * FROM listings WHERE id = $1', [id]);
        return listing.rows[0];
      });

      // Sync to Elasticsearch (async — don't block response)
      syncListingToElasticsearch(listing).catch(err =>
        logger.error('ES sync failed', { listingId: listing.id, error: err.message })
      );

      logger.info('Listing created', { listingId: listing.id, sellerId: req.user!.profile_id });
      res.status(201).json(successResponse(listing, 'Listing created successfully'));
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'Unknown error';
      logger.error('Listing create failed', { error: msg });
      res.status(500).json(errorResponse(`Failed to create listing: ${msg}`, 'DB_ERROR'));
    }
  }
);

// ── GET /listings (browse) ────────────────────────────────────
listingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const { search, sector, min_price, max_price, sort_by, featured, seller_id } = req.query;

    const conditions: string[] = ["l.status IN ('live', 'active')", 'l.deleted_at IS NULL'];
    const params: unknown[] = [];
    let p = 1;

    if (search) { conditions.push(`l.title ILIKE $${p++}`); params.push(`%${search}%`); }
    if (sector) { conditions.push(`s.slug = $${p++}`); params.push(sector); }
    if (min_price) { conditions.push(`l.asking_price >= $${p++}`); params.push(Number(min_price)); }
    if (max_price) { conditions.push(`l.asking_price <= $${p++}`); params.push(Number(max_price)); }
    if (seller_id) { conditions.push(`l.seller_id = $${p++}`); params.push(seller_id); }

    const orderBy = sort_by === 'price_asc' ? 'l.asking_price ASC'
      : sort_by === 'price_desc' ? 'l.asking_price DESC'
      : sort_by === 'newest' ? 'l.created_at DESC'
      : 'l.created_at DESC';

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT l.id, l.title, l.unit, l.condition_grade, l.lot_type,
              l.urgency_score, l.city, l.state, l.created_at, l.status,
              l.images, l.dead_stock_type, l.moq,
              l.asking_price,
              l.asking_price      AS price_per_unit,
              l.available_quantity,
              l.available_quantity AS quantity,
              s.name              AS sector_name,
              s.name              AS sector,
              s.slug              AS sector_slug,
              l.city              AS seller_city,
              l.state             AS seller_state,
              COALESCE(sp.business_name, '') AS seller_name,
              COALESCE(sp.business_name, '') AS seller_business_name
       FROM listings l
       LEFT JOIN sectors s ON s.id = l.sector_id
       LEFT JOIN seller_profiles sp ON sp.id = l.seller_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [{ count }] = await query(`SELECT COUNT(*) as count FROM listings l LEFT JOIN sectors s ON s.id = l.sector_id ${where}`, params) as { count: string }[];
    res.json(successResponse({ rows, total: parseInt(count), page, limit }));
  } catch (err) {
    logger.error('Failed to list listings', { error: err });
    res.status(500).json(errorResponse('Failed to fetch listings'));
  }
});

// ── GET /listings/mine (seller's own) ─────────────────────────
listingsRouter.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const rows = await query(
      `SELECT l.*, s.name as sector_name, s.slug as sector_slug
       FROM listings l
       LEFT JOIN sectors s ON s.id = l.sector_id
       WHERE l.seller_id = (SELECT id FROM seller_profiles WHERE user_id = $1)
         AND l.deleted_at IS NULL
       ORDER BY l.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [req.user!.sub]
    );
    const [{ count }] = await query(
      `SELECT COUNT(*) as count FROM listings WHERE seller_id = (SELECT id FROM seller_profiles WHERE user_id = $1) AND deleted_at IS NULL`,
      [req.user!.sub]
    ) as { count: string }[];
    res.json(successResponse({ rows, total: parseInt(count), page, limit }));
  } catch (err) {
    res.status(500).json(errorResponse('Failed to fetch your listings'));
  }
});

// ── GET /listings/:id ─────────────────────────────────────────
listingsRouter.get('/:id', async (req: Request, res: Response) => {
  const listing = await queryOne(
    `SELECT l.*, s.name as sector_name, s.slug as sector_slug,
            sp.business_name as seller_business_name, sp.verification_tier as seller_tier,
            sp.performance_score as seller_rating
     FROM listings l
     LEFT JOIN sectors s ON l.sector_id = s.id
     LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
     WHERE l.id = $1 AND l.deleted_at IS NULL AND l.status IN ('live', 'active')`,
    [req.params.id]
  );
  if (!listing) { res.status(404).json(errorResponse('Listing not found')); return; }

  // Remove internal fields for non-sellers
  const isOwner = req.user?.profile_id === (listing as Record<string, unknown>).seller_id;
  if (!isOwner) {
    delete (listing as Record<string, unknown>).cost_price_enc;
  }

  // Buffer view count
  bufferViewCount(req.params.id).catch(() => {});
  res.json(successResponse(listing));
});

// ── PATCH /listings/:id ───────────────────────────────────────
listingsRouter.patch(
  '/:id',
  authenticate,
  requireRole('seller', 'admin'),
  async (req: Request, res: Response) => {
    const existing = await queryOne<{ seller_id: string; status: string }>(
      'SELECT seller_id, status FROM listings WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!existing) { res.status(404).json(errorResponse('Listing not found')); return; }
    if (req.user!.role === 'seller' && existing.seller_id !== req.user!.profile_id) {
      res.status(403).json(errorResponse('Not your listing')); return;
    }

    const allowed = ['title', 'description', 'asking_price', 'floor_price', 'status',
                     'urgency_days', 'images', 'sector_specific_fields'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(updates).length) {
      res.json(successResponse({ message: 'Nothing to update' })); return;
    }

    const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    await query(
      `UPDATE listings SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`,
      [req.params.id, ...Object.values(updates)]
    );

    const updated = await queryOne('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    syncListingToElasticsearch(updated!).catch(() => {});
    res.json(successResponse(updated));
  }
);

// ── DELETE /listings/:id (soft delete) ───────────────────────
listingsRouter.delete(
  '/:id',
  authenticate,
  requireRole('seller', 'admin'),
  async (req: Request, res: Response) => {
    await query(
      'UPDATE listings SET status = $1, deleted_at = NOW() WHERE id = $2',
      ['delisted', req.params.id]
    );
    await releaseStockReservation(req.params.id);
    await deleteListingFromEs(req.params.id);
    res.json(successResponse({ message: 'Listing delisted' }));
  }
);

// ── POST /listings/:id/watchlist ──────────────────────────────
listingsRouter.post(
  '/:id/watchlist',
  authenticate,
  requireRole('buyer'),
  async (req: Request, res: Response) => {
    try {
      const lPrice = await queryOne<{ asking_price: number }>('SELECT asking_price FROM listings WHERE id = $1', [req.params.id]);
      await query(
        'INSERT INTO watchlist (id, buyer_id, listing_id, price_at_save) VALUES ($1,$2,$3,$4) ON CONFLICT (buyer_id, listing_id) DO NOTHING',
        [uuidv4(), req.user!.profile_id, req.params.id, lPrice?.asking_price ?? null]
      );
      await query('UPDATE listings SET watchlist_count = watchlist_count + 1 WHERE id = $1', [req.params.id]);
      res.json(successResponse({ message: 'Added to watchlist' }));
    } catch {
      res.status(400).json(errorResponse('Could not add to watchlist'));
    }
  }
);

// ── GET /listings/:id/compliance ─────────────────────────────────────────────
// Checks whether the authenticated buyer meets the sector's compliance requirements.
// Returns { compliant: bool, missing: string[], warning_message: string, required_documents: string[] }

listingsRouter.get('/:id/compliance', authenticate, async (req: Request, res: Response) => {
  const listing = await queryOne<{ sector_id: string }>(
    'SELECT sector_id FROM listings WHERE id = $1', [req.params.id]
  );
  if (!listing) return res.status(404).json(errorResponse('Listing not found'));

  const sector = await queryOne<{ compliance_rules: Record<string, unknown> }>(
    'SELECT compliance_rules FROM sectors WHERE id = $1', [listing.sector_id]
  );
  const rules = sector?.compliance_rules ?? {};
  const required: string[] = (rules.required_documents as string[]) ?? [];

  if (required.length === 0) {
    return res.json(successResponse({ compliant: true, missing: [], required_documents: [], warning_message: null }));
  }

  // Only buyers need compliance checks
  if (req.user!.role !== 'buyer') {
    return res.json(successResponse({ compliant: true, missing: [], required_documents: required, warning_message: null }));
  }

  const buyer = await queryOne<{ compliance_documents: Record<string, unknown> }>(
    'SELECT compliance_documents FROM buyer_profiles WHERE id = $1', [req.user!.profile_id]
  );
  const docs = buyer?.compliance_documents ?? {};
  const missing = required.filter(d => !docs[d]);

  return res.json(successResponse({
    compliant: missing.length === 0,
    missing,
    required_documents: required,
    document_labels: (rules.document_labels ?? {}) as Record<string, string>,
    warning_message: missing.length > 0 ? rules.warning_message ?? null : null,
    check_before: rules.check_before ?? 'checkout',
  }));
});
