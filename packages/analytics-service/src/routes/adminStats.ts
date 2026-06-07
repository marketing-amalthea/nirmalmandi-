import { Router, Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@nirmalmandi/shared';

export const adminStatsRouter = Router();

// GET /admin/stats/dashboard
adminStatsRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const [
      gmvRows,
      listingsRows,
      sellersRows,
      buyersRows,
      commissionRows,
      disputesRows,
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE status = 'completed'`, []),
      query(`SELECT COUNT(*) AS total FROM listings WHERE status IN ('live','active')`, []),
      query(`SELECT COUNT(*) AS total FROM seller_profiles`, []),
      query(`SELECT COUNT(*) AS total FROM buyer_profiles`, []),
      query(`SELECT COALESCE(SUM(platform_commission), 0) AS total FROM orders WHERE DATE(created_at) = CURRENT_DATE`, []),
      query(`SELECT COUNT(*) AS total FROM disputes WHERE status = 'open'`, []),
    ]);

    const result = {
      totalGmv: parseFloat((gmvRows[0] as any).total as string) || 0,
      gmvChange: 0,
      activeListings: parseInt((listingsRows[0] as any).total as string, 10) || 0,
      listingsChange: 0,
      activeSellers: parseInt((sellersRows[0] as any).total as string, 10) || 0,
      sellersChange: 0,
      activeBuyers: parseInt((buyersRows[0] as any).total as string, 10) || 0,
      buyersChange: 0,
      todaysCommission: parseFloat((commissionRows[0] as any).total as string) || 0,
      commissionChange: 0,
      openDisputes: parseInt((disputesRows[0] as any).total as string, 10) || 0,
      disputesChange: 0,
    };

    res.json(successResponse(result));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});

// GET /admin/stats/gmv?days=30
adminStatsRouter.get('/gmv', async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt((req.query.days as string) || '30', 10)));

    const rows = await query(
      `SELECT TO_CHAR(gs.day, 'YYYY-MM-DD') AS date,
              COALESCE(SUM(o.total_amount), 0)  AS gmv
       FROM generate_series(
              (CURRENT_DATE - ($1 - 1) * INTERVAL '1 day'),
              CURRENT_DATE,
              INTERVAL '1 day'
            ) AS gs(day)
       LEFT JOIN orders o
              ON DATE(o.created_at) = gs.day AND o.status = 'completed'
       GROUP BY gs.day
       ORDER BY gs.day ASC`,
      [days]
    );

    const data = rows.map((r: any) => ({
      date: r.date as string,
      gmv: parseFloat(r.gmv as string) || 0,
    }));

    res.json(successResponse(data));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});

// GET /admin/stats/alerts
adminStatsRouter.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const [disputeTotal, agingTotal, kycTotal] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM disputes WHERE status = 'open'`, []),
      query(
        `SELECT COUNT(*) AS total FROM listings WHERE status IN ('live','active') AND created_at < NOW() - INTERVAL '30 days'`,
        []
      ),
      query(`SELECT COUNT(*) AS total FROM seller_profiles WHERE kyc_status = 'pending'`, []),
    ]);

    // Return as object matching dashboard AlertData interface
    res.json(successResponse({
      openDisputes: parseInt((disputeTotal[0] as any).total as string, 10) || 0,
      agingListings: parseInt((agingTotal[0] as any).total as string, 10) || 0,
      pendingKyc: parseInt((kycTotal[0] as any).total as string, 10) || 0,
    }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});

// GET /admin/stats/inventory-heatmap
adminStatsRouter.get('/inventory-heatmap', async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT
        s.name AS sector,
        SUM(CASE WHEN l.created_at >= NOW() - INTERVAL '7 days'  THEN 1 ELSE 0 END) AS age_0_7,
        SUM(CASE WHEN l.created_at >= NOW() - INTERVAL '14 days' AND l.created_at < NOW() - INTERVAL '7 days'  THEN 1 ELSE 0 END) AS age_8_14,
        SUM(CASE WHEN l.created_at >= NOW() - INTERVAL '30 days' AND l.created_at < NOW() - INTERVAL '14 days' THEN 1 ELSE 0 END) AS age_15_30,
        SUM(CASE WHEN l.created_at >= NOW() - INTERVAL '60 days' AND l.created_at < NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS age_31_60,
        SUM(CASE WHEN l.created_at < NOW() - INTERVAL '60 days' THEN 1 ELSE 0 END) AS age_60_plus,
        COUNT(*) AS total
      FROM listings l
      JOIN sectors s ON s.id = l.sector_id
      WHERE l.status IN ('live','active') AND l.deleted_at IS NULL
      GROUP BY s.name
      ORDER BY total DESC
      LIMIT 15
    `, []);
    res.json(successResponse(rows));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});

// GET /admin/stats/demand-supply
adminStatsRouter.get('/demand-supply', async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT
        s.name AS sector,
        COUNT(DISTINCT l.id) AS supply_listings,
        COALESCE(SUM(l.view_count), 0) AS total_views,
        COALESCE(SUM(l.watchlist_count), 0) AS total_watchlists,
        COALESCE(SUM(l.view_count), 0)::float /
          NULLIF(COUNT(DISTINCT l.id), 0) AS avg_views_per_listing,
        COUNT(DISTINCT o.id) AS orders_30d
      FROM sectors s
      LEFT JOIN listings l ON l.sector_id = s.id AND l.status IN ('live','active') AND l.deleted_at IS NULL
      LEFT JOIN orders o ON o.listing_id = l.id AND o.created_at >= NOW() - INTERVAL '30 days'
        AND o.status NOT IN ('cancelled','refunded')
      GROUP BY s.name
      HAVING COUNT(DISTINCT l.id) > 0
      ORDER BY total_views DESC
      LIMIT 15
    `, []);
    res.json(successResponse(rows));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});

// GET /admin/stats/seller-scorecard?limit=20
adminStatsRouter.get('/seller-scorecard', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, parseInt((req.query.limit as string) || '20', 10));
    const rows = await query(`
      SELECT
        sp.id,
        sp.business_name,
        sp.verification_tier,
        sp.kyc_status,
        COUNT(DISTINCT l.id) AS active_listings,
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS gmv,
        ROUND(sp.performance_score::numeric, 1) AS performance_score,
        ROUND(sp.dispute_rate::numeric * 100, 2) AS dispute_rate_pct,
        ROUND(sp.fulfillment_rate::numeric * 100, 1) AS fulfillment_rate_pct,
        ROUND(sp.response_rate::numeric * 100, 1) AS response_rate_pct,
        sp.created_at
      FROM seller_profiles sp
      LEFT JOIN listings l ON l.seller_id = sp.id AND l.status IN ('live','active') AND l.deleted_at IS NULL
      LEFT JOIN orders o ON o.listing_id IN (SELECT id FROM listings WHERE seller_id = sp.id)
        AND o.status NOT IN ('cancelled','refunded')
      WHERE sp.deleted_at IS NULL
      GROUP BY sp.id
      ORDER BY gmv DESC
      LIMIT $1
    `, [limit]);
    res.json(successResponse(rows));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});

// GET /admin/stats/recent-transactions
adminStatsRouter.get('/recent-transactions', async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT o.id,
              o.order_number AS "orderNumber",
              o.status,
              o.total_amount AS "amount",
              o.created_at   AS "createdAt",
              COALESCE(bp.business_name, buyer.name, 'Unknown') AS "buyerName",
              COALESCE(sp.business_name, seller.name, 'Unknown') AS "sellerName"
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       LEFT JOIN buyer_profiles bp ON o.buyer_id = bp.id
       LEFT JOIN users buyer ON bp.user_id = buyer.id
       LEFT JOIN seller_profiles sp ON l.seller_id = sp.id
       LEFT JOIN users seller ON sp.user_id = seller.id
       ORDER BY o.created_at DESC
       LIMIT 10`,
      []
    );

    res.json(successResponse(rows));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error', 'INTERNAL_ERROR'));
  }
});
