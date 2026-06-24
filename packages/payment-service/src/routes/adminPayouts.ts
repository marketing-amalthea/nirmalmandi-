import { Router, Request, Response } from 'express';
import { authenticate, requireRole, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminPayoutsRouter = Router();

const requireAdmin = requireRole('admin', 'super_admin');

// GET /admin/payouts
adminPayoutsRouter.get('/', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const offset = (page - 1) * limit;

  const where = status ? `WHERE p.status = $3` : '';
  const params: (string | number)[] = [limit, offset];
  if (status) params.push(status);

  const rows = await query(
    `SELECT p.*, sp.business_name AS seller_business,
            u.name AS seller_name, u.email AS seller_email
     FROM payouts p
     JOIN seller_profiles sp ON sp.id = p.seller_id
     JOIN users u ON u.id = sp.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM payouts ${status ? 'WHERE status = $1' : ''}`,
    status ? [status] : []
  );

  res.json(successResponse({ data: rows, total: parseInt(count, 10), page, limit }));
});

// GET /admin/payouts/stats
adminPayoutsRouter.get('/stats', authenticate, requireAdmin as never, async (_req, res: Response) => {
  const rows = await query<{ status: string; count: string; total: string }>(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(net_amount), 0) AS total
     FROM payouts GROUP BY status`
  );
  const byStatus = Object.fromEntries(
    rows.map(r => [r.status, { count: parseInt(r.count, 10), total: parseFloat(r.total) }])
  );
  const [totals] = await query<{ total_due: string; total_paid: string }>(
    `SELECT COALESCE(SUM(CASE WHEN status='scheduled' THEN net_amount ELSE 0 END),0) AS total_due,
            COALESCE(SUM(CASE WHEN status='completed' THEN net_amount ELSE 0 END),0) AS total_paid
     FROM payouts`
  );
  res.json(successResponse({ byStatus, totalDue: parseFloat(totals.total_due), totalPaid: parseFloat(totals.total_paid) }));
});

// POST /admin/payouts/:id/approve
adminPayoutsRouter.post('/:id/approve', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const p = await queryOne('SELECT id, status FROM payouts WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json(errorResponse('Payout not found'));
  await query(`UPDATE payouts SET status='processing', updated_at=NOW() WHERE id=$1`, [req.params.id]);
  res.json(successResponse({ message: 'Payout approved for processing' }));
});

// POST /admin/payouts/:id/hold
adminPayoutsRouter.post('/:id/hold', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const p = await queryOne('SELECT id FROM payouts WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json(errorResponse('Payout not found'));
  await query(
    `UPDATE payouts SET status='held', failure_reason=$2, updated_at=NOW() WHERE id=$1`,
    [req.params.id, reason ?? 'Held by admin']
  );
  res.json(successResponse({ message: 'Payout held' }));
});

// POST /admin/payouts/:id/release
adminPayoutsRouter.post('/:id/release', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const p = await queryOne('SELECT id FROM payouts WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json(errorResponse('Payout not found'));
  await query(`UPDATE payouts SET status='scheduled', failure_reason=NULL, updated_at=NOW() WHERE id=$1`, [req.params.id]);
  res.json(successResponse({ message: 'Payout released to queue' }));
});

// POST /admin/payouts/:id/process
adminPayoutsRouter.post('/:id/process', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const p = await queryOne('SELECT id FROM payouts WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json(errorResponse('Payout not found'));
  await query(
    `UPDATE payouts SET status='completed', processed_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [req.params.id]
  );
  res.json(successResponse({ message: 'Payout marked completed' }));
});

// POST /admin/payouts/bulk-approve
adminPayoutsRouter.post('/bulk-approve', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(errorResponse('ids required'));
  await query(
    `UPDATE payouts SET status='processing', updated_at=NOW() WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  res.json(successResponse({ updated: ids.length }));
});

// POST /admin/payouts/bulk-hold
adminPayoutsRouter.post('/bulk-hold', authenticate, requireAdmin as never, async (req: Request, res: Response) => {
  const { ids, reason } = req.body as { ids: string[]; reason?: string };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(errorResponse('ids required'));
  await query(
    `UPDATE payouts SET status='held', failure_reason=$2, updated_at=NOW() WHERE id = ANY($1::uuid[])`,
    [ids, reason ?? 'Bulk hold by admin']
  );
  res.json(successResponse({ updated: ids.length }));
});
