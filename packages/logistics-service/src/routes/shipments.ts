import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  successResponse, errorResponse, logger,
} from '@nirmalmandi/shared';

export const shipmentsRouter = Router();

// ── POST /shipments — seller creates shipment ────────────────
shipmentsRouter.post(
  '/',
  authenticate,
  requireRole('seller'),
  async (req: Request, res: Response) => {
    const { order_id, awb_number, logistics_provider, expected_delivery } = req.body;
    if (!order_id || !awb_number) {
      res.status(400).json(errorResponse('order_id and awb_number required'));
      return;
    }

    const order = await queryOne<{ seller_id: string; status: string }>(
      'SELECT seller_id, status FROM orders WHERE id = $1', [order_id]
    );
    if (!order) { res.status(404).json(errorResponse('Order not found')); return; }
    if (order.seller_id !== req.user!.profile_id) { res.status(403).json(errorResponse('Not your order')); return; }
    if (order.status !== 'confirmed') { res.status(400).json(errorResponse('Order not in confirmed state')); return; }

    const shipment = await withTransaction(async (client) => {
      const id = uuidv4();
      const trackingUrl = logistics_provider === 'delhivery'
        ? `https://www.delhivery.com/track/package/${awb_number}`
        : `https://shiprocket.co/tracking/${awb_number}`;

      await client.query(
        `INSERT INTO shipments (id, order_id, logistics_provider, awb_number, tracking_url, status, expected_delivery)
         VALUES ($1,$2,$3,$4,$5,'picked_up',$6)`,
        [id, order_id, logistics_provider || 'seller_ship', awb_number, trackingUrl, expected_delivery ?? null]
      );
      await client.query(
        'UPDATE orders SET status=$1, shipment_id=$2 WHERE id=$3',
        ['shipped', id, order_id]
      );
      return { id, awb_number, tracking_url: trackingUrl };
    });

    res.status(201).json(successResponse(shipment, 'Shipment created'));
  }
);

// ── POST /shipments/webhook/delhivery — tracking updates ─────
shipmentsRouter.post('/webhook/delhivery', async (req: Request, res: Response) => {
  // Delhivery sends status updates as array of packages
  const packages = req.body?.packages ?? req.body?.data ?? [];
  for (const pkg of packages) {
    const awb = pkg?.awb ?? pkg?.AWB;
    const status = pkg?.status ?? pkg?.Status;
    if (!awb || !status) continue;

    const statusMap: Record<string, string> = {
      'Delivered': 'delivered',
      'In Transit': 'in_transit',
      'Out for Delivery': 'out_for_delivery',
      'Pickup Scheduled': 'picked_up',
      'RTO': 'return_initiated',
    };
    const mapped = statusMap[status] || 'in_transit';

    await query(
      'UPDATE shipments SET status = $1, updated_at = NOW() WHERE awb_number = $2',
      [mapped, awb]
    );

    if (mapped === 'delivered') {
      const ship = await queryOne<{ order_id: string }>(
        'SELECT order_id FROM shipments WHERE awb_number = $1', [awb]
      );
      if (ship) {
        await query('UPDATE orders SET status = $1 WHERE id = $2', ['delivered', ship.order_id]);
        logger.info('Order delivered via webhook', { order_id: ship.order_id, awb });
      }
    }
  }
  res.json({ received: true });
});

// ── GET /shipments/track/:awb ────────────────────────────────
shipmentsRouter.get('/track/:awb', async (req: Request, res: Response) => {
  const shipment = await queryOne(
    `SELECT s.*, o.buyer_id, o.seller_id, o.order_number
     FROM shipments s JOIN orders o ON s.order_id = o.id
     WHERE s.awb_number = $1`,
    [req.params.awb]
  );
  if (!shipment) { res.status(404).json(errorResponse('Shipment not found')); return; }
  res.json(successResponse(shipment));
});
