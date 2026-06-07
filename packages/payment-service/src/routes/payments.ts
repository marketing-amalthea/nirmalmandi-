/**
 * Payment service routes.
 * Handles Razorpay order creation, webhook verification, escrow release, and payouts.
 * CRITICAL: escrow release requires buyer confirmation OR auto-timer — never admin alone.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  calculatePayout, computeGST,
  successResponse, errorResponse,
  logger,
} from '@nirmalmandi/shared';
import {
  createRazorpayOrder,
  verifyWebhookSignature,
  transferToSeller,
  issueRefund,
} from '../services/razorpay';
import axios from 'axios';

export const paymentsRouter = Router();

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-secret';

async function notify(userId: string, templateKey: string, variables: string[], title?: string) {
  await axios.post(`${NOTIFICATION_URL}/notifications/send`, {
    userId, channel: 'all', templateKey, variables, title,
  }, { headers: { 'x-service-secret': SERVICE_SECRET } }).catch(e =>
    logger.warn('Notification failed', { error: e.message })
  );
}

// ── POST /payments/initiate ───────────────────────────────────────
// Called by order-service after order record created. Returns Razorpay order_id + key.
const initiateSchema = z.object({
  orderId: z.string().uuid(),
  amountPaisa: z.number().int().positive(),
  listingId: z.string().uuid(),
  sellerId: z.string().uuid(),
});

paymentsRouter.post('/initiate', authenticate, async (req: Request, res: Response) => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', parsed.error.issues));

  const { orderId, amountPaisa, listingId, sellerId } = parsed.data;

  // Verify order belongs to this buyer
  const order = await queryOne<{ id: string; buyer_id: string; status: string }>(
    'SELECT id, buyer_id, status FROM orders WHERE id = $1',
    [orderId]
  );
  if (!order) return res.status(404).json(errorResponse('Order not found'));
  if (order.buyer_id !== req.user!.profile_id) return res.status(403).json(errorResponse('Forbidden'));
  if (order.status !== 'pending_payment') return res.status(409).json(errorResponse('Order not awaiting payment'));

  try {
    const rzpOrder = await createRazorpayOrder({ amount: amountPaisa, orderId, listingId, sellerId });

    await query(
      `UPDATE orders SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2`,
      [rzpOrder.id, orderId]
    );

    return res.json(successResponse({
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amountPaisa,
      currency: 'INR',
    }));
  } catch (err: any) {
    logger.error('Razorpay order creation failed', { error: err.message });
    return res.status(502).json(errorResponse('Payment gateway error'));
  }
});

// ── POST /payments/webhook ────────────────────────────────────────
// Razorpay sends payment events here. No auth — verified by HMAC signature.
paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Invalid Razorpay webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body.event as string;
  const payload = req.body.payload;

  logger.info('Razorpay webhook received', { event });

  if (event === 'payment.captured') {
    const payment = payload.payment.entity;
    const rzpOrderId = payment.order_id;

    await withTransaction(async (client) => {
      const order = await queryOne<{
        id: string; buyer_id: string; seller_id: string; total_amount: number;
        sector_slug: string; buyer_state: string; seller_state: string;
      }>(
        `SELECT o.id, o.buyer_id, o.seller_id, o.total_amount, o.razorpay_order_id,
                s.slug as sector_slug, bp.state as buyer_state, sp.state as seller_state
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN sectors sec ON l.sector_id = sec.id
         JOIN buyer_profiles bp ON o.buyer_id = bp.id
         JOIN seller_profiles sp ON o.seller_id = sp.id
         WHERE o.razorpay_order_id = $1`,
        [rzpOrderId]
      );
      if (!order) return;

      const payout = calculatePayout(order.total_amount, order.sector_slug);
      const gst = computeGST(payout.commission, 0.18, order.buyer_state, order.seller_state);

      // Create escrow account
      const escrowId = (await client.query(
        `INSERT INTO escrow_accounts
           (id, order_id, buyer_id, seller_id, total_amount, commission_amount,
            gst_on_commission, tcs_amount, net_payout, status, razorpay_payment_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'holding', $9)
         RETURNING id`,
        [order.id, order.buyer_id, order.seller_id,
         payout.gross_amount, payout.commission,
         gst.total_gst, payout.tcs_amount, payout.net_payout,
         payment.id]
      )).rows[0].id;

      await client.query(
        `UPDATE orders SET status = 'paid', payment_id = $1, escrow_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [payment.id, escrowId, order.id]
      );

      // Schedule auto-release after 7 days if buyer doesn't confirm
      await client.query(
        `UPDATE escrow_accounts SET auto_release_at = NOW() + INTERVAL '7 days' WHERE id = $1`,
        [escrowId]
      );
    });

    // Notify seller
    const orderFull = await queryOne<{ seller_id: string; order_number: string }>(
      'SELECT seller_id, order_number FROM orders WHERE razorpay_order_id = $1', [rzpOrderId]
    );
    if (orderFull) {
      await notify(orderFull.seller_id, 'ORDER_CONFIRMED', [orderFull.order_number]);
    }
  }

  return res.json({ received: true });
});

// ── POST /payments/confirm-delivery ───────────────────────────────
// Buyer confirms delivery → trigger escrow release immediately.
paymentsRouter.post('/confirm-delivery', authenticate, async (req: Request, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json(errorResponse('orderId required'));

  const order = await queryOne<{
    id: string; buyer_id: string; seller_id: string; status: string;
    escrow_id: string; payment_id: string; order_number: string;
  }>(
    `SELECT o.id, o.buyer_id, o.seller_id, o.status, o.escrow_id, o.payment_id, o.order_number
     FROM orders o WHERE o.id = $1`,
    [orderId]
  );

  if (!order) return res.status(404).json(errorResponse('Order not found'));
  if (order.buyer_id !== req.user!.profile_id) return res.status(403).json(errorResponse('Forbidden'));
  if (!['shipped', 'delivered'].includes(order.status)) {
    return res.status(409).json(errorResponse('Order not yet shipped'));
  }

  await releaseEscrow(order.escrow_id, order.payment_id, order.seller_id, order.id, order.order_number);
  return res.json(successResponse({ released: true, message: 'Payment released to seller' }));
});

// ── POST /payments/admin/force-release ───────────────────────────
// Admin can only release AFTER auto-timer condition OR dispute resolution.
paymentsRouter.post('/admin/force-release', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { orderId, reason } = req.body;
  if (!orderId || !reason) return res.status(400).json(errorResponse('orderId and reason required'));

  const order = await queryOne<{
    id: string; seller_id: string; status: string;
    escrow_id: string; payment_id: string; order_number: string;
  }>(
    'SELECT id, seller_id, status, escrow_id, payment_id, order_number FROM orders WHERE id = $1',
    [orderId]
  );
  if (!order) return res.status(404).json(errorResponse('Order not found'));

  const escrow = await queryOne<{ status: string; auto_release_at: string }>(
    'SELECT status, auto_release_at FROM escrow_accounts WHERE id = $1',
    [order.escrow_id]
  );
  if (!escrow || escrow.status !== 'holding') {
    return res.status(409).json(errorResponse('Escrow not in holding state'));
  }

  // Enforce: auto_release_at must have passed OR dispute_resolved flag set
  const autoReleasePassed = new Date(escrow.auto_release_at) < new Date();
  if (!autoReleasePassed) {
    return res.status(403).json(errorResponse(
      'Cannot force-release before auto-release timer expires. Resolve dispute first.'
    ));
  }

  await releaseEscrow(order.escrow_id, order.payment_id, order.seller_id, order.id, order.order_number);
  logger.info('Admin force-released escrow', { orderId, adminId: req.user!.sub, reason });
  return res.json(successResponse({ released: true }));
});

// ── POST /payments/admin/refund ───────────────────────────────────
// Refund buyer — dispute resolution outcome.
paymentsRouter.post('/admin/refund', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { orderId, reason } = req.body;
  if (!orderId || !reason) return res.status(400).json(errorResponse('orderId and reason required'));

  const order = await queryOne<{
    id: string; buyer_id: string; payment_id: string; total_amount: number;
    escrow_id: string; order_number: string;
  }>(
    'SELECT id, buyer_id, payment_id, total_amount, escrow_id, order_number FROM orders WHERE id = $1',
    [orderId]
  );
  if (!order || !order.payment_id) return res.status(404).json(errorResponse('Order or payment not found'));

  await withTransaction(async (client) => {
    await issueRefund(order.payment_id, order.total_amount * 100, reason);
    await client.query(
      `UPDATE escrow_accounts SET status = 'refunded', released_at = NOW() WHERE id = $1`,
      [order.escrow_id]
    );
    await client.query(
      `UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
      [order.id]
    );
  });

  await notify(order.buyer_id, 'ORDER_PLACED', [order.order_number, 'Refund processed'], 'Refund Issued');
  logger.info('Admin issued refund', { orderId, adminId: req.user!.sub, reason });
  return res.json(successResponse({ refunded: true }));
});

// ── GET /payments/escrow/:orderId ────────────────────────────────
paymentsRouter.get('/escrow/:orderId', authenticate, async (req: Request, res: Response) => {
  const order = await queryOne<{ buyer_id: string; seller_id: string; escrow_id: string }>(
    'SELECT buyer_id, seller_id, escrow_id FROM orders WHERE id = $1',
    [req.params.orderId]
  );
  if (!order) return res.status(404).json(errorResponse('Order not found'));

  const isParty = [order.buyer_id, order.seller_id].includes(req.user!.profile_id);
  const isAdmin = req.user!.role === 'admin';
  if (!isParty && !isAdmin) return res.status(403).json(errorResponse('Forbidden'));

  const escrow = await queryOne(
    'SELECT * FROM escrow_accounts WHERE id = $1',
    [order.escrow_id]
  );
  return res.json(successResponse(escrow));
});

// ── Helper ───────────────────────────────────────────────────────

async function releaseEscrow(
  escrowId: string, paymentId: string, sellerId: string,
  orderId: string, orderNumber: string
) {
  const escrow = await queryOne<{
    net_payout: number; status: string;
  }>('SELECT net_payout, status FROM escrow_accounts WHERE id = $1', [escrowId]);

  if (!escrow || escrow.status !== 'holding') {
    throw new Error('Escrow not in holding state');
  }

  // Get seller's linked account
  const seller = await queryOne<{ razorpay_linked_account_id: string | null; bank_account_verified: boolean }>(
    'SELECT razorpay_linked_account_id, bank_account_verified FROM seller_profiles WHERE id = $1',
    [sellerId]
  );

  if (!seller?.razorpay_linked_account_id || !seller.bank_account_verified) {
    throw new Error('Seller bank account not verified');
  }

  await withTransaction(async (client) => {
    // Transfer via Razorpay Route
    await transferToSeller({
      paymentId,
      sellerLinkedAccountId: seller.razorpay_linked_account_id!,
      amount: Math.round(escrow.net_payout * 100), // in paisa
      orderId,
    });

    await client.query(
      `UPDATE escrow_accounts SET status = 'released', released_at = NOW() WHERE id = $1`,
      [escrowId]
    );
    await client.query(
      `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
  });

  await notify(sellerId, 'PAYMENT_RELEASED', [escrow.net_payout.toString(), orderNumber]);
  logger.info('Escrow released', { escrowId, sellerId, amount: escrow.net_payout });
}
