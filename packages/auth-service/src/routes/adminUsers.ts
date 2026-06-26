import { Router, Request, Response } from 'express';
import { query, queryOne, authenticate, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminUsersRouter = Router();

// Admin role guard
function requireAdmin(req: Request, res: Response, next: () => void): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json(errorResponse('Forbidden: admin access required', String(403)));
    return;
  }
  next();
}

// GET /admin/users
adminUsersRouter.get('/', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;
    const { role, status, search } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (role) {
      conditions.push(`u.role = $${idx++}`);
      params.push(role);
    }
    if (status) {
      conditions.push(`u.status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.phone ILIKE $${idx} OR sp.business_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM users u LEFT JOIN seller_profiles sp ON sp.user_id = u.id ${where}`,
      params
    );
    const total = parseInt((countRows[0] as any).total as string, 10);

    params.push(limit, offset);
    const rows = await query(
      `SELECT u.id, u.phone, u.role, u.status,
              u.name           AS "fullName",
              u.created_at     AS "createdAt",
              COALESCE(sp.kyc_status, 'n/a')        AS "kycStatus",
              COALESCE(sp.verification_tier, 'n/a') AS "verificationTier",
              sp.business_name AS "businessName",
              sp.gst_number    AS "gstin",
              (sp.bank_account_id IS NOT NULL) AS "bankAccountVerified"
       FROM users u
       LEFT JOIN seller_profiles sp ON sp.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json(successResponse({ rows, total }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// PATCH /admin/users/:id/activate
adminUsersRouter.patch('/:id/activate', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await queryOne(
      `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING id, name, phone, role, status`,
      [id]
    );
    if (!user) {
      res.status(404).json(errorResponse('User not found', String(404)));
      return;
    }
    res.json(successResponse(user));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// PATCH /admin/users/:id/suspend
adminUsersRouter.patch('/:id/suspend', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const user = await queryOne(
      `UPDATE users SET status = 'suspended', suspend_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING id, name, phone, role, status`,
      [id, reason || null]
    );
    if (!user) {
      res.status(404).json(errorResponse('User not found', String(404)));
      return;
    }
    res.json(successResponse(user));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// PATCH /admin/users/:id/ban
adminUsersRouter.patch('/:id/ban', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const user = await queryOne(
      `UPDATE users SET status = 'banned', ban_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING id, name, phone, role, status`,
      [id, reason || null]
    );
    if (!user) {
      res.status(404).json(errorResponse('User not found', String(404)));
      return;
    }
    res.json(successResponse(user));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// GET /admin/users/:id/kyc — placeholder
adminUsersRouter.get('/:id/kyc', authenticate, requireAdmin as any, async (_req: Request, res: Response) => {
  res.json(successResponse([]));
});
