/**
 * Notification service REST API.
 * Other services POST here to enqueue notifications.
 * Admin endpoints to view notification logs.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, query, successResponse, errorResponse, logger } from '@nirmalmandi/shared';
import { enqueueNotification, NotificationJob } from '../queue/processor';
import { Templates } from '../services/whatsapp';

export const notificationsRouter = Router();

// Internal service secret — other services use this to send notifications
// without user auth (service-to-service call)
const SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-secret';

function isInternalCall(req: Request): boolean {
  return req.headers['x-service-secret'] === SERVICE_SECRET;
}

const enqueueSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(['whatsapp', 'push', 'sms', 'all']),
  templateKey: z.string(),
  variables: z.array(z.string()),
  data: z.record(z.string()).optional(),
  title: z.string().optional(),
  delay: z.number().int().min(0).default(0),
});

// POST /notifications/send — internal service call
notificationsRouter.post('/send', async (req: Request, res: Response) => {
  if (!isInternalCall(req)) {
    return res.status(403).json(errorResponse('Forbidden'));
  }
  const parsed = enqueueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Validation failed', parsed.error.issues));

  const { delay, ...jobData } = parsed.data;

  // Validate templateKey
  if (!Object.keys(Templates).includes(jobData.templateKey)) {
    return res.status(400).json(errorResponse(`Unknown template: ${jobData.templateKey}`));
  }

  await enqueueNotification(jobData as NotificationJob, delay);
  return res.json(successResponse({ queued: true }));
});

// POST /notifications/send-bulk — send to multiple users
notificationsRouter.post('/send-bulk', async (req: Request, res: Response) => {
  if (!isInternalCall(req)) {
    return res.status(403).json(errorResponse('Forbidden'));
  }
  const { userIds, channel, templateKey, variables, title } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json(errorResponse('userIds required'));
  }
  await Promise.all(
    userIds.map((userId: string) =>
      enqueueNotification({ userId, channel, templateKey, variables, title })
    )
  );
  return res.json(successResponse({ queued: userIds.length }));
});

// GET /notifications/my — user's notification history
notificationsRouter.get('/my', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await query(
    `SELECT id, type, title, body, channel, is_read, sent_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY sent_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return res.json(successResponse(rows));
});

// PATCH /notifications/:id/read — mark as read
notificationsRouter.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  await query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId]
  );
  return res.json(successResponse({ read: true }));
});

// GET /notifications/admin/logs — admin view of all notification logs
notificationsRouter.get('/admin/logs', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * limit;
  const { channel, search } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (channel) { conditions.push(`n.channel = $${idx++}`); params.push(channel); }
  if (search) {
    conditions.push(`(u.name ILIKE $${idx} OR u.phone ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRows, rows] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM notifications n LEFT JOIN users u ON n.user_id = u.id ${where}`,
        params
      ),
      query(
        `SELECT n.id, n.type, n.title, n.body, n.channel,
                (n.status = 'read') AS "isRead",
                n.created_at AS "sentAt", n.user_id AS "userId",
                u.name AS "userName", u.phone AS "userPhone"
         FROM notifications n
         LEFT JOIN users u ON n.user_id = u.id
         ${where}
         ORDER BY n.sent_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
    ]);
    const total = parseInt((countRows[0] as any).total as string, 10) || 0;
    return res.json(successResponse({ rows, total }));
  } catch (err: any) {
    return res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});

// POST /notifications/admin/broadcast — send to all users matching a role
notificationsRouter.post('/admin/broadcast', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { title, message, channel = 'push', targetRole } = req.body;
  if (!title || !message) {
    return res.status(400).json(errorResponse('title and message are required'));
  }

  try {
    // Fetch target user IDs
    let userRows: { id: string }[];
    if (targetRole === 'buyer') {
      userRows = await query(
        `SELECT u.id FROM users u INNER JOIN buyer_profiles bp ON bp.user_id = u.id WHERE u.status = 'active'`,
        []
      ) as { id: string }[];
    } else if (targetRole === 'seller') {
      userRows = await query(
        `SELECT u.id FROM users u INNER JOIN seller_profiles sp ON sp.user_id = u.id WHERE u.status = 'active'`,
        []
      ) as { id: string }[];
    } else {
      userRows = await query(
        `SELECT id FROM users WHERE status = 'active'`,
        []
      ) as { id: string }[];
    }

    // Enqueue notifications in batches
    const queued = userRows.length;
    await Promise.allSettled(
      userRows.map((u) =>
        enqueueNotification({
          userId: u.id,
          channel: channel as NotificationJob['channel'],
          templateKey: 'ADMIN_BROADCAST',
          variables: [title, message],
          title,
        })
      )
    );

    logger.info('Admin broadcast queued', { queued, targetRole, adminTitle: title });
    return res.json(successResponse({ queued, targetRole: targetRole || 'all' }));
  } catch (err: any) {
    return res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
});
