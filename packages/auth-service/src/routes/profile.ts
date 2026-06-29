import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';
import bcrypt from 'bcryptjs';

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
              bp.sector_interests, bp.total_purchases, bp.ai_credits_balance, bp.referral_earnings,
              bp.city, bp.state
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
    language_preference: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'mr', 'bn', 'gu']).optional(),
    // seller profile fields
    business_name: z.string().min(2).max(255).optional(),
    business_type: z.enum(['manufacturer', 'distributor', 'retailer', 'wholesaler']).optional(),
    gst_number: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    address_line1: z.string().optional(),
    pincode: z.string().optional(),
    // notification preferences (stored as JSON in users table if column exists, else silently ignored)
    notification_prefs: z.record(z.boolean()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse(parsed.error.errors[0].message));
    return;
  }
  const { business_name, business_type, gst_number, city, state, address_line1, pincode, notification_prefs, ...userUpdates } = parsed.data;

  // Update users table
  const userFields = Object.keys(userUpdates).filter(k => userUpdates[k as keyof typeof userUpdates] !== undefined);
  if (userFields.length) {
    const setClauses = userFields.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await query(
      `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
      [req.user!.sub, ...userFields.map(k => userUpdates[k as keyof typeof userUpdates])]
    );
  }

  // Update role-specific profile table
  if (req.user!.role === 'seller') {
    const spUpdates: Record<string, unknown> = {};
    if (business_name !== undefined) spUpdates.business_name = business_name;
    if (business_type !== undefined) spUpdates.business_type = business_type;
    if (gst_number !== undefined) spUpdates.gst_number = gst_number;
    if (city !== undefined) spUpdates.city = city;
    if (state !== undefined) spUpdates.state = state;
    if (address_line1 !== undefined) spUpdates.address_line1 = address_line1;
    if (pincode !== undefined) spUpdates.pincode = pincode;

    if (Object.keys(spUpdates).length) {
      const spFields = Object.keys(spUpdates).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await query(
        `UPDATE seller_profiles SET ${spFields}, updated_at = NOW() WHERE user_id = $1`,
        [req.user!.sub, ...Object.values(spUpdates)]
      );
    }
  } else if (req.user!.role === 'buyer') {
    // Buyers can update city/state on their buyer_profile
    const bpUpdates: Record<string, unknown> = {};
    if (city !== undefined) bpUpdates.city = city;
    if (state !== undefined) bpUpdates.state = state;

    if (Object.keys(bpUpdates).length) {
      const bpFields = Object.keys(bpUpdates).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await query(
        `UPDATE buyer_profiles SET ${bpFields} WHERE user_id = $1`,
        [req.user!.sub, ...Object.values(bpUpdates)]
      ).catch(() => { /* city/state columns may not exist — silently ignore */ });
    }
  }

  res.json(successResponse({ message: 'Profile updated' }));
});

// ── PATCH /auth/password ─────────────────────────────────────
profileRouter.patch('/password', async (req: Request, res: Response) => {
  const schema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse(parsed.error.errors[0].message));
    return;
  }
  const { current_password, new_password } = parsed.data;

  const user = await queryOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user!.sub]
  );
  if (!user?.password_hash) {
    res.status(400).json(errorResponse('No password set — use forgot password to set one'));
    return;
  }

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) {
    res.status(401).json(errorResponse('Current password is incorrect'));
    return;
  }

  const new_hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [new_hash, req.user!.sub]);
  res.json(successResponse({ message: 'Password changed successfully' }));
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
