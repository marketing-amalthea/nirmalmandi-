/**
 * Inventory Aging Risk Engine
 * Flags listings that haven't sold — scores risk and recommends intervention.
 * Rules: >30 days = yellow, >60 days = red.
 * ML adjustment by sector (cars age differently than FMCG).
 */
import { query } from '@nirmalmandi/shared';

export interface AgingRisk {
  listing_id: string;
  title: string;
  seller_id: string;
  seller_name: string;
  sector_slug: string;
  asking_price: number;
  days_listed: number;
  views_count: number;
  inquiries_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  interventions: string[];
}

// Sector-specific aging thresholds (days before considering at risk)
const SECTOR_THRESHOLDS: Record<string, { yellow: number; red: number }> = {
  automobiles: { yellow: 45, red: 90 },
  fmcg: { yellow: 14, red: 30 },
  pharma: { yellow: 21, red: 45 },
  clothing: { yellow: 30, red: 60 },
  furniture: { yellow: 45, red: 90 },
  software: { yellow: 60, red: 120 },
  machinery: { yellow: 60, red: 120 },
  default: { yellow: 30, red: 60 },
};

export async function getAgingRisk(): Promise<AgingRisk[]> {
  const listings = await query<{
    listing_id: string; title: string; seller_id: string; seller_name: string;
    sector_slug: string; asking_price: number; days_listed: number;
    views_count: number; inquiries_count: number; expiry_date: string | null;
  }>(
    `SELECT l.id as listing_id, l.title, l.seller_id,
            sp.business_name as seller_name, s.slug as sector_slug,
            l.asking_price,
            EXTRACT(DAY FROM NOW() - l.created_at)::integer as days_listed,
            l.views_count, l.inquiries_count, l.expiry_date
     FROM listings l
     JOIN sectors s ON l.sector_id = s.id
     JOIN seller_profiles sp ON l.seller_id = sp.id
     WHERE l.status = 'live'
       AND l.created_at < NOW() - INTERVAL '14 days'
     ORDER BY l.created_at ASC
     LIMIT 200`
  );

  return listings.map(l => {
    const thresholds = SECTOR_THRESHOLDS[l.sector_slug] ?? SECTOR_THRESHOLDS.default;
    const interventions: string[] = [];

    // Risk scoring
    let risk_score = 0;
    if (l.days_listed > thresholds.red) risk_score = 0.9;
    else if (l.days_listed > thresholds.yellow) risk_score = 0.6;
    else risk_score = 0.3;

    // Low engagement amplifies risk
    if (l.views_count < 10) risk_score = Math.min(1, risk_score + 0.1);
    if (l.inquiries_count === 0 && l.days_listed > 7) risk_score = Math.min(1, risk_score + 0.1);

    // Expiry proximity
    if (l.expiry_date) {
      const daysToExpiry = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000);
      if (daysToExpiry <= 30) risk_score = Math.min(1, risk_score + 0.2);
    }

    const risk_level: AgingRisk['risk_level'] =
      risk_score >= 0.8 ? 'critical' :
      risk_score >= 0.6 ? 'high' :
      risk_score >= 0.4 ? 'medium' : 'low';

    // Generate interventions
    if (risk_level === 'critical' || risk_level === 'high') {
      interventions.push('Reduce price by 15–20%');
      interventions.push('Activate flash sale (24h window)');
      interventions.push('Contact seller for urgency push');
    }
    if (l.views_count < 10) interventions.push('Feature this listing to increase visibility');
    if (l.inquiries_count === 0) interventions.push('Enable Best Offer mode to attract negotiation');
    if (risk_level === 'medium') interventions.push('Add urgency badge to listing');

    return {
      listing_id: l.listing_id,
      title: l.title,
      seller_id: l.seller_id,
      seller_name: l.seller_name,
      sector_slug: l.sector_slug,
      asking_price: l.asking_price,
      days_listed: l.days_listed,
      views_count: l.views_count,
      inquiries_count: l.inquiries_count,
      risk_level,
      risk_score: Math.round(risk_score * 100) / 100,
      interventions,
    };
  }).filter(l => l.risk_level !== 'low');
}
