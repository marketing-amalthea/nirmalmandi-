import { Router, Request, Response } from 'express';
import { authenticate, requireRole, query, queryOne, successResponse } from '@nirmalmandi/shared';
import { getDemandSupplyGap } from '../engines/demandSupply';
import { getAgingRisk } from '../engines/agingRisk';
import { getSalesVelocity } from '../engines/salesVelocity';
import { getRevenueForecast } from '../engines/revenueForecast';
import { getPlatformKpis } from '../engines/kpis';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.use(requireRole('admin', 'super_admin'));

// ── GET /analytics/kpis — Platform KPIs ─────────────────────
analyticsRouter.get('/kpis', async (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'today';
  const kpis = await getPlatformKpis(period);
  res.json(successResponse(kpis));
});

// ── GET /analytics/demand-supply-gap ────────────────────────
analyticsRouter.get('/demand-supply-gap', async (_req, res: Response) => {
  const gaps = await getDemandSupplyGap();
  res.json(successResponse(gaps));
});

// ── GET /analytics/aging-risk ────────────────────────────────
analyticsRouter.get('/aging-risk', async (_req, res: Response) => {
  const risks = await getAgingRisk();
  res.json(successResponse(risks));
});

// ── GET /analytics/revenue-forecast ─────────────────────────
analyticsRouter.get('/revenue-forecast', async (_req, res: Response) => {
  const forecast = await getRevenueForecast();
  res.json(successResponse(forecast));
});

// ── GET /analytics/sales-velocity/:listing_id ───────────────
analyticsRouter.get('/sales-velocity/:listing_id', async (req: Request, res: Response) => {
  const velocity = await getSalesVelocity(req.params.listing_id);
  res.json(successResponse(velocity));
});

// ── GET /analytics/gmv-trend — GMV over last 30 days ────────
analyticsRouter.get('/gmv-trend', async (_req, res: Response) => {
  const trend = await query<{ date: string; gmv: number; orders: number }>(
    `SELECT DATE(created_at) as date,
            SUM(total_amount) as gmv,
            COUNT(*) as orders
     FROM orders
     WHERE status IN ('completed','delivered','shipped')
       AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );
  res.json(successResponse(trend));
});

// ── GET /analytics/top-sellers ───────────────────────────────
analyticsRouter.get('/top-sellers', async (_req, res: Response) => {
  const sellers = await query(
    `SELECT sp.business_name, sp.verification_tier,
            COUNT(o.id) as total_orders,
            SUM(o.total_amount) as total_gmv,
            AVG(o.total_amount) as avg_order_value
     FROM orders o
     JOIN seller_profiles sp ON o.seller_id = sp.id
     WHERE o.status IN ('completed','delivered')
       AND o.created_at >= NOW() - INTERVAL '30 days'
     GROUP BY sp.id, sp.business_name, sp.verification_tier
     ORDER BY total_gmv DESC LIMIT 10`
  );
  res.json(successResponse(sellers));
});

// ── GET /analytics/sector-performance ───────────────────────
analyticsRouter.get('/sector-performance', async (_req, res: Response) => {
  const sectors = await query(
    `SELECT s.name, s.slug,
            COUNT(l.id) as active_listings,
            COALESCE(SUM(o.total_amount),0) as gmv_30d,
            COUNT(o.id) as orders_30d
     FROM sectors s
     LEFT JOIN listings l ON l.sector_id = s.id AND l.status = 'live'
     LEFT JOIN orders o ON o.listing_id = l.id
       AND o.created_at >= NOW() - INTERVAL '30 days'
       AND o.status IN ('completed','delivered')
     GROUP BY s.id, s.name, s.slug
     ORDER BY gmv_30d DESC`
  );
  res.json(successResponse(sectors));
});

// ── GET /analytics/ai-cost — AI spend tracking ──────────────
analyticsRouter.get('/ai-cost', async (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'today';
  const interval = period === 'today' ? '1 day' : period === 'week' ? '7 days' : '30 days';
  const cost = await queryOne<{ total_cost_usd: number; total_calls: number; avg_latency_ms: number }>(
    `SELECT SUM(cost_usd) as total_cost_usd,
            COUNT(*) as total_calls,
            AVG(latency_ms) as avg_latency_ms
     FROM ai_logs
     WHERE created_at >= NOW() - INTERVAL '${interval}'`
  );
  const byType = await query(
    `SELECT action_type, SUM(cost_usd) as cost, COUNT(*) as calls
     FROM ai_logs
     WHERE created_at >= NOW() - INTERVAL '${interval}'
     GROUP BY action_type ORDER BY cost DESC`
  );
  res.json(successResponse({ summary: cost, by_action_type: byType }));
});
