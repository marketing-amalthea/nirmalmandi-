import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';

export const profileRouter = Router();

profileRouter.use(authenticate);

// ── GET /profile/me ──────────────────────────────────────────
profileRouter.get('/me', async (req: Request, res: Response) => {
  const user = await queryOne(
    `SELECT u.id, u.phone, u.email, u.name, u.role, u.language_preference, u.referral_code, u.status,
            u.created_at
     FROM users u
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [req.user!.sub]
  );

  if (!user) { res.status(404).json(errorResponse('User not found')); return; }

  let profile = null;
  if (req.user!.role === 'seller') {
    profile = await queryOne(
      `SELECT sp.id, sp.business_name, sp.business_type, sp.gst_number, sp.verification_tier,
              sp.performance_score, sp.dispute_rate, sp.fulfillment_rate, sp.total_gmv, sp.kyc_status
       FROM seller_profiles sp WHERE sp.user_id = $1`,
      [req.user!.sub]
    );
  } else if (req.user!.role === 'buyer') {
    profile = await queryOne(
      `SELECT bp.id, bp.business_name, bp.gst_number, bp.verification_tier,
              bp.sector_interests, bp.total_purchases, bp.ai_credits_balance, bp.referral_earnings
       FROM buyer_profiles bp WHERE bp.user_id = $1`,
      [req.user!.sub]
    );
  }

  res.json(successResponse({ ...user, profile }));
});

// ── PATCH /profile/me ────────────────────────────────────────
profileRouter.patch('/me', async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(255).optional(),
    email: z.string().email().optional(),
    language_preference: z.enum(['en', 'hi']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse(parsed.error.errors[0].message));
    return;
  }
  const updates = parsed.data;
  const fields = Object.entries(updates).map(([k], i) => `${k} = $${i + 2}`);
  if (!fields.length) { res.json(successResponse({ message: 'Nothing to update' })); return; }
  await query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`,
    [req.user!.sub, ...Object.values(updates)]
  );
  res.json(successResponse({ message: 'Profile updated' }));
});

// ── GET /profile/addresses ────────────────────────────────────
profileRouter.get('/addresses', async (req: Request, res: Response) => {
  const rows = await query(
    `SELECT id, name, phone, address_line1, address_line2, city, state, pincode, is_default
     FROM buyer_addresses
     WHERE buyer_id = (SELECT id FROM buyer_profiles WHERE user_id = $1)
     ORDER BY is_default DESC, created_at DESC`,
    [req.user!.sub]
  );
  res.json(successResponse(rows));
});

// ── POST /profile/addresses ───────────────────────────────────
profileRouter.post('/addresses', async (req: Request, res: Response) => {
  const { v4: uuidv4 } = await import('uuid');
  const schema = z.object({
    name: z.string().min(2),
    phone: z.string().min(10),
    address_line1: z.string().min(5),
    address_line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
    save_for_future: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(errorResponse(parsed.error.errors[0].message)); return; }
  const d = parsed.data;
  const addressId = uuidv4();
  const buyerProfile = await queryOne<{ id: string }>(
    'SELECT id FROM buyer_profiles WHERE user_id = $1',
    [req.user!.sub]
  );
  if (!buyerProfile) { res.status(400).json(errorResponse('Buyer profile not found')); return; }
  await query(
    `INSERT INTO buyer_addresses (id, buyer_id, name, phone, address_line1, address_line2, city, state, pincode, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, (SELECT COUNT(*) = 0 FROM buyer_addresses WHERE buyer_id = $2))`,
    [addressId, buyerProfile.id, d.name, d.phone, d.address_line1, d.address_line2 ?? null, d.city, d.state, d.pincode]
  );
  const address = await queryOne('SELECT * FROM buyer_addresses WHERE id = $1', [addressId]);
  res.status(201).json(successResponse(address));
});

// ── GET /profile/referral ─────────────────────────────────────
profileRouter.get('/referral', async (req: Request, res: Response) => {
  const user = await queryOne<{ referral_code: string }>(
    'SELECT referral_code FROM users WHERE id = $1',
    [req.user!.sub]
  );
  const stats = await queryOne(
    `SELECT
       COUNT(*) AS referral_count,
       COALESCE(SUM(commission_amount), 0) AS total_earned,
       COUNT(CASE WHEN status = 'converted' THEN 1 END) AS conversions
     FROM referrals WHERE referrer_id = $1`,
    [req.user!.sub]
  );
  const referrals = await query(
    `SELECT r.id, r.status, r.commission_amount, r.created_at, u.name AS referred_name
     FROM referrals r
     JOIN users u ON r.referred_id = u.id
     WHERE r.referrer_id = $1
     ORDER BY r.created_at DESC LIMIT 20`,
    [req.user!.sub]
  );
  res.json(successResponse({
    referral_code: user?.referral_code ?? '',
    referral_link: `https://nirmalmandi.com/r/${user?.referral_code ?? ''}`,
    ...stats,
    referrals,
  }));
});

// ── GET /profile/data-export (DPDP right to access) ─────────
profileRouter.get('/data-export', async (req: Request, res: Response) => {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user!.sub]);
  const orders = await query('SELECT id, order_number, total_amount, status, created_at FROM orders WHERE buyer_id = (SELECT id FROM buyer_profiles WHERE user_id = $1)', [req.user!.sub]);
  const notifications = await query('SELECT type, title, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user!.sub]);
  res.json(successResponse({ user, orders, notifications, exported_at: new Date() }));
});
