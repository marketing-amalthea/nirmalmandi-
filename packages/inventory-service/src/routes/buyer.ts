import { Router, Request, Response } from 'express';
import { query, queryOne, successResponse, errorResponse, authenticate, requireRole } from '@nirmalmandi/shared';
import { v4 as uuidv4 } from 'uuid';

export const buyerRouter = Router();

// ── GET /buyer/watchlist ──────────────────────────────────────
buyerRouter.get('/watchlist', authenticate, requireRole('buyer'), async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT w.id, w.listing_id, w.price_at_save, w.created_at,
              l.title, l.asking_price, l.images, l.status,
              l.condition_grade, l.city, l.state, l.sector_id,
              s.name AS sector_name
       FROM watchlist w
       JOIN listings l ON l.id = w.listing_id
       LEFT JOIN sectors s ON s.id = l.sector_id
       WHERE w.buyer_id = $1
         AND l.deleted_at IS NULL
       ORDER BY w.created_at DESC`,
      [req.user!.profile_id]
    );
    res.json(successResponse(rows));
  } catch {
    res.status(500).json(errorResponse('Failed to fetch watchlist'));
  }
});

// ── POST /buyer/watchlist ─────────────────────────────────────
buyerRouter.post('/watchlist', authenticate, requireRole('buyer'), async (req: Request, res: Response) => {
  const { listing_id } = req.body as { listing_id: string };
  if (!listing_id) {
    res.status(400).json(errorResponse('listing_id required'));
    return;
  }
  try {
    const listing = await queryOne<{ asking_price: number }>(
      'SELECT asking_price FROM listings WHERE id = $1 AND deleted_at IS NULL',
      [listing_id]
    );
    if (!listing) { res.status(404).json(errorResponse('Listing not found')); return; }

    await query(
      `INSERT INTO watchlist (id, buyer_id, listing_id, price_at_save)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (buyer_id, listing_id) DO NOTHING`,
      [uuidv4(), req.user!.profile_id, listing_id, listing.asking_price]
    );
    await query(
      'UPDATE listings SET watchlist_count = watchlist_count + 1 WHERE id = $1',
      [listing_id]
    );
    res.json(successResponse({ message: 'Added to watchlist' }));
  } catch {
    res.status(500).json(errorResponse('Could not add to watchlist'));
  }
});

// ── DELETE /buyer/watchlist/:listing_id ───────────────────────
buyerRouter.delete('/watchlist/:listing_id', authenticate, requireRole('buyer'), async (req: Request, res: Response) => {
  try {
    await query(
      'DELETE FROM watchlist WHERE buyer_id = $1 AND listing_id = $2',
      [req.user!.profile_id, req.params.listing_id]
    );
    await query(
      'UPDATE listings SET watchlist_count = GREATEST(0, watchlist_count - 1) WHERE id = $1',
      [req.params.listing_id]
    );
    res.json(successResponse({ message: 'Removed from watchlist' }));
  } catch {
    res.status(500).json(errorResponse('Could not remove from watchlist'));
  }
});
