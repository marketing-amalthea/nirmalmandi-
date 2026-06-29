import { Router, Request, Response } from 'express';
import { query, queryOne, authenticate, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminOrdersRouter = Router();

// Admin role guard
function requireAdmin(req: Request, res: Response, next: () => void): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json(errorResponse('Forbidden: admin access required', String(403)));
    return;
  }
  next();
}

// GET /admin/transactions
adminOrdersRouter.get('/', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;
    const { status, search } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`o.status = $${idx++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(o.order_number ILIKE $${idx} OR buyer.name ILIKE $${idx} OR seller.name ILIKE $${idx} OR l.title ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
       LEFT JOIN users buyer ON bp.user_id = buyer.id
       LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
       LEFT JOIN users seller ON sp.user_id = seller.id
       ${where}`,
      params
    );
    const total = parseInt((countRows[0] as any).total as string, 10);

    params.push(limit, offset);
    const rows = await query(
      `SELECT o.id,
              o.order_number        AS "orderNumber",
              o.status,
              o.total_amount        AS "totalAmount",
              o.platform_commission AS "commissionAmount",
              o.created_at          AS "createdAt",
              ea.razorpay_payment_id AS "paymentId",
              COALESCE(bp.business_name, buyer.name, 'Unknown') AS "buyerName",
              COALESCE(sp.business_name, seller.name, 'Unknown') AS "sellerName",
              l.title               AS "listingTitle",
              ea.status             AS "escrowStatus"
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
       LEFT JOIN users buyer ON bp.user_id = buyer.id
       LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
       LEFT JOIN users seller ON sp.user_id = seller.id
       LEFT JOIN escrow_accounts ea ON ea.id = o.escrow_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json(successResponse({ rows, total }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// GET /admin/transactions/:id
adminOrdersRouter.get('/:id', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await queryOne(
      `SELECT o.id, o.order_number, o.status, o.total_amount, o.platform_fee, o.created_at,
              buyer.id    AS buyer_user_id,
              buyer.name  AS buyer_name,
              buyer.phone AS buyer_phone,
              seller.id   AS seller_user_id,
              seller.name AS seller_name,
              seller.phone AS seller_phone,
              l.id    AS listing_id,
              l.title AS listing_title,
              l.asking_price
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
       LEFT JOIN users buyer ON bp.user_id = buyer.id
       LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
       LEFT JOIN users seller ON sp.user_id = seller.id
       WHERE o.id = $1`,
      [id]
    );
    if (!order) {
      res.status(404).json(errorResponse('Order not found', String(404)));
      return;
    }
    res.json(successResponse(order));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// PATCH /admin/transactions/:id/escrow/freeze
adminOrdersRouter.patch('/:id/escrow/freeze', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await queryOne(
      `UPDATE orders SET status = 'disputed', updated_at = NOW() WHERE id = $1 RETURNING id, order_number, status`,
      [id]
    );
    if (!order) {
      res.status(404).json(errorResponse('Order not found', String(404)));
      return;
    }
    res.json(successResponse(order));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});

// PATCH /admin/transactions/:id/escrow/release
adminOrdersRouter.patch('/:id/escrow/release', authenticate, requireAdmin as any, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await queryOne(
      `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING id, order_number, status`,
      [id]
    );
    if (!order) {
      res.status(404).json(errorResponse('Order not found', String(404)));
      return;
    }
    res.json(successResponse(order));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', String(500)));
  }
});
