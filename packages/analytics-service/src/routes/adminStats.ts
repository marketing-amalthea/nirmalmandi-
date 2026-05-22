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
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
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
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
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
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
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
    res.status(500).json(errorResponse(err.message || 'Internal server error', 500));
  }
});
