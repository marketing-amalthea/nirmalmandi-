import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  reserveStock, releaseStockReservation,
  calculatePayout, computeGST,
  successResponse, errorResponse,
  generateOrderNumber,
  logger,
} from '@nirmalmandi/shared';
import { GST_RATES } from '@nirmalmandi/shared';

export const ordersRouter = Router();

// ── Helpers ─────────────────────────────────────────────────────

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  status: string;
  available_quantity: number;
  asking_price: number;
  sector_slug: string;
  state: string;
  city: string;
  logistics_type?: string;
}

interface SellerProfileRow {
  id: string;
  user_id: string;
  state: string;
}

interface BuyerAddressRow {
  id: string;
  state: string;
  city: string;
  full_address: string;
  pincode: string;
}

async function getDelhiveryFreightEstimate(
  originPincode: string,
  destPincode: string,
  weightKg: number
): Promise<number> {
  try {
    const response = await axios.get('https://track.delhivery.com/api/kinko/v1/invoice/charges/.json', {
      params: {
        md: 'S',
        ss: 'Delivered',
        d_pin: destPincode,
        o_pin: originPincode,
        cgm: weightKg * 1000, // grams
        pt: 'Pre-paid',
        cod: 0,
      },
      headers: {
        Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    const charges = response.data?.[0]?.total_amount;
    return typeof charges === 'number' ? charges : 0;
  } catch (err) {
    logger.warn('Delhivery freight estimate failed, defaulting to 0', { error: (err as Error).message });
    return 0;
  }
}

async function emitNotification(payload: Record<string, unknown>): Promise<void> {
  try {
    await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'}/notifications/send`,
      payload,
      { timeout: 3000 }
    );
  } catch (err) {
    logger.warn('Notification emit failed', { error: (err as Error).message });
  }
}

// ── POST /orders — create order ──────────────────────────────────
const createOrderSchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  delivery_address_id: z.string().uuid().optional(),
  logistics_type: z.enum(['seller_ship', 'platform_logistics', 'buyer_pickup']).default('platform_logistics'),
  payment_method: z.enum(['upi', 'neft', 'rtgs', 'card']).default('upi'),
});

ordersRouter.post(
  '/',
  authenticate,
  requireRole('buyer'),
  async (req: Request, res: Response) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, 'VALIDATION_ERROR'));
      return;
    }

    const { listing_id, quantity, delivery_address_id, logistics_type, payment_method } = parsed.data;
    const buyer_id = req.user!.profile_id;

    // 1. Validate listing
    const listing = await queryOne<ListingRow>(
      `SELECT l.id, l.seller_id, l.title, l.status, l.available_quantity, l.asking_price,
              s.slug AS sector_slug, l.state, l.city
       FROM listings l
       JOIN sectors s ON s.id = l.sector_id
       WHERE l.id = $1`,
      [listing_id]
    );

    if (!listing || listing.status !== 'live') {
      res.status(404).json(errorResponse('Listing not found or not available', 'LISTING_UNAVAILABLE'));
      return;
    }

    if (listing.available_quantity < quantity) {
      res.status(400).json(errorResponse(
        `Only ${listing.available_quantity} units available`,
        'INSUFFICIENT_STOCK'
      ));
      return;
    }

    // 2. Reserve stock in Redis (15-minute hold)
    const orderId = uuidv4();
    const reserved = await reserveStock(listing_id, quantity, orderId);
    if (!reserved) {
      res.status(409).json(errorResponse('Stock currently reserved by another buyer, please try again shortly', 'STOCK_RESERVED'));
      return;
    }

    try {
      // 3. Fetch seller state for GST calc
      const sellerProfile = await queryOne<SellerProfileRow>(
        `SELECT sp.id, sp.user_id, a.state
         FROM seller_profiles sp
         LEFT JOIN addresses a ON a.user_id = sp.user_id AND a.is_primary = true
         WHERE sp.id = $1`,
        [listing.seller_id]
      );

      // 4. Fetch buyer delivery address state
      let buyerState = 'unknown';
      let destPincode = '000000';
      if (delivery_address_id) {
        const addr = await queryOne<BuyerAddressRow>(
          'SELECT id, state, pincode FROM addresses WHERE id = $1',
          [delivery_address_id]
        );
        if (addr) {
          buyerState = addr.state;
          destPincode = addr.pincode;
        }
      }

      const sellerState = sellerProfile?.state ?? 'unknown';

      // 5. Delhivery freight estimate
      const freight_amount = await getDelhiveryFreightEstimate('110001', destPincode, quantity * 0.5);

      // 6. Financial calculations
      const subtotal = parseFloat((listing.asking_price * quantity).toFixed(2));
      const payout = calculatePayout(subtotal, listing.sector_slug);
      const gstRate = GST_RATES[listing.sector_slug] ?? GST_RATES.default;
      const gstCalc = computeGST(subtotal, gstRate, buyerState, sellerState);
      const gst_amount = gstCalc.total_gst;
      const total_amount = parseFloat((subtotal + gst_amount + freight_amount).toFixed(2));

      // 7. Create order + escrow in a transaction
      const result = await withTransaction(async (client) => {
        const order_number = generateOrderNumber();
        const escrow_id = uuidv4();

        // Insert order
        await client.query(
          `INSERT INTO orders
            (id, order_number, buyer_id, seller_id, listing_id, quantity, unit_price,
             subtotal, platform_commission, commission_rate, gst_amount, freight_amount,
             total_amount, status, payment_method, escrow_id, delivery_address_id, logistics_type)
           VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'payment_pending',$14,$15,$16,$17)`,
          [
            orderId, order_number, buyer_id, listing.seller_id, listing_id,
            quantity, listing.asking_price, subtotal, payout.commission,
            payout.commission_rate, gst_amount, freight_amount, total_amount,
            payment_method, escrow_id, delivery_address_id ?? null, logistics_type,
          ]
        );

        // Insert escrow account
        await client.query(
          `INSERT INTO escrow_accounts
            (id, order_id, amount, commission, gst_on_commission, tcs_amount, net_payout, status, razorpay_order_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending','')`,
          [
            escrow_id, orderId, total_amount, payout.commission,
            payout.gst_on_commission, payout.tcs_amount, payout.net_payout,
          ]
        );

        // Decrement available_quantity
        await client.query(
          'UPDATE listings SET available_quantity = available_quantity - $1 WHERE id = $2',
          [quantity, listing_id]
        );

        return {
          order_id: orderId,
          order_number,
          escrow_id,
          subtotal,
          platform_commission: payout.commission,
          gst_amount,
          freight_amount,
          total_amount,
        };
      });

      // 8. Create Razorpay order via payment-service (internal call)
      let razorpay_order_id: string | null = null;
      try {
        const rzpRes = await axios.post(
          `${process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004'}/payments/initiate`,
          {
            orderId,
            amountPaisa: Math.round(total_amount * 100),
            listingId: listing_id,
            sellerId: listing.seller_id,
          },
          {
            headers: { Authorization: req.headers.authorization },
            timeout: 8000,
          }
        );
        razorpay_order_id = rzpRes.data?.data?.razorpayOrderId ?? null;
      } catch (rzpErr) {
        logger.warn('Could not pre-create Razorpay order', { error: (rzpErr as Error).message });
      }

      res.status(201).json(successResponse({
        ...result,
        razorpay_order_id,
        listing_title: listing.title,
      }, 'Order created successfully'));
    } catch (err) {
      // Release stock reservation on any failure
      await releaseStockReservation(listing_id);
      logger.error('Order creation failed', { error: (err as Error).message });
      res.status(500).json(errorResponse('Failed to create order', 'ORDER_CREATE_ERROR'));
    }
  }
);

// ── GET /orders/my/buyer — list buyer orders ─────────────────────
ordersRouter.get(
  '/my/buyer',
  authenticate,
  requireRole('buyer'),
  async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const offset = (page - 1) * limit;

    const orders = await query(
      `SELECT o.*, l.title AS listing_title, l.images[1] AS listing_image
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.profile_id, limit, offset]
    );

    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) FROM orders WHERE buyer_id = $1',
      [req.user!.profile_id]
    );

    res.json(successResponse({ orders, total: parseInt(count, 10), page, limit }));
  }
);

// ── GET /orders/my/seller — list seller orders ───────────────────
ordersRouter.get(
  '/my/seller',
  authenticate,
  requireRole('seller'),
  async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const offset = (page - 1) * limit;

    const orders = await query(
      `SELECT o.*, l.title AS listing_title, l.images[1] AS listing_image,
              bp.business_name AS buyer_business_name
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       LEFT JOIN buyer_profiles bp ON bp.id = o.buyer_id
       WHERE o.seller_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.profile_id, limit, offset]
    );

    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) FROM orders WHERE seller_id = $1',
      [req.user!.profile_id]
    );

    res.json(successResponse({ orders, total: parseInt(count, 10), page, limit }));
  }
);

// ── GET /orders/:id — get order detail ──────────────────────────
ordersRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response) => {
    const order = await queryOne<{
      id: string; buyer_id: string; seller_id: string; escrow_id: string;
    }>(
      `SELECT o.*, l.title AS listing_title, l.images AS listing_images,
              l.state AS listing_state, l.city AS listing_city,
              ea.status AS escrow_status, ea.razorpay_order_id,
              ea.razorpay_payment_id, ea.funded_at, ea.released_at
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       LEFT JOIN escrow_accounts ea ON ea.id = o.escrow_id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (!order) {
      res.status(404).json(errorResponse('Order not found', 'NOT_FOUND'));
      return;
    }

    const profileId = req.user!.profile_id;
    if (order.buyer_id !== profileId && order.seller_id !== profileId && req.user!.role !== 'admin') {
      res.status(403).json(errorResponse('Access denied', 'FORBIDDEN'));
      return;
    }

    res.json(successResponse(order));
  }
);

// ── PATCH /orders/:id/confirm-delivery ──────────────────────────
ordersRouter.patch(
  '/:id/confirm-delivery',
  authenticate,
  requireRole('buyer'),
  async (req: Request, res: Response) => {
    const order = await queryOne<{ id: string; buyer_id: string; seller_id: string; status: string; escrow_id: string }>(
      'SELECT id, buyer_id, seller_id, status, escrow_id FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (!order) {
      res.status(404).json(errorResponse('Order not found', 'NOT_FOUND'));
      return;
    }

    if (order.buyer_id !== req.user!.profile_id) {
      res.status(403).json(errorResponse('Access denied', 'FORBIDDEN'));
      return;
    }

    if (!['shipped', 'payment_confirmed', 'confirmed'].includes(order.status)) {
      res.status(400).json(errorResponse(
        `Cannot confirm delivery for order in status: ${order.status}`,
        'INVALID_STATUS'
      ));
      return;
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
    });

    // Emit escrow release trigger to notification/payment queue
    await emitNotification({
      type: 'escrow_release_trigger',
      escrow_id: order.escrow_id,
      order_id: order.id,
      triggered_by: 'buyer_confirmation',
      seller_id: order.seller_id,
      buyer_id: order.buyer_id,
    });

    // Trigger escrow release via payment-service
    try {
      await axios.post(
        `${process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004'}/payments/confirm-delivery`,
        { orderId: order.id },
        {
          headers: { Authorization: req.headers.authorization },
          timeout: 8000,
        }
      );
    } catch (err) {
      logger.warn('Auto escrow release after delivery confirmation failed', { error: (err as Error).message });
    }

    res.json(successResponse({ order_id: order.id, status: 'delivered' }, 'Delivery confirmed'));
  }
);

// ── PATCH /orders/:id/cancel ─────────────────────────────────────
ordersRouter.patch(
  '/:id/cancel',
  authenticate,
  async (req: Request, res: Response) => {
    const order = await queryOne<{
      id: string; buyer_id: string; seller_id: string; status: string;
      listing_id: string; quantity: number; escrow_id: string;
    }>(
      'SELECT id, buyer_id, seller_id, status, listing_id, quantity, escrow_id FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (!order) {
      res.status(404).json(errorResponse('Order not found', 'NOT_FOUND'));
      return;
    }

    const profileId = req.user!.profile_id;
    if (order.buyer_id !== profileId && order.seller_id !== profileId && req.user!.role !== 'admin') {
      res.status(403).json(errorResponse('Access denied', 'FORBIDDEN'));
      return;
    }

    if (order.status !== 'payment_pending') {
      res.status(400).json(errorResponse(
        `Order cannot be cancelled in status: ${order.status}`,
        'INVALID_STATUS'
      ));
      return;
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );

      await client.query(
        `UPDATE escrow_accounts SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [order.escrow_id]
      );

      // Restore available_quantity
      await client.query(
        'UPDATE listings SET available_quantity = available_quantity + $1 WHERE id = $2',
        [order.quantity, order.listing_id]
      );
    });

    // Release Redis reservation
    await releaseStockReservation(order.listing_id);

    res.json(successResponse({ order_id: order.id, status: 'cancelled' }, 'Order cancelled'));
  }
);

// ── PATCH /orders/:id/ship — seller marks order shipped ─────────
ordersRouter.patch(
  '/:id/ship',
  authenticate,
  requireRole('seller'),
  async (req: Request, res: Response) => {
    const { tracking_number, courier } = req.body as { tracking_number?: string; courier?: string };
    const order = await queryOne<{ id: string; seller_id: string; buyer_id: string; status: string }>(
      'SELECT id, seller_id, buyer_id, status FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (!order) return res.status(404).json(errorResponse('Order not found', 'NOT_FOUND'));
    if (order.seller_id !== req.user!.profile_id) return res.status(403).json(errorResponse('Access denied', 'FORBIDDEN'));
    if (!['paid', 'payment_confirmed', 'confirmed', 'payment_received'].includes(order.status)) {
      return res.status(409).json(errorResponse(`Cannot ship order in status: ${order.status}`, 'INVALID_STATUS'));
    }

    await query(
      `UPDATE orders SET status = 'shipped',
       tracking_number = COALESCE($2, tracking_number),
       courier = COALESCE($3, courier),
       updated_at = NOW() WHERE id = $1`,
      [order.id, tracking_number ?? null, courier ?? null]
    );

    await emitNotification({
      type: 'order_shipped',
      order_id: order.id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      tracking_number,
      courier,
    });

    res.json(successResponse({ order_id: order.id, status: 'shipped', tracking_number, courier }));
  }
);

// ── GET /seller/payouts — seller payout history ──────────────────
ordersRouter.get(
  '/seller/payouts',
  authenticate,
  requireRole('seller'),
  async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const offset = (page - 1) * limit;

    const rows = await query(
      `SELECT p.*, o.order_number, l.title AS listing_title
       FROM payouts p
       JOIN orders o ON o.id = p.order_id
       JOIN listings l ON l.id = o.listing_id
       WHERE p.seller_id = $1
       ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.profile_id, limit, offset]
    );

    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) FROM payouts WHERE seller_id = $1',
      [req.user!.profile_id]
    );

    res.json(successResponse({ payouts: rows, total: parseInt(count, 10), page, limit }));
  }
);

// ── GET /seller/escrow-status — seller escrow summary ───────────
ordersRouter.get(
  '/seller/escrow-status',
  authenticate,
  requireRole('seller'),
  async (req: Request, res: Response) => {
    const rows = await query<{ escrow_status: string; count: string; total: string }>(
      `SELECT ea.status AS escrow_status, COUNT(*) AS count, COALESCE(SUM(ea.net_payout),0) AS total
       FROM escrow_accounts ea
       JOIN orders o ON o.id = ea.order_id
       WHERE o.seller_id = $1
       GROUP BY ea.status`,
      [req.user!.profile_id]
    );
    const byStatus = Object.fromEntries(
      rows.map(r => [r.escrow_status, { count: parseInt(r.count, 10), total: parseFloat(r.total) }])
    );
    res.json(successResponse(byStatus));
  }
);
