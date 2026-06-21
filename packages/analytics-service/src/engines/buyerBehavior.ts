/**
 * BI Engine 5 — Buyer Behavior Event Stream
 * Ingests events from web/mobile; aggregates funnels, search intent, drop-off.
 * Primary store: Postgres buyer_events table.
 * ClickHouse dual-write: enabled when CLICKHOUSE_URL is set (production).
 */
import { query, queryOne } from '@nirmalmandi/shared';

export type EventType =
  | 'page_view'
  | 'search'
  | 'listing_view'
  | 'watchlist_add'
  | 'cart_add'
  | 'checkout_started'
  | 'purchase_completed'
  | 'rfq_sent'
  | 'negotiation_started'
  | 'deal_shared';

export interface BuyerEvent {
  event_type: EventType;
  user_id?: string;
  session_id?: string;
  device_type?: string;
  listing_id?: string;
  sector_id?: string;
  search_query?: string;
  state?: string;
  city?: string;
  price_seen?: number;
  quantity?: number;
  properties?: Record<string, unknown>;
}

// ClickHouse client is optional — lazy-loaded only when URL is configured
let _ch: unknown = null;
async function getClickHouseClient(): Promise<unknown> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return null;
  if (_ch) return _ch;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional peer dep, only available when CLICKHOUSE_URL is set
    const { createClient } = await import('@clickhouse/client');
    _ch = createClient({ url });
    return _ch;
  } catch {
    return null;
  }
}

export async function ingestEvent(event: BuyerEvent): Promise<void> {
  // Always write to Postgres
  await query(
    `INSERT INTO buyer_events
       (event_type, user_id, session_id, device_type, listing_id, sector_id,
        search_query, state, city, price_seen, quantity, properties)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      event.event_type,
      event.user_id ?? null,
      event.session_id ?? null,
      event.device_type ?? null,
      event.listing_id ?? null,
      event.sector_id ?? null,
      event.search_query ?? null,
      event.state ?? null,
      event.city ?? null,
      event.price_seen ?? null,
      event.quantity ?? null,
      JSON.stringify(event.properties ?? {}),
    ]
  );

  // Dual-write to ClickHouse if available (fire-and-forget)
  const ch = await getClickHouseClient();
  if (ch) {
    (ch as { insert: (args: unknown) => Promise<void> })
      .insert({ table: 'buyer_events', values: [event], format: 'JSONEachRow' })
      .catch(() => {}); // never block on CH failure
  }
}

export async function getBuyerBehaviorSummary(days = 7) {
  const [funnel, topSearches, topSectors, deviceBreakdown, dropOffPoints] = await Promise.all([
    // Acquisition funnel: events per stage
    query<{ event_type: string; count: number }>(
      `SELECT event_type, COUNT(*) as count
       FROM buyer_events
       WHERE created_at >= NOW() - INTERVAL '${days} days'
         AND event_type IN ('listing_view','watchlist_add','cart_add','checkout_started','purchase_completed')
       GROUP BY event_type
       ORDER BY count DESC`
    ),

    // Top search queries
    query<{ search_query: string; count: number }>(
      `SELECT search_query, COUNT(*) as count
       FROM buyer_events
       WHERE event_type = 'search'
         AND search_query IS NOT NULL
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY search_query
       ORDER BY count DESC
       LIMIT 15`
    ),

    // Events by sector
    query<{ sector_name: string; events: number }>(
      `SELECT s.name as sector_name, COUNT(be.id) as events
       FROM buyer_events be
       JOIN sectors s ON s.id = be.sector_id
       WHERE be.created_at >= NOW() - INTERVAL '${days} days'
         AND be.sector_id IS NOT NULL
       GROUP BY s.name
       ORDER BY events DESC
       LIMIT 10`
    ),

    // Device breakdown
    query<{ device_type: string; count: number }>(
      `SELECT COALESCE(device_type,'unknown') as device_type, COUNT(*) as count
       FROM buyer_events
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY device_type
       ORDER BY count DESC`
    ),

    // Drop-off: sessions that viewed but didn't purchase
    queryOne<{ viewed: number; purchased: number; drop_off_pct: number }>(
      `WITH sessions AS (
         SELECT session_id,
           MAX(CASE WHEN event_type = 'listing_view' THEN 1 ELSE 0 END) as viewed,
           MAX(CASE WHEN event_type = 'purchase_completed' THEN 1 ELSE 0 END) as purchased
         FROM buyer_events
         WHERE created_at >= NOW() - INTERVAL '${days} days'
           AND session_id IS NOT NULL
         GROUP BY session_id
       )
       SELECT
         SUM(viewed) as viewed,
         SUM(purchased) as purchased,
         ROUND(100.0 * (1 - SUM(purchased)::NUMERIC / NULLIF(SUM(viewed),0)), 1) as drop_off_pct
       FROM sessions`
    ),
  ]);

  return { funnel, topSearches, topSectors, deviceBreakdown, dropOffPoints };
}
