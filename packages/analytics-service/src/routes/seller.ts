/**
 * Seller analytics routes — seller-scoped data.
 * Mounted at /seller in the analytics service.
 */
import { Router, Request, Response } from 'express';
import { authenticate, requireRole, query, queryOne, successResponse, errorResponse } from '@nirmalmandi/shared';

export const sellerAnalyticsRouter = Router();
sellerAnalyticsRouter.use(authenticate, requireRole('seller', 'admin'));

// ── GET /seller/dashboard ─────────────────────────────────────────────────────
sellerAnalyticsRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const [gmvRow, payoutRow, listingsRow, ordersRow, agingRow, shipmentsRow, recentOrdersRows] = await Promise.all([
      queryOne<{ total: string; change_pct: string }>(
        `SELECT
           COALESCE(SUM(o.total_amount), 0) AS total,
           0 AS change_pct
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1
           AND o.created_at >= DATE_TRUNC('month', NOW())
           AND o.status NOT IN ('cancelled', 'refunded')`,
        [userId]
      ),
      queryOne<{ pending: string; next_date: string }>(
        `SELECT
           COALESCE(SUM(o.total_amount * 0.975), 0) AS pending,
           (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::TEXT AS next_date
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1
           AND o.status = 'delivered'
           AND o.escrow_released_at IS NULL`,
        [userId]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM listings l
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1 AND l.status IN ('live','active') AND l.deleted_at IS NULL`,
        [userId]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1 AND o.status IN ('paid','confirmed')`,
        [userId]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM listings l
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1
           AND l.status IN ('live','active')
           AND l.created_at < NOW() - INTERVAL '30 days'
           AND l.deleted_at IS NULL`,
        [userId]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1 AND o.status = 'paid'`,
        [userId]
      ),
      query(
        `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at,
                u.name AS buyer_business_name,
                l.title AS listing_title
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
         LEFT JOIN users u ON bp.user_id = u.id
         WHERE sp.user_id = $1
         ORDER BY o.created_at DESC LIMIT 5`,
        [userId]
      ),
    ]);

    res.json(successResponse({
      gmv_month: parseFloat((gmvRow as any)?.total ?? '0'),
      gmv_change_pct: parseFloat((gmvRow as any)?.change_pct ?? '0'),
      pending_payout: parseFloat((payoutRow as any)?.pending ?? '0'),
      next_payout_date: (payoutRow as any)?.next_date ?? '',
      active_listings: parseInt((listingsRow as any)?.count ?? '0', 10),
      orders_awaiting_action: parseInt((ordersRow as any)?.count ?? '0', 10),
      aging_listings_count: parseInt((agingRow as any)?.count ?? '0', 10),
      orders_awaiting_shipment: parseInt((shipmentsRow as any)?.count ?? '0', 10),
      recent_orders: recentOrdersRows,
    }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Failed to load seller dashboard'));
  }
});

// ── GET /seller/analytics?period=30d ─────────────────────────────────────────
sellerAnalyticsRouter.get('/analytics', async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const period = (req.query.period as string) || '30d';
  const days = parseInt(period.replace('d', ''), 10) || 30;

  try {
    const [kpiRows, trendRows, categoryRows, funnelRows, topListingsRows, geoRows] = await Promise.all([
      queryOne(
        `SELECT
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           0 AS revenue_change_pct,
           COUNT(DISTINCT o.id) AS orders,
           0 AS orders_change_pct,
           CASE WHEN COUNT(DISTINCT o.id) > 0 THEN COALESCE(SUM(o.total_amount), 0) / COUNT(DISTINCT o.id) ELSE 0 END AS avg_order_value,
           0 AS aov_change_pct,
           (SELECT COUNT(*) FROM listings l2 JOIN seller_profiles sp2 ON l2.seller_id = sp2.id WHERE sp2.user_id = $1 AND l2.status IN ('live','active') AND l2.deleted_at IS NULL) AS active_listings
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         WHERE sp.user_id = $1
           AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
           AND o.status NOT IN ('cancelled','refunded')`,
        [userId, days]
      ),
      query(
        `SELECT TO_CHAR(gs.d, 'YYYY-MM-DD') AS date,
                COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM generate_series(NOW() - ($2 || ' days')::INTERVAL, NOW(), INTERVAL '1 day') gs(d)
         LEFT JOIN orders o ON DATE(o.created_at) = DATE(gs.d)
           AND o.status NOT IN ('cancelled','refunded')
           AND o.listing_id IN (SELECT id FROM listings l JOIN seller_profiles sp ON l.seller_id = sp.id WHERE sp.user_id = $1)
         GROUP BY gs.d ORDER BY gs.d`,
        [userId, days]
      ),
      query(
        `SELECT s.name AS sector, COALESCE(SUM(o.total_amount), 0) AS gmv, COUNT(DISTINCT o.id) AS orders
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         LEFT JOIN sectors s ON l.sector_id = s.id
         WHERE sp.user_id = $1 AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
           AND o.status NOT IN ('cancelled','refunded')
         GROUP BY s.name ORDER BY gmv DESC LIMIT 8`,
        [userId, days]
      ),
      queryOne(
        `SELECT
           COALESCE(SUM(l.view_count), 0) AS views,
           COALESCE(SUM(l.watchlist_count), 0) AS watchlists,
           COUNT(DISTINCT o.id) AS orders
         FROM listings l
         JOIN seller_profiles sp ON l.seller_id = sp.id
         LEFT JOIN orders o ON o.listing_id = l.id AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
         WHERE sp.user_id = $1 AND l.deleted_at IS NULL`,
        [userId, days]
      ),
      query(
        `SELECT l.id, l.title, l.view_count AS views,
                COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(o.total_amount), 0) AS revenue,
                CASE WHEN l.view_count > 0 THEN ROUND(COUNT(DISTINCT o.id)::numeric / l.view_count * 100, 2) ELSE 0 END AS conversion_pct
         FROM listings l
         JOIN seller_profiles sp ON l.seller_id = sp.id
         LEFT JOIN orders o ON o.listing_id = l.id AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
         WHERE sp.user_id = $1 AND l.deleted_at IS NULL
         GROUP BY l.id ORDER BY revenue DESC LIMIT 10`,
        [userId, days]
      ),
      query(
        `SELECT COALESCE(a.state, 'Unknown') AS state,
                COUNT(DISTINCT o.id) AS order_count,
                COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
         JOIN seller_profiles sp ON l.seller_id = sp.id
         LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
         LEFT JOIN buyer_addresses a ON a.buyer_id = bp.id AND a.is_default = true
         WHERE sp.user_id = $1 AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
           AND o.status NOT IN ('cancelled','refunded')
         GROUP BY a.state ORDER BY revenue DESC LIMIT 10`,
        [userId, days]
      ),
    ]);

    res.json(successResponse({
      kpis: kpiRows,
      revenue_trend: trendRows,
      category_performance: categoryRows,
      funnel: funnelRows,
      top_listings: topListingsRows,
      geo: geoRows,
    }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Failed to load analytics'));
  }
});
