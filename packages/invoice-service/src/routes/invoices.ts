/**
 * Invoice service routes.
 * Generates GST-compliant PDF invoices and stores them on S3.
 * Triggered after payment captured webhook or on admin demand.
 */
import { Router, Request, Response } from 'express';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  generateInvoiceNumber,
  successResponse, errorResponse,
  logger,
} from '@nirmalmandi/shared';
import { generateGstInvoice, InvoiceData } from '../services/generator';

export const invoicesRouter = Router();

// ── POST /invoices/generate ─────────────────────────────────────
// Called by payment-service after payment.captured webhook.
const SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-secret';

invoicesRouter.post('/generate', async (req: Request, res: Response) => {
  const isInternal = req.headers['x-service-secret'] === SERVICE_SECRET;
  if (!isInternal) return res.status(403).json(errorResponse('Forbidden'));

  const { orderId } = req.body;
  if (!orderId) return res.status(400).json(errorResponse('orderId required'));

  // Fetch all data needed for invoice
  const order = await queryOne<{
    id: string; order_number: string; total_amount: number; created_at: string;
    seller_name: string; seller_gstin: string; seller_address: string; seller_state: string;
    buyer_name: string; buyer_gstin: string; buyer_address: string; buyer_state: string;
    listing_title: string; hsn_code: string; quantity: number; unit: string; unit_price: number;
    sector_slug: string; commission_amount: number; tcs_amount: number; net_payout: number;
    invoice_url: string | null;
  }>(
    `SELECT o.id, o.order_number, o.total_amount, o.created_at,
            sp.business_name as seller_name, sp.gstin as seller_gstin,
            CONCAT(sp.city, ', ', sp.state) as seller_address, sp.state as seller_state,
            COALESCE(bp.company_name, u_b.full_name) as buyer_name,
            bp.gstin as buyer_gstin,
            CONCAT(bp.city, ', ', bp.state) as buyer_address, bp.state as buyer_state,
            l.title as listing_title, COALESCE(l.hsn_code, '9999') as hsn_code,
            o.quantity, 'Units' as unit, l.asking_price as unit_price,
            sec.slug as sector_slug,
            ea.commission_amount, ea.tcs_amount, ea.net_payout,
            o.invoice_url
     FROM orders o
     JOIN listings l ON o.listing_id = l.id
     JOIN sectors sec ON l.sector_id = sec.id
     JOIN seller_profiles sp ON o.seller_id = sp.id
     JOIN buyer_profiles bp ON o.buyer_id = bp.id
     JOIN users u_b ON bp.id = u_b.id
     LEFT JOIN escrow_accounts ea ON o.escrow_id = ea.id
     WHERE o.id = $1`,
    [orderId]
  );

  if (!order) return res.status(404).json(errorResponse('Order not found'));
  if (order.invoice_url) return res.json(successResponse({ invoiceUrl: order.invoice_url, cached: true }));

  // Get next invoice sequence number
  const seqRow = await queryOne<{ nextval: string }>(
    `SELECT nextval('invoice_seq')::text as nextval`
  );
  const invoiceNumber = generateInvoiceNumber(parseInt(seqRow!.nextval));
  const invoiceDate = new Date(order.created_at).toISOString().split('T')[0];

  // Determine GST rate for sector
  const GST_RATES: Record<string, number> = {
    automobiles: 28, clothing: 5, fmcg: 12, pharma: 12, furniture: 18, software: 18, machinery: 18,
  };
  const gstRate = GST_RATES[order.sector_slug] ?? 18;

  const invoiceData: InvoiceData = {
    invoiceNumber,
    invoiceDate,
    orderId: order.id,
    orderNumber: order.order_number,
    sellerName: order.seller_name,
    sellerGstin: order.seller_gstin,
    sellerAddress: order.seller_address,
    sellerState: order.seller_state,
    buyerName: order.buyer_name,
    buyerGstin: order.buyer_gstin,
    buyerAddress: order.buyer_address,
    buyerState: order.buyer_state,
    items: [{
      description: order.listing_title,
      hsn: order.hsn_code,
      quantity: order.quantity,
      unit: order.unit,
      unitPrice: order.unit_price,
      gstRate,
    }],
    platformName: 'NirmalMandi (Amalthea Consultancy)',
    platformGstin: process.env.PLATFORM_GSTIN || '27AABCA1234A1Z5',
    commissionAmount: order.commission_amount,
    commissionGstRate: 18, // GST on commission is always 18%
    tcsAmount: order.tcs_amount,
    netPayoutToSeller: order.net_payout,
  };

  try {
    const invoiceUrl = await generateGstInvoice(invoiceData);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE orders SET invoice_url = $1, invoice_number = $2, updated_at = NOW() WHERE id = $3`,
        [invoiceUrl, invoiceNumber, orderId]
      );
      await client.query(
        `INSERT INTO invoices (id, order_id, invoice_number, invoice_date, seller_id, buyer_id,
           total_amount, commission_amount, tcs_amount, invoice_url, created_at)
         SELECT gen_random_uuid(), $1, $2, $3, seller_id, buyer_id,
           $4, $5, $6, $7, NOW()
         FROM orders WHERE id = $1`,
        [orderId, invoiceNumber, invoiceDate, order.total_amount,
         order.commission_amount, order.tcs_amount, invoiceUrl]
      );
    });

    return res.json(successResponse({ invoiceUrl, invoiceNumber }));
  } catch (err: any) {
    logger.error('Invoice generation failed', { orderId, error: err.message });
    return res.status(500).json(errorResponse('Invoice generation failed'));
  }
});

// ── GET /invoices/:orderId ───────────────────────────────────────
invoicesRouter.get('/:orderId', authenticate, async (req: Request, res: Response) => {
  const order = await queryOne<{
    buyer_id: string; seller_id: string; invoice_url: string | null; invoice_number: string | null;
  }>(
    'SELECT buyer_id, seller_id, invoice_url, invoice_number FROM orders WHERE id = $1',
    [req.params.orderId]
  );
  if (!order) return res.status(404).json(errorResponse('Order not found'));

  const isParty = [order.buyer_id, order.seller_id].includes(req.user!.userId);
  const isAdmin = req.user!.role === 'admin';
  if (!isParty && !isAdmin) return res.status(403).json(errorResponse('Forbidden'));
  if (!order.invoice_url) return res.status(404).json(errorResponse('Invoice not yet generated'));

  return res.json(successResponse({
    invoiceNumber: order.invoice_number,
    invoiceUrl: order.invoice_url,
  }));
});

// ── GET /invoices/admin/list ─────────────────────────────────────
invoicesRouter.get('/admin/list', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { month } = req.query; // e.g. "2024-03"
  let where = '';
  const params: any[] = [];
  if (month) {
    where = `WHERE DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', $1::date)`;
    params.push(`${month}-01`);
  }
  const rows = await query(
    `SELECT i.*, o.order_number FROM invoices i JOIN orders o ON i.order_id = o.id
     ${where} ORDER BY i.invoice_date DESC LIMIT 200`,
    params
  );
  return res.json(successResponse(rows));
});
