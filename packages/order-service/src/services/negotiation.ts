import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  successResponse, errorResponse, logger,
} from '@nirmalmandi/shared';

export const negotiationRouter = Router();

const offerSchema = z.object({
  listing_id: z.string().uuid(),
  offered_price: z.number().positive(),
  message: z.string().max(500).optional(),
});

// ── POST /negotiations — initiate offer ──────────────────────
negotiationRouter.post(
  '/',
  authenticate,
  requireRole('buyer'),
  async (req: Request, res: Response) => {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message));
      return;
    }
    const { listing_id, offered_price, message } = parsed.data;

    const listing = await queryOne<{ seller_id: string; asking_price: number; floor_price: number; status: string }>(
      'SELECT seller_id, asking_price, floor_price, status FROM listings WHERE id = $1',
      [listing_id]
    );
    if (!listing || listing.status !== 'live') {
      res.status(404).json(errorResponse('Listing not found or not available'));
      return;
    }
    if (listing.floor_price && offered_price < listing.floor_price) {
      res.status(400).json(errorResponse(`Offer below minimum floor price of ₹${listing.floor_price}`));
      return;
    }

    // Check for existing active negotiation
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM negotiations WHERE listing_id = $1 AND buyer_id = $2 AND status = 'active'`,
      [listing_id, req.user!.profile_id]
    );
    if (existing) {
      res.status(409).json(errorResponse('Active negotiation already exists for this listing'));
      return;
    }

    const negotiation = await withTransaction(async (client) => {
      const negId = uuidv4();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      await client.query(
        `INSERT INTO negotiations (id, listing_id, buyer_id, seller_id, current_price, last_offer_by, expires_at, round_count)
         VALUES ($1,$2,$3,$4,$5,'buyer',$6,1)`,
        [negId, listing_id, req.user!.profile_id, listing.seller_id, offered_price, expiresAt]
      );

      await client.query(
        `INSERT INTO negotiation_rounds (id, negotiation_id, offered_by, offered_price, message)
         VALUES ($1,$2,'buyer',$3,$4)`,
        [uuidv4(), negId, offered_price, message ?? null]
      );

      return { id: negId, expires_at: expiresAt };
    });

    // Notify seller (fire and forget)
    notifyNegotiationUpdate(listing.seller_id, 'new_offer', negotiation.id);

    res.status(201).json(successResponse({ ...negotiation, listing_id, offered_price }, 'Offer submitted'));
  }
);

// ── POST /negotiations/:id/counter — counter offer ──────────
negotiationRouter.post(
  '/:id/counter',
  authenticate,
  async (req: Request, res: Response) => {
    const neg = await queryOne<{
      buyer_id: string; seller_id: string; round_count: number; status: string; last_offer_by: string
    }>(
      'SELECT buyer_id, seller_id, round_count, status, last_offer_by FROM negotiations WHERE id = $1',
      [req.params.id]
    );
    if (!neg || neg.status !== 'active') {
      res.status(404).json(errorResponse('Negotiation not found or no longer active'));
      return;
    }

    const isBuyer = req.user!.profile_id === neg.buyer_id;
    const isSeller = req.user!.profile_id === neg.seller_id;
    if (!isBuyer && !isSeller) {
      res.status(403).json(errorResponse('Not a party to this negotiation'));
      return;
    }

    const offeredBy = isBuyer ? 'buyer' : 'seller';
    if (neg.last_offer_by === offeredBy) {
      res.status(409).json(errorResponse('Waiting for the other party to respond'));
      return;
    }
    if (neg.round_count >= 5) {
      res.status(400).json(errorResponse('Maximum negotiation rounds (5) reached'));
      return;
    }

    const { offered_price, message } = req.body;
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE negotiations SET current_price=$1, last_offer_by=$2, round_count=round_count+1,
         expires_at=NOW()+'48 hours' WHERE id=$3`,
        [offered_price, offeredBy, req.params.id]
      );
      await client.query(
        `INSERT INTO negotiation_rounds (id, negotiation_id, offered_by, offered_price, message)
         VALUES ($1,$2,$3,$4,$5)`,
        [uuidv4(), req.params.id, offeredBy, offered_price, message ?? null]
      );
    });

    const notifyId = isBuyer ? neg.seller_id : neg.buyer_id;
    notifyNegotiationUpdate(notifyId, 'counter_offer', req.params.id);

    res.json(successResponse({ negotiation_id: req.params.id, offered_price, offered_by: offeredBy }));
  }
);

// ── POST /negotiations/:id/accept ────────────────────────────
negotiationRouter.post(
  '/:id/accept',
  authenticate,
  async (req: Request, res: Response) => {
    const neg = await queryOne<{ buyer_id: string; seller_id: string; current_price: number; listing_id: string; status: string }>(
      'SELECT buyer_id, seller_id, current_price, listing_id, status FROM negotiations WHERE id = $1',
      [req.params.id]
    );
    if (!neg || neg.status !== 'active') {
      res.status(404).json(errorResponse('Negotiation not found or inactive'));
      return;
    }
    const isParty = [neg.buyer_id, neg.seller_id].includes(req.user!.profile_id);
    if (!isParty) { res.status(403).json(errorResponse('Not a party')); return; }

    await query(
      'UPDATE negotiations SET status = $1, updated_at = NOW() WHERE id = $2',
      ['accepted', req.params.id]
    );

    res.json(successResponse({
      negotiation_id: req.params.id,
      agreed_price: neg.current_price,
      listing_id: neg.listing_id,
      message: 'Offer accepted. Proceed to checkout.',
    }));
  }
);

// ── POST /negotiations/:id/reject ────────────────────────────
negotiationRouter.post(
  '/:id/reject',
  authenticate,
  async (req: Request, res: Response) => {
    await query(
      'UPDATE negotiations SET status = $1 WHERE id = $2',
      ['rejected', req.params.id]
    );
    res.json(successResponse({ message: 'Negotiation rejected' }));
  }
);

// ── GET /negotiations/my ─────────────────────────────────────
negotiationRouter.get(
  '/my',
  authenticate,
  async (req: Request, res: Response) => {
    const isSeller = req.user!.role === 'seller';
    const col = isSeller ? 'seller_id' : 'buyer_id';
    const negotiations = await query(
      `SELECT n.*, l.title as listing_title, l.images[1] as listing_image
       FROM negotiations n
       JOIN listings l ON n.listing_id = l.id
       WHERE n.${col} = $1
       ORDER BY n.updated_at DESC LIMIT 50`,
      [req.user!.profile_id]
    );
    res.json(successResponse(negotiations));
  }
);

async function notifyNegotiationUpdate(profileId: string, event: string, negotiationId: string) {
  try {
    const { default: axios } = await import('axios');
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006'}/notifications/send`, {
      profile_id: profileId,
      type: event,
      title: event === 'new_offer' ? 'New offer received' : 'Counter offer received',
      body: `Check your negotiation #${negotiationId.slice(0, 8)}`,
      channels: ['push', 'in_app'],
    });
  } catch (e) {
    logger.warn('Failed to notify negotiation update', { event, negotiationId });
  }
}
