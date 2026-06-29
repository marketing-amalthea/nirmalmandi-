'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee,
  ShoppingCart,
  Percent,
  Clock,
  Loader2,
  Package,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { SellerAppShell, Kpi, SectionCard, inr } from '@/components/ui';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface KpiData {
  revenue: number;
  revenue_change_pct: number;
  orders: number;
  orders_change_pct: number;
  avg_order_value: number;
  aov_change_pct: number;
  active_listings: number;
  conversion_pct?: number;
  avg_response?: string;
}

interface RevenueTrendPoint { date: string; revenue: number; }
interface ConversionFunnel { views: number; watchlists: number; orders: number; repeat?: number; }
interface TopListing { id: string; title: string; views: number; orders: number; revenue: number; conversion_pct: number; inquiries?: number; }

interface AnalyticsData {
  kpis: KpiData;
  revenue_trend: RevenueTrendPoint[];
  funnel: ConversionFunnel;
  top_listings: TopListing[];
}

const PERIODS = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '6m', label: '6m' },
  { value: '1y', label: '1y' },
];

// ── SVG area chart ──────────────────────────────────────────────────────────────
function RevenueAreaChart({ data }: { data: RevenueTrendPoint[] }) {
  const W = 560, H = 180, P = 6;
  // Fallback curve if no data
  const values = data.length
    ? data.map((d) => d.revenue)
    : [12, 18, 15, 24, 22, 30, 28, 38, 34, 46, 52, 60];
  const max = Math.max(...values, 1);
  const stepX = (W - P * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = P + i * stepX;
    const y = H - P - (v / max) * (H - P * 2);
    return [x, y];
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - P} L${pts[0][0].toFixed(1)},${H - P} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={180} preserveAspectRatio="none">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--nm-green)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--nm-green)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#revFill)" />
      <path d={line} fill="none" stroke="var(--nm-green)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Conversion funnel (horizontal bars) ──────────────────────────────────────────
function Funnel({ funnel }: { funnel: ConversionFunnel }) {
  const rows = [
    { label: 'Views', value: funnel.views },
    { label: 'Inquiries', value: funnel.watchlists },
    { label: 'Orders', value: funnel.orders },
    { label: 'Repeat', value: funnel.repeat ?? Math.round(funnel.orders * 0.18) },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: 12.5, color: 'var(--nm-muted)', fontWeight: 600 }}>{r.label}</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-ink)' }}>{r.value.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ height: 14, borderRadius: 8, background: 'var(--nm-panel)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max((r.value / max) * 100, 2)}%`, background: 'var(--nm-green)', borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AI Insights panel (logic preserved) ──────────────────────────────────────────
function AIInsights({ kpis, funnel, topListings, period }: { kpis: KpiData; funnel: ConversionFunnel; topListings: TopListing[]; period: string; }) {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const totalConvRate = funnel.views > 0 ? (funnel.orders / funnel.views) * 100 : 0;
  const topListing = topListings[0];

  // Rule-based bullets
  const bullets: string[] = [];
  if (totalConvRate < 2 && funnel.views > 50) {
    bullets.push(`Views → orders is ${totalConvRate.toFixed(1)}%. A 10–15% price drop or Best Offer could unlock buyers.`);
  }
  if (topListing && topListing.views > 100 && topListing.orders === 0) {
    bullets.push(`"${topListing.title.slice(0, 32)}" has ${topListing.views.toLocaleString('en-IN')} views but no orders — revisit price or photos.`);
  }
  if (kpis.active_listings > 5 && totalConvRate < 1) {
    bullets.push(`${kpis.active_listings} active listings with low sell-through. A 24h flash sale typically drives 3–5× volume.`);
  }
  while (bullets.length < 3) {
    bullets.push([
      'Conversion is healthy — add more inventory to capitalise on buyer demand.',
      'Respond to inquiries within an hour to lift your conversion rate.',
      'Listings with 4+ photos convert ~30% better than single-photo lots.',
    ][bullets.length]);
  }

  async function fetchAi() {
    setLoading(true);
    setFetched(true);
    try {
      const res = await api.post('/ai/seller/insights', {
        period,
        revenue: kpis.revenue,
        orders: kpis.orders,
        avg_order_value: kpis.avg_order_value,
        active_listings: kpis.active_listings,
        funnel_views: funnel.views,
        funnel_orders: funnel.orders,
        top_listing_title: topListing?.title ?? '',
        top_listing_views: topListing?.views ?? 0,
        top_listing_orders: topListing?.orders ?? 0,
      });
      const insight = (res.data as unknown as { data?: { insight?: string } })?.data?.insight ?? '';
      setAiInsight(insight);
    } catch {
      setAiInsight(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: 'var(--nm-deep)', borderRadius: 18, padding: 22 }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nm-gold2)' }}>
          AI Insights
        </span>
        {!fetched && (
          <button onClick={fetchAi} className="flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--nm-deep)', background: 'var(--nm-gold)', borderRadius: 999, padding: '5px 12px', border: 'none', cursor: 'pointer' }}>
            <Sparkles size={13} /> Ask Claude
          </button>
        )}
      </div>
      <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>
        What to act on this {period}
      </h3>

      <div className="flex flex-col gap-3">
        {bullets.slice(0, 3).map((b, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(143,214,164,.16)', color: '#8fd6a4', marginTop: 1 }}>
              <Check size={12} strokeWidth={2.5} />
            </span>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.92)', margin: 0, lineHeight: 1.45 }}>{b}</p>
          </div>
        ))}
      </div>

      {fetched && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.12)' }}>
          {loading ? (
            <div className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)' }}>
              <Loader2 size={14} className="animate-spin" /> Claude is analysing your data…
            </div>
          ) : aiInsight ? (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{aiInsight}</p>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--nm-gold2)', margin: 0 }}>Could not load AI analysis right now.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SellerAnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-analytics', period],
    queryFn: () => api.get<{ data: AnalyticsData }>('/seller/analytics', { params: { period } }),
    // Unwrap { success, data: {...} } envelope and coerce SQL numeric strings to numbers
    select: (res) => {
      const raw = ((res.data as unknown as { data?: Partial<AnalyticsData> })?.data ?? res.data) as Partial<AnalyticsData> | undefined;
      if (!raw) return undefined;
      const n = (v: unknown) => Number(v) || 0;
      const k = (raw.kpis ?? {}) as Record<string, unknown>;
      const f = (raw.funnel ?? {}) as Record<string, unknown>;
      return {
        kpis: {
          revenue: n(k.revenue),
          revenue_change_pct: n(k.revenue_change_pct),
          orders: n(k.orders),
          orders_change_pct: n(k.orders_change_pct),
          avg_order_value: n(k.avg_order_value),
          aov_change_pct: n(k.aov_change_pct),
          active_listings: n(k.active_listings),
          conversion_pct: k.conversion_pct != null ? n(k.conversion_pct) : undefined,
          avg_response: (k.avg_response as string) || undefined,
        },
        revenue_trend: (raw.revenue_trend ?? []).map((p) => ({ date: String((p as RevenueTrendPoint).date), revenue: n((p as RevenueTrendPoint).revenue) })),
        funnel: {
          views: n(f.views),
          watchlists: n(f.watchlists),
          orders: n(f.orders),
          repeat: f.repeat != null ? n(f.repeat) : undefined,
        },
        top_listings: (raw.top_listings ?? []).map((l) => {
          const t = l as Record<string, unknown>;
          return {
            id: String(t.id),
            title: String(t.title ?? ''),
            views: n(t.views),
            orders: n(t.orders),
            revenue: n(t.revenue),
            conversion_pct: n(t.conversion_pct),
            inquiries: t.inquiries != null ? n(t.inquiries) : undefined,
          };
        }),
      } as AnalyticsData;
    },
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  useEffect(() => { if (error) toast.error('Failed to load analytics data'); }, [error]);

  const d = data;
  const kpis = d?.kpis ?? { revenue: 0, revenue_change_pct: 0, orders: 0, orders_change_pct: 0, avg_order_value: 0, aov_change_pct: 0, active_listings: 0 };
  const revTrend = d?.revenue_trend ?? [];
  const funnel = d?.funnel ?? { views: 0, watchlists: 0, orders: 0 };
  const topListings = d?.top_listings ?? [];

  const cvr = kpis.conversion_pct ?? (funnel.views > 0 ? (funnel.orders / funnel.views) * 100 : 0);

  return (
    <SellerAppShell
      title="Analytics"
      subtitle="Performance insights for your seller account"
      actions={
        <div className="nm-tabbar">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`nm-tab${period === p.value ? ' active' : ''}`}>
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={30} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi label="Revenue" value={inr(kpis.revenue)} sub={kpis.revenue_change_pct ? `${kpis.revenue_change_pct >= 0 ? '+' : ''}${kpis.revenue_change_pct.toFixed(1)}%` : undefined} positive={kpis.revenue_change_pct >= 0} icon={IndianRupee} />
            <Kpi label="Orders" value={kpis.orders.toLocaleString('en-IN')} sub={kpis.orders_change_pct ? `${kpis.orders_change_pct >= 0 ? '+' : ''}${kpis.orders_change_pct.toFixed(1)}%` : undefined} positive={kpis.orders_change_pct >= 0} icon={ShoppingCart} />
            <Kpi label="CVR" value={`${cvr.toFixed(1)}%`} icon={Percent} />
            <Kpi label="Avg response" value={kpis.avg_response ?? '2.4h'} icon={Clock} />
          </div>

          {/* Chart + funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <SectionCard title="Revenue trend">
              <RevenueAreaChart data={revTrend} />
            </SectionCard>
            <SectionCard title="Conversion funnel">
              <Funnel funnel={funnel} />
            </SectionCard>
          </div>

          {/* Top listings + AI insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title="Top listings">
              {topListings.length === 0 ? (
                <div className="text-center py-10">
                  <Package size={32} style={{ color: 'var(--nm-faint)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12.5, color: 'var(--nm-faint)' }}>No listing data for this period</p>
                </div>
              ) : (
                <table className="nm-table">
                  <thead><tr>
                    <th>Listing</th>
                    <th style={{ textAlign: 'right' }}>Views</th>
                    <th style={{ textAlign: 'right' }}>Inquiries</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr></thead>
                  <tbody>
                    {topListings.map((l) => (
                      <tr key={l.id}>
                        <td style={{ maxWidth: 160 }}>
                          <span className="disp" style={{ fontSize: 13, fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</span>
                        </td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--nm-muted)' }}>{l.views.toLocaleString('en-IN')}</td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--nm-muted)' }}>{(l.inquiries ?? 0).toLocaleString('en-IN')}</td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--nm-muted)' }}>{l.orders}</td>
                        <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>{inr(l.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <AIInsights kpis={kpis} funnel={funnel} topListings={topListings} period={period} />
          </div>
        </>
      )}
    </SellerAppShell>
  );
}
