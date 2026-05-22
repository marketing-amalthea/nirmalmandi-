import { Router, Request, Response } from 'express';
import { query, queryOne, authenticate, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminDisputesRouter = Router();

// Admin role guard
function requireAdmin(req: Request, res: Response, next: () => void): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json(errorResponse('Forbidden: admin access required', 403));
    return;
  }
  next();
}

// GET /admin/disputes
adminDisputesRouter.get('/', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;
    const { status } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`d.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM disputes d
       LEFT JOIN orders o ON d.order_id = o.id
       LEFT JOIN users u ON d.raised_by_user_id = u.id
       ${where}`,
      params
    );
    const total = parseInt((countRows[0] as any).total as string, 10);

    params.push(limit, offset);
    const rows = await query(
      `SELECT d.id, d.status, d.resolution,
              d.created_at         AS "createdAt",
              d.order_id           AS "orderId",
              d.reason, d.description,
              d.sla_deadline       AS "slaDeadline",
              u.name               AS "raisedByName",
              o.order_number       AS "orderNumber",
              o.total_amount       AS "totalAmount",
              COALESCE(bp.business_name, buyer.name, 'Unknown') AS "buyerName",
              COALESCE(sp.business_name, seller.name, 'Unknown') AS "sellerName"
       FROM disputes d
       LEFT JOIN orders o ON d.order_id = o.id
       LEFT JOIN users u ON d.raised_by_user_id = u.id
       LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
       LEFT JOIN users buyer ON bp.user_id = buyer.id
       LEFT JOIN seller_profiles sp ON o.seller_id = sp.id
       LEFT JOIN users seller ON sp.user_id = seller.id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json(successResponse({ rows, total }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
  }
});

// GET /admin/disputes/:id
adminDisputesRouter.get('/:id', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dispute = await queryOne(
      `SELECT d.id, d.status, d.resolution, d.resolution_notes, d.created_at,
              d.order_id, d.reason, d.description, d.sla_deadline,
              u.id    AS raised_by_user_id,
              u.name  AS raised_by_name,
              u.phone AS raised_by_phone,
              o.order_number, o.total_amount, o.status AS order_status
       FROM disputes d
       LEFT JOIN orders o ON d.order_id = o.id
       LEFT JOIN users u ON d.raised_by_user_id = u.id
       WHERE d.id = $1`,
      [id]
    );
    if (!dispute) {
      res.status(404).json(errorResponse('Dispute not found', 404));
      return;
    }
    res.json(successResponse(dispute));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
  }
});

// POST /admin/disputes/:id/resolve
adminDisputesRouter.post('/:id/resolve', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, notes, winningSide } = req.body as {
      resolution?: string;
      notes?: string;
      winningSide?: string;
    };

    if (!resolution) {
      res.status(400).json(errorResponse('resolution is required', 400));
      return;
    }

    const dispute = await queryOne(
      `UPDATE disputes
       SET status = 'resolved',
           resolution = $2,
           resolution_notes = $3,
           winning_side = $4,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, resolution, resolution_notes, winning_side`,
      [id, resolution, notes || null, winningSide || null]
    );
    if (!dispute) {
      res.status(404).json(errorResponse('Dispute not found', 404));
      return;
    }
    res.json(successResponse(dispute));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
  }
});
