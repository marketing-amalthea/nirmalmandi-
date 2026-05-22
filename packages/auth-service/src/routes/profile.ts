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

// ── GET /profile/data-export (DPDP right to access) ─────────
profileRouter.get('/data-export', async (req: Request, res: Response) => {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user!.sub]);
  const orders = await query('SELECT id, order_number, total_amount, status, created_at FROM orders WHERE buyer_id = (SELECT id FROM buyer_profiles WHERE user_id = $1)', [req.user!.sub]);
  const notifications = await query('SELECT type, title, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user!.sub]);
  res.json(successResponse({ user, orders, notifications, exported_at: new Date() }));
});
