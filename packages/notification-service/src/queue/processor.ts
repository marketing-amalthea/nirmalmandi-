/**
 * Bull queue processor for reliable notification delivery.
 * Retries failed notifications with exponential backoff.
 * Channels: whatsapp, sms, push, email (email deferred to Phase 2).
 */
import Bull from 'bull';
import { logger, query } from '@nirmalmandi/shared';
import { sendWhatsApp, Templates } from '../services/whatsapp';
import { sendPush } from '../services/fcm';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let notificationQueueInstance: Bull.Queue | null = null;
try {
  notificationQueueInstance = new Bull('notifications', REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
  notificationQueueInstance.on('error', (err) => {
    logger.warn('Bull queue error (non-fatal)', { error: err.message });
  });
} catch (err: any) {
  logger.warn('Failed to initialise Bull queue — notifications will be logged only', { error: err.message });
}
export const notificationQueue = notificationQueueInstance;

export interface NotificationJob {
  userId: string;
  channel: 'whatsapp' | 'push' | 'sms' | 'all';
  templateKey: keyof typeof Templates;
  variables: string[];
  data?: Record<string, string>; // for push deep-link
  title?: string; // for push
}

// ── Processor ────────────────────────────────────────────────────

notificationQueue?.process(async (job) => {
  const { userId, channel, templateKey, variables, data, title } = job.data as NotificationJob;

  // Fetch user contact info
  const user = await query<{ phone: string; fcm_token: string | null; name: string }>(
    `SELECT u.phone, u.fcm_token, u.full_name as name
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  if (user.length === 0) {
    logger.warn('Notification target user not found', { userId });
    return;
  }

  const { phone, fcm_token, name } = user[0];
  const template = Templates[templateKey];
  const body = variables.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), template);

  const errors: Error[] = [];

  if ((channel === 'whatsapp' || channel === 'all') && phone) {
    try {
      await sendWhatsApp({ to: phone, template, variables });
    } catch (e) { errors.push(e as Error); }
  }

  if ((channel === 'push' || channel === 'all') && fcm_token) {
    try {
      await sendPush({
        token: fcm_token,
        title: title || 'NirmalMandi',
        body,
        data,
      });
    } catch (e) { errors.push(e as Error); }
  }

  // Persist notification record regardless
  await query(
    `INSERT INTO notifications (id, user_id, type, title, body, channel, sent_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
    [userId, templateKey, title || 'NirmalMandi', body, channel]
  ).catch(e => logger.error('Failed to persist notification', { error: e }));

  if (errors.length > 0 && errors.length === (channel === 'all' ? 2 : 1)) {
    throw new Error(`All notification channels failed: ${errors.map(e => e.message).join(', ')}`);
  }

  logger.info('Notification sent', { userId, channel, templateKey });
});

notificationQueue?.on('failed', (job, err) => {
  logger.error('Notification job failed permanently', {
    jobId: job.id,
    userId: job.data.userId,
    error: err.message,
    attempts: job.attemptsMade,
  });
});

/**
 * Enqueue a notification — fire and forget from other services.
 */
export async function enqueueNotification(job: NotificationJob, delay = 0): Promise<void> {
  if (!notificationQueue) {
    logger.warn('Queue unavailable — skipping notification enqueue', { userId: job.userId });
    return;
  }
  await notificationQueue.add(job, { delay });
}
