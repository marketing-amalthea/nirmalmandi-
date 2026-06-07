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

// ── GET /shipments/order/:order_id ────────────────────────────
shipmentsRouter.get('/order/:order_id', async (req: Request, res: Response) => {
  const shipment = await queryOne(
    `SELECT s.*, o.order_number FROM shipments s
     JOIN orders o ON s.order_id = o.id
     WHERE s.order_id = $1`,
    [req.params.order_id]
  );
  if (!shipment) { res.status(404).json(errorResponse('No shipment for this order')); return; }
  res.json(successResponse(shipment));
});

// ── POST /shipments/book-delhivery ───────────────────────────
// Calls Delhivery's pickup API and stores the AWB returned
shipmentsRouter.post(
  '/book-delhivery',
  authenticate,
  requireRole('seller', 'admin'),
  async (req: Request, res: Response) => {
    const { order_id, pickup_pincode, delivery_pincode, weight_kg, cod_amount } = req.body as {
      order_id: string; pickup_pincode: string; delivery_pincode: string;
      weight_kg: number; cod_amount?: number;
    };
    if (!order_id || !pickup_pincode || !delivery_pincode || !weight_kg) {
      res.status(400).json(errorResponse('order_id, pickup_pincode, delivery_pincode, weight_kg required'));
      return;
    }

    const order = await queryOne<{ status: string; order_number: string }>(
      'SELECT status, order_number FROM orders WHERE id = $1', [order_id]
    );
    if (!order) { res.status(404).json(errorResponse('Order not found')); return; }

    if (!process.env.DELHIVERY_API_KEY || !process.env.DELHIVERY_BASE_URL) {
      res.status(503).json(errorResponse('Delhivery not configured — set DELHIVERY_API_KEY and DELHIVERY_BASE_URL'));
      return;
    }

    try {
      const manifest = {
        shipments: [{
          name: `NirmalMandi-${order.order_number}`,
          add: 'Pickup address',
          pin: pickup_pincode,
          city: 'Pickup City',
          state: 'Pickup State',
          country: 'India',
          phone: '9999999999',
          order: order_id,
          payment_mode: cod_amount ? 'COD' : 'Pre-paid',
          return_pin: pickup_pincode,
          return_city: 'Pickup City',
          return_phone: '9999999999',
          return_name: 'Return to Sender',
          return_add: 'Pickup address',
          return_state: 'Pickup State',
          return_country: 'India',
          products_desc: 'Inventory',
          hsn_code: '',
          cod_amount: cod_amount ?? 0,
          order_date: new Date().toISOString().slice(0, 10),
          total_amount: cod_amount ?? 0,
          seller_add: 'Pickup address',
          seller_name: 'NirmalMandi Seller',
          seller_inv: order_id,
          quantity: 1,
          waybill: '',
          shipment_width: 15,
          shipment_height: 15,
          weight: weight_kg * 1000,
          seller_gst_tin: '',
          shipping_mode: 'Surface',
          address_type: 'home',
        }],
      };

      const resp = await axios.post(
        `${process.env.DELHIVERY_BASE_URL}/api/cmu/create.json`,
        `format=json&data=${encodeURIComponent(JSON.stringify(manifest))}`,
        {
          headers: {
            Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );

      const awb: string = resp.data?.packages?.[0]?.waybill ?? resp.data?.waybill ?? '';
      if (!awb) {
        logger.error('Delhivery booking returned no AWB', { resp: resp.data });
        res.status(502).json(errorResponse('Delhivery booking failed — no AWB returned'));
        return;
      }

      const trackingUrl = `https://www.delhivery.com/track/package/${awb}`;
      const id = uuidv4();
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO shipments (id, order_id, logistics_provider, awb_number, tracking_url, status)
           VALUES ($1,$2,'delhivery',$3,$4,'booked')
           ON CONFLICT (order_id) DO UPDATE SET awb_number=$3, tracking_url=$4, status='booked', updated_at=NOW()`,
          [id, order_id, awb, trackingUrl]
        );
        await client.query('UPDATE orders SET awb_number=$1, carrier_name=$2, tracking_url=$3 WHERE id=$4',
          [awb, 'Delhivery', trackingUrl, order_id]);
      });

      res.json(successResponse({ awb_number: awb, tracking_url: trackingUrl, provider: 'delhivery' }, 'Shipment booked'));
    } catch (err) {
      logger.error('Delhivery booking failed', { error: err });
      res.status(502).json(errorResponse('Delhivery API error'));
    }
  }
);

// ── POST /shipments/book-shiprocket ──────────────────────────
shipmentsRouter.post(
  '/book-shiprocket',
  authenticate,
  requireRole('seller', 'admin'),
  async (req: Request, res: Response) => {
    const { order_id, pickup_pincode, delivery_pincode, delivery_name, delivery_phone, weight_kg } = req.body as {
      order_id: string; pickup_pincode: string; delivery_pincode: string;
      delivery_name: string; delivery_phone: string; weight_kg: number;
    };
    if (!order_id || !pickup_pincode || !delivery_pincode || !weight_kg) {
      res.status(400).json(errorResponse('order_id, pickup_pincode, delivery_pincode, weight_kg required'));
      return;
    }

    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
      res.status(503).json(errorResponse('Shiprocket not configured — set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD'));
      return;
    }

    try {
      // Step 1: get token
      const authResp = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      });
      const srToken: string = authResp.data?.token ?? '';
      if (!srToken) { res.status(502).json(errorResponse('Shiprocket auth failed')); return; }

      const order = await queryOne<{ total_amount: number; order_number: string }>(
        'SELECT total_amount, order_number FROM orders WHERE id = $1', [order_id]
      );
      if (!order) { res.status(404).json(errorResponse('Order not found')); return; }

      // Step 2: create order
      const orderResp = await axios.post(
        'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
        {
          order_id: order.order_number,
          order_date: new Date().toISOString().slice(0, 10),
          pickup_location: 'Primary',
          billing_customer_name: delivery_name || 'Buyer',
          billing_address: 'Delivery Address',
          billing_city: 'City',
          billing_pincode: delivery_pincode,
          billing_state: 'State',
          billing_country: 'India',
          billing_phone: delivery_phone || '9999999999',
          shipping_is_billing: true,
          sub_total: order.total_amount,
          length: 15, breadth: 15, height: 15,
          weight: weight_kg,
          order_items: [{ name: 'Inventory', sku: order_id, units: 1, selling_price: order.total_amount }],
          payment_method: 'Prepaid',
        },
        { headers: { Authorization: `Bearer ${srToken}` } }
      );

      const awb: string = orderResp.data?.awb_code ?? '';
      const shipmentId: string = orderResp.data?.shipment_id ?? '';
      if (!awb) { res.status(502).json(errorResponse('Shiprocket booking — no AWB returned')); return; }

      const trackingUrl = `https://shiprocket.co/tracking/${awb}`;
      const id = uuidv4();
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO shipments (id, order_id, logistics_provider, awb_number, tracking_url, status)
           VALUES ($1,$2,'shiprocket',$3,$4,'booked')
           ON CONFLICT (order_id) DO UPDATE SET awb_number=$3, tracking_url=$4, status='booked', updated_at=NOW()`,
          [id, order_id, awb, trackingUrl]
        );
        await client.query('UPDATE orders SET awb_number=$1, carrier_name=$2, tracking_url=$3 WHERE id=$4',
          [awb, 'Shiprocket', trackingUrl, order_id]);
      });

      res.json(successResponse({ awb_number: awb, shipment_id: shipmentId, tracking_url: trackingUrl, provider: 'shiprocket' }, 'Shipment booked'));
    } catch (err) {
      logger.error('Shiprocket booking failed', { error: err });
      res.status(502).json(errorResponse('Shiprocket API error'));
    }
  }
);
