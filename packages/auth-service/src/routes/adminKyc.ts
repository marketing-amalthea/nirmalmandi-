import { Router, Request, Response } from 'express';
import { authenticate, requireRole, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminKycRouter = Router();

const requireAdmin = requireRole('admin', 'super_admin');

// GET /admin/kyc — list sellers by KYC status
adminKycRouter.get('/', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const offset = (page - 1) * limit;

  const where = status ? `WHERE sp.kyc_status = $3` : '';
  const params: (string | number)[] = [limit, offset];
  if (status) params.push(status);

  const rows = await query(
    `SELECT sp.id, sp.business_name, sp.gst_number, sp.kyc_status, sp.kyc_rejection_reason,
            sp.verification_tier, u.name, u.email, u.phone, sp.created_at, sp.updated_at
     FROM seller_profiles sp
     JOIN users u ON u.id = sp.user_id
     ${where}
     ORDER BY sp.updated_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM seller_profiles sp ${status ? 'WHERE sp.kyc_status = $1' : ''}`,
    status ? [status] : []
  );

  res.json(successResponse({ data: rows, total: parseInt(count, 10), page, limit }));
});

// GET /admin/kyc/stats
adminKycRouter.get('/stats', authenticate, requireAdmin as never, async (_req, res: Response) => {
  const rows = await query<{ kyc_status: string; count: string }>(
    `SELECT kyc_status, COUNT(*) AS count FROM seller_profiles GROUP BY kyc_status`
  );
  const stats = Object.fromEntries(rows.map(r => [r.kyc_status, parseInt(r.count, 10)]));
  res.json(successResponse(stats));
});

// GET /admin/kyc/pending-count
adminKycRouter.get('/pending-count', authenticate, requireAdmin as never, async (_req, res: Response) => {
  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM seller_profiles WHERE kyc_status IN ('pending','in_review')`
  );
  res.json(successResponse({ count: parseInt(count, 10) }));
});

// POST /admin/kyc/:id/review — approve or reject
adminKycRouter.post('/:id/review', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const { status, note } = req.body as { status: string; note?: string };
  if (!['approved', 'rejected', 'in_review'].includes(status)) {
    return res.status(400).json(errorResponse('status must be approved, rejected or in_review'));
  }

  const sp = await queryOne('SELECT id FROM seller_profiles WHERE id = $1', [req.params.id]);
  if (!sp) return res.status(404).json(errorResponse('Seller not found'));

  await query(
    `UPDATE seller_profiles
     SET kyc_status = $1, kyc_rejection_reason = $2, updated_at = NOW()
     WHERE id = $3`,
    [status, note ?? null, req.params.id]
  );

  // Promote verification_tier on approval
  if (status === 'approved') {
    await query(
      `UPDATE seller_profiles SET verification_tier = 'verified', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
  }

  res.json(successResponse({ message: `KYC ${status}` }));
});
