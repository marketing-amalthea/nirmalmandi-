/**
 * Sales Velocity Predictor
 * Estimates probability a listing will sell within 7/14/30 days.
 * At launch: rule-based heuristics (XGBoost trains monthly once real data accumulates).
 */
import { queryOne } from '@nirmalmandi/shared';

export interface SalesVelocityPrediction {
  listing_id: string;
  probability_7d: number;
  probability_14d: number;
  probability_30d: number;
  confidence: number;
  factors: string[];
}

export async function getSalesVelocity(listingId: string): Promise<SalesVelocityPrediction> {
  const listing = await queryOne<{
    asking_price: number; mrp: number; urgency_score: number;
    condition_grade: string; dead_stock_type: string; views_count: number;
    inquiries_count: number; watchlist_count: number; days_listed: number;
    sector_slug: string;
  }>(
    `SELECT l.asking_price, l.mrp, l.urgency_score, l.condition_grade,
            l.dead_stock_type, l.views_count, l.inquiries_count, l.watchlist_count,
            EXTRACT(DAY FROM NOW() - l.created_at)::integer as days_listed,
            s.slug as sector_slug
     FROM listings l JOIN sectors s ON l.sector_id = s.id
     WHERE l.id = $1`,
    [listingId]
  );

  if (!listing) {
    return { listing_id: listingId, probability_7d: 0, probability_14d: 0, probability_30d: 0, confidence: 0, factors: [] };
  }

  const factors: string[] = [];
  let base = 0.2;

  // Discount depth: deeper discounts sell faster
  const discount = listing.mrp > 0 ? (1 - listing.asking_price / listing.mrp) : 0;
  if (discount >= 0.5) { base += 0.3; factors.push('High discount (>50%) — strong buyer motivation'); }
  else if (discount >= 0.3) { base += 0.2; factors.push('Good discount (30-50%)'); }
  else if (discount >= 0.15) { base += 0.1; factors.push('Moderate discount'); }

  // Condition grade
  if (listing.condition_grade === 'A') { base += 0.15; factors.push('Grade A condition — premium appeal'); }
  else if (listing.condition_grade === 'B') base += 0.1;
  else if (listing.condition_grade === 'C') base -= 0.05;
  else { base -= 0.1; factors.push('Grade D — niche buyer needed'); }

  // Urgency
  if (listing.urgency_score > 0.7) { base += 0.15; factors.push('High urgency — buyer FOMO'); }
  else if (listing.urgency_score > 0.4) base += 0.08;

  // Engagement signals
  if (listing.watchlist_count > 5) { base += 0.1; factors.push('High watchlist count — buyer interest confirmed'); }
  if (listing.inquiries_count > 3) { base += 0.1; factors.push('Multiple inquiries received'); }
  if (listing.views_count > 50) { base += 0.05; factors.push('High view count'); }

  // Dead stock type
  if (listing.dead_stock_type === 'near_expiry') {
    base += 0.1;
    factors.push('Near-expiry — price-sensitive buyers often buy quickly');
  }

  // Sector liquidity multipliers (from historical data assumptions)
  const sectorMultipliers: Record<string, number> = {
    fmcg: 1.3, clothing: 1.2, software: 1.1, furniture: 0.9, automobiles: 0.8, machinery: 0.7,
  };
  base *= (sectorMultipliers[listing.sector_slug] ?? 1.0);

  const p7 = Math.min(0.95, Math.max(0.02, base * 0.5));
  const p14 = Math.min(0.95, Math.max(0.05, base * 0.75));
  const p30 = Math.min(0.95, Math.max(0.10, base));

  return {
    listing_id: listingId,
    probability_7d: Math.round(p7 * 100) / 100,
    probability_14d: Math.round(p14 * 100) / 100,
    probability_30d: Math.round(p30 * 100) / 100,
    confidence: listing.views_count > 20 ? 0.75 : 0.5,
    factors,
  };
}
