import { Router, Request, Response } from 'express';
import { query, authenticate, successResponse, errorResponse } from '@nirmalmandi/shared';

export const cartRouter = Router();

// GET /cart — fetch current user's cart items (listings they've expressed intent to buy)
cartRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT o.id, o.listing_id, o.quantity, o.total_amount, o.status, o.created_at,
              l.title, l.asking_price_per_unit, l.currency
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       WHERE o.buyer_id = (SELECT id FROM buyer_profiles WHERE user_id = $1)
         AND o.status = 'pending'
       ORDER BY o.created_at DESC`,
      [req.user!.sub]
    );
    res.json(successResponse(rows));
  } catch (err) {
    res.status(500).json(errorResponse('Failed to fetch cart'));
  }
});

// DELETE /cart/:orderId — remove pending order (cancel before payment)
cartRouter.delete('/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1
         AND buyer_id = (SELECT id FROM buyer_profiles WHERE user_id = $2)
         AND status = 'pending'`,
      [req.params.orderId, req.user!.sub]
    );
    if ((result as unknown as { rowCount: number }).rowCount === 0) {
      res.status(404).json(errorResponse('Order not found or cannot be cancelled'));
      return;
    }
    res.json(successResponse({ message: 'Order cancelled' }));
  } catch (err) {
    res.status(500).json(errorResponse('Failed to cancel order'));
  }
});
