/**
 * Scheduled analytics jobs.
 * In production these run as AWS EventBridge rules targeting ECS tasks.
 * In dev/staging they run as intervals inside the service.
 */
import { query, queryOne, logger, flushViewCounts } from '@nirmalmandi/shared';
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

    // Watchlist price-drop alerts — every 6 hours
    setInterval(async () => {
      try {
        // Find listings whose price dropped since the buyer watchlisted them
        const drops = await query<{
          buyer_id: string; listing_id: string; title: string;
          current_price: number; saved_price: number;
        }>(`
          SELECT bw.buyer_id, l.id AS listing_id, l.title,
                 l.asking_price AS current_price, bw.price_at_save AS saved_price
          FROM watchlist bw
          JOIN listings l ON l.id = bw.listing_id
          WHERE l.status = 'live'
            AND bw.price_at_save IS NOT NULL
            AND l.asking_price < bw.price_at_save * 0.95
            AND (bw.last_alert_sent_at IS NULL OR bw.last_alert_sent_at < NOW() - INTERVAL '24 hours')
        `);

        if (drops.length === 0) return;

        const { default: axios } = await import('axios');
        const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006';

        for (const drop of drops) {
          const pct = Math.round((1 - drop.current_price / drop.saved_price) * 100);
          try {
            await axios.post(`${notifUrl}/notifications/send`, {
              profile_id: drop.buyer_id,
              type: 'price_drop',
              title: `Price dropped ${pct}% on your watchlist`,
              body: `${drop.title} is now ₹${drop.current_price.toLocaleString('en-IN')} — was ₹${drop.saved_price.toLocaleString('en-IN')}`,
              data: { listing_id: drop.listing_id, link: `/listings/${drop.listing_id}` },
              channels: ['push', 'in_app'],
            });
            await query(
              'UPDATE watchlist SET last_alert_sent_at = NOW() WHERE buyer_id = $1 AND listing_id = $2',
              [drop.buyer_id, drop.listing_id]
            );
          } catch { /* per-notification failure is non-critical */ }
        }

        logger.info('Watchlist price-drop alerts sent', { count: drops.length });
      } catch (e) {
        logger.error('Watchlist price-drop job failed', { error: e });
      }
    }, 6 * 60 * 60 * 1000);

    // Weekly auto-report — every Monday 8AM IST (UTC+5:30 = 02:30 UTC)
    setInterval(async () => {
      try {
        const now = new Date();
        // Only run on Monday (day 1) at 02:30 UTC (08:00 IST)
        if (now.getUTCDay() !== 1 || now.getUTCHours() !== 2 || now.getUTCMinutes() > 5) return;

        const [gmvRow, ordersRow, listingsRow, disputesRow, topSectorsRows] = await Promise.all([
          queryOne<{ total: string; prev: string }>(
            `SELECT
               COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN total_amount END), 0) AS total,
               COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN total_amount END), 0) AS prev
             FROM orders WHERE status NOT IN ('cancelled','refunded')`, []
          ),
          queryOne<{ this_week: string; last_week: string }>(
            `SELECT
               COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS this_week,
               COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) AS last_week
             FROM orders WHERE status NOT IN ('cancelled','refunded')`, []
          ),
          queryOne<{ new_sellers: string; new_buyers: string }>(
            `SELECT
               COUNT(CASE WHEN role = 'seller' AND created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS new_sellers,
               COUNT(CASE WHEN role = 'buyer'  AND created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS new_buyers
             FROM users`, []
          ),
          queryOne<{ open: string }>(
            `SELECT COUNT(*) AS open FROM disputes WHERE status = 'open'`, []
          ),
          query(
            `SELECT s.name, COALESCE(SUM(o.total_amount), 0) AS gmv
             FROM orders o JOIN listings l ON o.listing_id = l.id
             JOIN sectors s ON l.sector_id = s.id
             WHERE o.created_at >= NOW() - INTERVAL '7 days' AND o.status NOT IN ('cancelled','refunded')
             GROUP BY s.name ORDER BY gmv DESC LIMIT 5`, []
          ),
        ]);

        const gmvThisWeek = parseFloat((gmvRow as any)?.total ?? '0');
        const gmvLastWeek = parseFloat((gmvRow as any)?.prev ?? '0');
        const gmvChange = gmvLastWeek > 0 ? ((gmvThisWeek - gmvLastWeek) / gmvLastWeek * 100).toFixed(1) : 'N/A';
        const ordersThisWeek = parseInt((ordersRow as any)?.this_week ?? '0', 10);
        const newSellers = parseInt((listingsRow as any)?.new_sellers ?? '0', 10);
        const newBuyers = parseInt((listingsRow as any)?.new_buyers ?? '0', 10);
        const openDisputes = parseInt((disputesRow as any)?.open ?? '0', 10);

        const topSectorsText = (topSectorsRows as any[])
          .map((s: any, i: number) => `  ${i + 1}. ${s.name} — ₹${parseFloat(s.gmv).toLocaleString('en-IN')}`)
          .join('\n');

        const reportHtml = `
<h2>NirmalMandi Weekly Report — ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</h2>
<table border="0" cellpadding="8" style="border-collapse:collapse;">
  <tr><td><b>GMV This Week</b></td><td>₹${gmvThisWeek.toLocaleString('en-IN')} (${gmvChange}% WoW)</td></tr>
  <tr><td><b>Orders</b></td><td>${ordersThisWeek}</td></tr>
  <tr><td><b>New Sellers</b></td><td>${newSellers}</td></tr>
  <tr><td><b>New Buyers</b></td><td>${newBuyers}</td></tr>
  <tr><td><b>Open Disputes</b></td><td>${openDisputes}</td></tr>
</table>
<h3>Top Sectors by GMV</h3>
<pre>${topSectorsText || 'No data'}</pre>
<p style="color:#888;font-size:12px;">Automated report — NirmalMandi Analytics</p>
`;

        const { default: axios } = await import('axios');
        const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006';

        // Fetch admin email recipients from platform_settings
        const recipientSetting = await queryOne<{ value: string }>(
          `SELECT value FROM platform_settings WHERE key = 'weekly_report_emails'`, []
        );
        const recipients: string[] = recipientSetting?.value
          ? recipientSetting.value.split(',').map((e: string) => e.trim()).filter(Boolean)
          : [process.env.ADMIN_EMAIL || 'admin@nirmalmandi.com'];

        for (const email of recipients) {
          try {
            await axios.post(`${notifUrl}/notifications/send-email`, {
              to: email,
              subject: `NirmalMandi Weekly Report — ${now.toLocaleDateString('en-IN')}`,
              html: reportHtml,
            });
          } catch { /* per-recipient failure is non-critical */ }
        }

        logger.info('Weekly report sent', { recipients: recipients.length, gmv: gmvThisWeek });
      } catch (e) {
        logger.error('Weekly report job failed', { error: e });
      }
    }, 5 * 60 * 1000); // Check every 5 min, only fires on Monday 8AM IST

    logger.info('Analytics scheduled jobs started');
  },
};
