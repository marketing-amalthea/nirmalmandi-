/**
 * Scheduled analytics jobs.
 * In production these run as AWS EventBridge rules targeting ECS tasks.
 * In dev/staging they run as intervals inside the service.
 */
import { query, logger, flushViewCounts } from '@nirmalmandi/shared';
import { getDemandSupplyGap } from './demandSupply';
import { getAgingRisk } from './agingRisk';

export const scheduledJobs = {
  start() {
    // Flush view counts from Redis → DB every hour
    setInterval(async () => {
      try {
        const counts = await flushViewCounts();
        if (counts.size === 0) return;
        for (const [listingId, count] of counts) {
          await query(
            'UPDATE listings SET views_count = views_count + $1 WHERE id = $2',
            [count, listingId]
          );
        }
        logger.info('Flushed view counts', { listings: counts.size });
      } catch (e) {
        logger.error('View count flush failed', { error: e });
      }
    }, 60 * 60 * 1000);

    // Auto-expire auctions every minute
    setInterval(async () => {
      try {
        const expired = await query<{ id: string; seller_id: string }>(
          `UPDATE listings
           SET status = 'expired', updated_at = NOW()
           WHERE price_type = 'auction'
             AND auction_ends_at < NOW()
             AND status = 'live'
           RETURNING id, seller_id`
        );
        if (expired.length > 0) {
          logger.info('Expired auctions', { count: expired.length });
        }
      } catch (e) {
        logger.error('Auction expiry job failed', { error: e });
      }
    }, 60 * 1000);

    // Auto-expire flash sales every 5 minutes
    setInterval(async () => {
      try {
        await query(
          `UPDATE listings
           SET price_type = 'fixed', flash_sale_ends_at = NULL, updated_at = NOW()
           WHERE price_type = 'flash'
             AND flash_sale_ends_at < NOW()
             AND status = 'live'`
        );
      } catch (e) {
        logger.error('Flash sale expiry job failed', { error: e });
      }
    }, 5 * 60 * 1000);

    // Update urgency scores for all live listings every 6 hours
    setInterval(async () => {
      try {
        await query(`
          UPDATE listings SET
            urgency_score = LEAST(1.0,
              CASE
                WHEN urgency_days IS NOT NULL AND urgency_days <= 3 THEN 0.9
                WHEN urgency_days IS NOT NULL AND urgency_days <= 7 THEN 0.75
                WHEN urgency_days IS NOT NULL AND urgency_days <= 14 THEN 0.6
                WHEN dead_stock_type = 'near_expiry' AND expiry_date <= NOW() + INTERVAL '30 days' THEN 0.8
                WHEN dead_stock_type = 'near_expiry' THEN 0.6
                ELSE urgency_score
              END
            ),
            is_urgent_badge = (urgency_days IS NOT NULL AND urgency_days <= 7) OR
                              (dead_stock_type = 'near_expiry' AND expiry_date <= NOW() + INTERVAL '30 days'),
            updated_at = NOW()
          WHERE status = 'live'
        `);
        logger.info('Urgency scores updated');
      } catch (e) {
        logger.error('Urgency score update failed', { error: e });
      }
    }, 6 * 60 * 60 * 1000);

    logger.info('Analytics scheduled jobs started');
  },
};
