/**
 * Demand-Supply Gap Engine
 * Compares what buyers search for vs. what's available.
 * Runs hourly. Feeds admin dashboard gap map + seller acquisition targets.
 */
import { query } from '@nirmalmandi/shared';

export interface DemandSupplyGap {
  sector_slug: string;
  sector_name: string;
  city: string;
  state: string;
  search_volume_7d: number;
  active_listings: number;
  gap_score: number; // high = opportunity
  recommendation: string;
}

export async function getDemandSupplyGap(): Promise<DemandSupplyGap[]> {
  // Active listings per sector+city
  const supply = await query<{ sector_slug: string; city: string; state: string; listing_count: number }>(
    `SELECT s.slug as sector_slug, l.city, l.state, COUNT(l.id) as listing_count
     FROM listings l
     JOIN sectors s ON l.sector_id = s.id
     WHERE l.status = 'live'
     GROUP BY s.slug, l.city, l.state`
  );

  // For MVP: approximate demand from orders + watchlists as proxy for search
  const demand = await query<{ sector_slug: string; city: string; state: string; demand_signals: number }>(
    `SELECT s.slug as sector_slug, l.city, l.state,
            COUNT(DISTINCT o.buyer_id) + COUNT(DISTINCT w.buyer_id) as demand_signals
     FROM listings l
     JOIN sectors s ON l.sector_id = s.id
     LEFT JOIN orders o ON o.listing_id = l.id AND o.created_at >= NOW() - INTERVAL '7 days'
     LEFT JOIN watchlist w ON w.listing_id = l.id AND w.created_at >= NOW() - INTERVAL '7 days'
     GROUP BY s.slug, l.city, l.state`
  );

  // Cross-reference and compute gap
  const supplyMap = new Map(supply.map(r => [`${r.sector_slug}:${r.city}:${r.state}`, r.listing_count]));
  const gaps: DemandSupplyGap[] = [];

  // Also get sector names
  const sectors = await query<{ slug: string; name: string }>('SELECT slug, name FROM sectors');
  const sectorNames = new Map(sectors.map(s => [s.slug, s.name]));

  for (const d of demand) {
    const supplyCount = supplyMap.get(`${d.sector_slug}:${d.city}:${d.state}`) ?? 0;
    const gap_score = d.demand_signals > 0 && supplyCount === 0
      ? 1.0
      : d.demand_signals > supplyCount * 2
      ? 0.8
      : d.demand_signals > supplyCount
      ? 0.5
      : 0.1;

    if (gap_score >= 0.5) {
      gaps.push({
        sector_slug: d.sector_slug,
        sector_name: sectorNames.get(d.sector_slug) ?? d.sector_slug,
        city: d.city,
        state: d.state,
        search_volume_7d: d.demand_signals,
        active_listings: supplyCount,
        gap_score,
        recommendation: supplyCount === 0
          ? `No ${d.sector_slug} listings in ${d.city} — acquire sellers urgently`
          : `High demand vs supply ratio in ${d.city} — recruit more ${d.sector_slug} sellers`,
      });
    }
  }

  return gaps.sort((a, b) => b.gap_score - a.gap_score).slice(0, 20);
}
