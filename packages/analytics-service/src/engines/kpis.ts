import { query, queryOne } from '@nirmalmandi/shared';

export async function getPlatformKpis(period: string) {
  const interval = period === 'today' ? '1 day' : period === 'week' ? '7 days' : '30 days';
  const prevInterval = period === 'today' ? '2 days' : period === 'week' ? '14 days' : '60 days';

  const [current, previous] = await Promise.all([
    queryOne<Record<string, number>>(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('completed','delivered','shipped') THEN total_amount END),0) as gmv,
         COUNT(CASE WHEN status IN ('completed','delivered','shipped') THEN 1 END) as completed_orders,
         COALESCE(SUM(CASE WHEN status IN ('completed','delivered','shipped') THEN platform_commission END),0) as commission
       FROM orders WHERE created_at >= NOW() - INTERVAL '${interval}'`
    ),
    queryOne<Record<string, number>>(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('completed','delivered','shipped') THEN total_amount END),0) as gmv,
         COUNT(CASE WHEN status IN ('completed','delivered','shipped') THEN 1 END) as completed_orders,
         COALESCE(SUM(CASE WHEN status IN ('completed','delivered','shipped') THEN platform_commission END),0) as commission
       FROM orders WHERE created_at >= NOW() - INTERVAL '${prevInterval}' AND created_at < NOW() - INTERVAL '${interval}'`
    ),
  ]);

  const [activeSellers, activeBuyers, activeListings, openDisputes, pendingKyc, pendingCategories] =
    await Promise.all([
      queryOne<{ count: string }>(`SELECT COUNT(DISTINCT seller_id) as count FROM orders WHERE created_at >= NOW() - INTERVAL '${interval}'`),
      queryOne<{ count: string }>(`SELECT COUNT(DISTINCT buyer_id) as count FROM orders WHERE created_at >= NOW() - INTERVAL '${interval}'`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM listings WHERE status = 'live'`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM disputes WHERE status IN ('open','under_review')`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM seller_profiles WHERE kyc_status = 'in_review'`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM sectors WHERE is_ai_generated = true AND admin_approved = false`),
    ]);

  const trend = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;

  const c = current!;
  const p = previous!;

  return {
    gmv: { value: c.gmv, trend: trend(c.gmv, p.gmv) },
    commission: { value: c.commission, trend: trend(c.commission, p.commission) },
    completed_orders: { value: c.completed_orders, trend: trend(c.completed_orders, p.completed_orders) },
    active_sellers: { value: parseInt(activeSellers?.count ?? '0'), },
    active_buyers: { value: parseInt(activeBuyers?.count ?? '0') },
    active_listings: { value: parseInt(activeListings?.count ?? '0') },
    open_disputes: { value: parseInt(openDisputes?.count ?? '0') },
    pending_kyc: { value: parseInt(pendingKyc?.count ?? '0') },
    pending_categories: { value: parseInt(pendingCategories?.count ?? '0') },
    period,
    generated_at: new Date(),
  };
}
