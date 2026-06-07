/**
 * Dispute Resolution Service.
 * Handles raise â†’ evidence â†’ admin review â†’ resolution â†’ escrow directive.
 * SLA: 24h first response, 72h resolution.
 * Escrow directive: admin can release to seller or refund buyer after review.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticate, requireRole,
  query, queryOne, withTransaction,
  successResponse, errorResponse,
  logger,
} from '@nirmalmandi/shared';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const disputesRouter = Router();

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.S3_BUCKET_NAME || 'nirmalmandi-assets';
const CDN = process.env.CLOUDFRONT_URL || `https://${BUCKET}.s3.amazonaws.com`;
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
const SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-secret';

async function notify(userId: string, templateKey: string, variables: string[]) {
  await axios.post(`${NOTIFICATION_URL}/notifications/send`, {
    userId, channel: 'all', templateKey, variables,
  }, { headers: { 'x-service-secret': SERVICE_SECRET } }).catch(e =>
    logger.warn('Dispute notification failed', { error: e.message })
  );
}

// â”€â”€ POST /disputes/raise â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const raiseSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(['not_received', 'wrong_item', 'damaged', 'quality_issue', 'quantity_mismatch', 'other']),
  description: z.string().min(20).max(1000),
});

disputesRouter.post('/raise', authenticate, async (req: Request, res: Response) => {
  const parsed = raiseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', parsed.error.issues));
  const { orderId, reason, description } = parsed.data;

  const order = await queryOne<{
    id: string; buyer_id: string; seller_id: string; status: string; order_number: string;
  }>('SELECT id, buyer_id, seller_id, status, order_number FROM orders WHERE id = $1', [orderId]);

  if (!order) return res.status(404).json(errorResponse('Order not found'));
  if (order.buyer_id !== req.user!.sub) return res.status(403).json(errorResponse('Only buyer can raise dispute'));
  if (!['paid', 'shipped', 'delivered', 'completed'].includes(order.status)) {
    return res.status(409).json(errorResponse('Cannot raise dispute for this order status'));
  }

  // Check no open dispute already
  const existing = await queryOne(
    `SELECT id FROM disputes WHERE order_id = $1 AND status NOT IN ('resolved', 'closed')`,
    [orderId]
  );
  if (existing) return res.status(409).json(errorResponse('Dispute already open for this order'));

  const disputeId = uuidv4();
  const slaDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h SLA

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO disputes
         (id, order_id, buyer_id, seller_id, reason, description, status, sla_deadline, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW(), NOW())`,
      [disputeId, orderId, order.buyer_id, order.seller_id, reason, description, slaDeadline]
    );
    // Put escrow on hold â€” block auto-release
    await client.query(
      `UPDATE escrow_accounts SET dispute_hold = true WHERE order_id = $1`,
      [orderId]
    );
    await client.query(
      `UPDATE orders SET dispute_id = $1, status = 'disputed', updated_at = NOW() WHERE id = $2`,
      [disputeId, orderId]
    );
  });

  // Notify seller and admin
  await notify(order.seller_id, 'DISPUTE_RAISED', [order.order_number]);

  // Get all admins and notify
  const admins = await query<{ id: string }>(`SELECT id FROM users WHERE role = 'admin' LIMIT 5`);
  await Promise.all(admins.map(a => notify(a.id, 'DISPUTE_RAISED', [order.order_number])));

  logger.info('Dispute raised', { disputeId, orderId, reason });
  return res.status(201).json(successResponse({
    disputeId,
    slaDeadline: slaDeadline.toISOString(),
    message: 'Dispute raised. Our team will respond within 24 hours.',
  }));
});

// â”€â”€ POST /disputes/:id/evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Get pre-signed URL to upload evidence (images, videos, documents).
disputesRouter.post('/:id/evidence', authenticate, async (req: Request, res: Response) => {
  const dispute = await queryOne<{ buyer_id: string; seller_id: string; status: string }>(
    'SELECT buyer_id, seller_id, status FROM disputes WHERE id = $1',
    [req.params.id]
  );
  if (!dispute) return res.status(404).json(errorResponse('Dispute not found'));

  const isParty = [dispute.buyer_id, dispute.seller_id].includes(req.user!.sub);
  if (!isParty) return res.status(403).json(errorResponse('Forbidden'));
  if (['resolved', 'closed'].includes(dispute.status)) {
    return res.status(409).json(errorResponse('Dispute already closed'));
  }

  const { fileType, fileName } = req.body;
  if (!fileType || !fileName) return res.status(400).json(errorResponse('fileType and fileName required'));

  const key = `disputes/${req.params.id}/${uuidv4()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const fileUrl = `${CDN}/${key}`;

  // Record evidence
  await query(
    `INSERT INTO dispute_evidence (id, dispute_id, uploaded_by, file_url, file_name, file_type, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
    [req.params.id, req.user!.sub, fileUrl, fileName, fileType]
  );

  return res.json(successResponse({ uploadUrl, fileUrl }));
});

// â”€â”€ GET /disputes/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
disputesRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  const dispute = await queryOne(
    `SELECT d.*, o.order_number,
            array_agg(json_build_object('fileUrl', de.file_url, 'fileName', de.file_name,
              'uploadedBy', de.uploaded_by, 'createdAt', de.created_at)) FILTER (WHERE de.id IS NOT NULL) as evidence
     FROM disputes d
     JOIN orders o ON d.order_id = o.id
     LEFT JOIN dispute_evidence de ON de.dispute_id = d.id
     WHERE d.id = $1
     GROUP BY d.id, o.order_number`,
    [req.params.id]
  );
  if (!dispute) return res.status(404).json(errorResponse('Dispute not found'));

  const isParty = [dispute.buyer_id, dispute.seller_id].includes(req.user!.sub);
  const isAdmin = req.user!.role === 'admin';
  if (!isParty && !isAdmin) return res.status(403).json(errorResponse('Forbidden'));

  return res.json(successResponse(dispute));
});

// â”€â”€ GET /disputes/my â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
disputesRouter.get('/my', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const rows = await query(
    `SELECT d.id, d.reason, d.status, d.sla_deadline, d.created_at, o.order_number
     FROM disputes d JOIN orders o ON d.order_id = o.id
     WHERE d.buyer_id = $1 OR d.seller_id = $1
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return res.json(successResponse(rows));
});

// â”€â”€ POST /disputes/:id/message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Either party or admin can add messages to dispute thread.
disputesRouter.post('/:id/message', authenticate, async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message || message.trim().length < 5) return res.status(400).json(errorResponse('Message too short'));

  const dispute = await queryOne<{ buyer_id: string; seller_id: string; status: string }>(
    'SELECT buyer_id, seller_id, status FROM disputes WHERE id = $1', [req.params.id]
  );
  if (!dispute) return res.status(404).json(errorResponse('Dispute not found'));

  const isParty = [dispute.buyer_id, dispute.seller_id].includes(req.user!.sub);
  const isAdmin = req.user!.role === 'admin';
  if (!isParty && !isAdmin) return res.status(403).json(errorResponse('Forbidden'));

  await query(
    `INSERT INTO dispute_messages (id, dispute_id, sender_id, message, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
    [req.params.id, req.user!.sub, message.trim()]
  );
  return res.json(successResponse({ sent: true }));
});

// â”€â”€ POST /disputes/:id/resolve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Admin resolves: decides 'release_to_seller' or 'refund_buyer'.
const resolveSchema = z.object({
  outcome: z.enum(['release_to_seller', 'refund_buyer']),
  resolution: z.string().min(20).max(500),
});

disputesRouter.post('/:id/resolve', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', parsed.error.issues));
  const { outcome, resolution } = parsed.data;

  const dispute = await queryOne<{
    id: string; order_id: string; buyer_id: string; seller_id: string; status: string; order_number: string;
  }>(
    `SELECT d.*, o.order_number FROM disputes d JOIN orders o ON d.order_id = o.id WHERE d.id = $1`,
    [req.params.id]
  );
  if (!dispute) return res.status(404).json(errorResponse('Dispute not found'));
  if (dispute.status !== 'open' && dispute.status !== 'under_review') {
    return res.status(409).json(errorResponse('Dispute not open'));
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE disputes
       SET status = 'resolved', outcome = $1, resolution_note = $2,
           resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [outcome, resolution, req.user!.sub, dispute.id]
    );

    if (outcome === 'refund_buyer') {
      // Payment service will handle actual Razorpay refund
      await axios.post(`${PAYMENT_URL}/payments/admin/refund`, {
        orderId: dispute.order_id,
        reason: `Dispute ${dispute.id} resolved in buyer's favour: ${resolution}`,
      }, {
        headers: {
          'x-service-secret': SERVICE_SECRET,
          Authorization: req.headers.authorization,
        },
      }).catch(e => logger.error('Refund call failed', { error: e.message }));
    } else {
      // Release escrow to seller (override dispute hold)
      await client.query(
        `UPDATE escrow_accounts SET dispute_hold = false WHERE order_id = $1`,
        [dispute.order_id]
      );
      await axios.post(`${PAYMENT_URL}/payments/admin/force-release`, {
        orderId: dispute.order_id,
        reason: `Dispute resolved in seller's favour: ${resolution}`,
      }, {
        headers: {
          'x-service-secret': SERVICE_SECRET,
          Authorization: req.headers.authorization,
        },
      }).catch(e => logger.error('Force release call failed', { error: e.message }));
    }
  });

  // Notify both parties
  await notify(dispute.buyer_id, 'DISPUTE_RAISED', [dispute.order_number, `Resolved: ${outcome}`]);
  await notify(dispute.seller_id, 'DISPUTE_RAISED', [dispute.order_number, `Resolved: ${outcome}`]);

  logger.info('Dispute resolved', {
    disputeId: dispute.id, outcome, adminId: req.user!.sub,
  });
  return res.json(successResponse({ resolved: true, outcome }));
});

// â”€â”€ GET /disputes/admin/queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
disputesRouter.get('/admin/queue', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const rows = await query(
    `SELECT d.id, d.reason, d.status, d.sla_deadline, d.created_at,
            o.order_number, o.total_amount,
            ub.full_name as buyer_name, us.full_name as seller_name
     FROM disputes d
     JOIN orders o ON d.order_id = o.id
     JOIN users ub ON d.buyer_id = ub.id
     JOIN users us ON d.seller_id = us.id
     WHERE d.status IN ('open', 'under_review')
     ORDER BY
       CASE WHEN d.sla_deadline < NOW() THEN 0 ELSE 1 END,
       d.sla_deadline ASC`
  );
  return res.json(successResponse(rows));
});

// â”€â”€ PATCH /disputes/:id/assign â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
disputesRouter.patch('/:id/assign', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  await query(
    `UPDATE disputes SET assigned_to = $1, status = 'under_review', updated_at = NOW() WHERE id = $2`,
    [req.user!.sub, req.params.id]
  );
  return res.json(successResponse({ assigned: true }));
});
