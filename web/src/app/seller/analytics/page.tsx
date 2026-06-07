'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  Loader2,
  BarChart2,
  Eye,
  Bookmark,
} from 'lucide-react';
import { toast } from 'sonner';
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
}

interface RevenueTrendPoint {
  date: string;
  revenue: number;
}

interface CategoryPerformance {
  sector: string;
  gmv: number;
  orders: number;
}

interface ConversionFunnel {
  views: number;
  watchlists: number;
  orders: number;
}

interface TopListing {
  id: string;
  title: string;
  views: number;
  orders: number;
  revenue: number;
  conversion_pct: number;
}

interface GeoData {
  state: string;
  order_count: number;
  revenue: number;
}

interface AnalyticsData {
  kpis: KpiData;
  revenue_trend: RevenueTrendPoint[];
  category_performance: CategoryPerformance[];
  funnel: ConversionFunnel;
  top_listings: TopListing[];
  geo: GeoData[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCurrency(v: number) {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K';
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const PERIODS = [
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
  { value: '60d', label: '60d' },
  { value: '90d', label: '90d' },
];

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {up ? '+' : ''}{change.toFixed(1)}% vs prior period
        </div>
      )}
    </div>
  );
}

// ── Mini Bar Chart (pure CSS/text) ─────────────────────────────────────────────
function MiniBarChart({ data, maxVal }: { data: number[]; maxVal: number }) {
  const MAX_HEIGHT = 60;
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {data.map((v, i) => {
        const pct = maxVal > 0 ? (v / maxVal) : 0;
        const height = Math.max(2, Math.round(pct * MAX_HEIGHT));
        return (
          <div
            key={i}
            style={{ height: `${height}px` }}
            className="flex-1 bg-primary-400 rounded-t opacity-80 hover:opacity-100 transition-opacity"
            title={`₹${v.toLocaleString('en-IN')}`}
          />
        );
      })}
    </div>
  );
}

// ── Revenue Trend Chart ─────────────────────────────────────────────────────────
function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        No revenue data for this period
      </div>
    );
  }

  const values = data.map((d) => d.revenue);
  const maxVal = Math.max(...values, 1);
  // Show at most 30 labels
  const step = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="space-y-2">
      <MiniBarChart data={values} maxVal={maxVal} />
      <div className="flex justify-between text-xs text-gray-400">
        {data
          .filter((_, i) => i % step === 0 || i === data.length - 1)
          .map((d, i) => (
            <span key={i}>{formatDate(d.date)}</span>
          ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>₹0</span>
        <span>{formatCurrency(maxVal)}</span>
      </div>
    </div>
  );
}

// ── Category Bar Chart ─────────────────────────────────────────────────────────
function CategoryChart({ data }: { data: CategoryPerformance[] }) {
  if (!data.length) {
    return <div className="text-sm text-gray-400 py-4 text-center">No category data</div>;
  }
  const maxGmv = Math.max(...data.map((d) => d.gmv), 1);
  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d) => {
        const pct = (d.gmv / maxGmv) * 100;
        return (
          <div key={d.sector} className="flex items-center gap-3">
            <p className="text-xs text-gray-600 w-28 truncate flex-shrink-0">{d.sector}</p>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${pct}%` }}
                className="h-full bg-primary-500 rounded-full transition-all"
              />
            </div>
            <p className="text-xs font-semibold text-gray-700 w-16 text-right flex-shrink-0">
              {formatCurrency(d.gmv)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function FunnelChart({ funnel }: { funnel: ConversionFunnel }) {
  const wlRate = funnel.views > 0 ? ((funnel.watchlists / funnel.views) * 100).toFixed(1) : '0';
  const orderRate = funnel.watchlists > 0 ? ((funnel.orders / funnel.watchlists) * 100).toFixed(1) : '0';
  const totalRate = funnel.views > 0 ? ((funnel.orders / funnel.views) * 100).toFixed(1) : '0';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="text-center flex-1 min-w-24">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-1">
          <Eye className="w-6 h-6 text-primary-600" />
        </div>
        <p className="text-xl font-bold text-gray-900">{funnel.views.toLocaleString('en-IN')}</p>
        <p className="text-xs text-gray-500">Views</p>
      </div>

      <div className="flex flex-col items-center">
        <p className="text-xs font-bold text-green-600">{wlRate}%</p>
        <div className="w-8 h-0.5 bg-gray-300" />
      </div>

      <div className="text-center flex-1 min-w-24">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-1">
          <Bookmark className="w-6 h-6 text-amber-600" />
        </div>
        <p className="text-xl font-bold text-gray-900">{funnel.watchlists.toLocaleString('en-IN')}</p>
        <p className="text-xs text-gray-500">Watchlists</p>
      </div>

      <div className="flex flex-col items-center">
        <p className="text-xs font-bold text-green-600">{orderRate}%</p>
        <div className="w-8 h-0.5 bg-gray-300" />
      </div>

      <div className="text-center flex-1 min-w-24">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-1">
          <ShoppingCart className="w-6 h-6 text-green-600" />
        </div>
        <p className="text-xl font-bold text-gray-900">{funnel.orders.toLocaleString('en-IN')}</p>
        <p className="text-xs text-gray-500">Orders</p>
      </div>

      <div className="ml-auto pl-4 border-l border-gray-200">
        <p className="text-xs text-gray-500">Total Conversion</p>
        <p className="text-2xl font-bold text-primary-700">{totalRate}%</p>
      </div>
    </div>
  );
}

// ── AI Insights Panel ──────────────────────────────────────────────────────────
function AIInsightsPanel({
  kpis, funnel, topListings, period,
}: {
  kpis: KpiData;
  funnel: ConversionFunnel;
  topListings: TopListing[];
  period: string;
}) {
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Rule-based insights always visible
  const ruleInsights: { icon: string; title: string; body: string; cta: string; href: string; color: string }[] = [];
  const totalConvRate = funnel.views > 0 ? (funnel.orders / funnel.views) * 100 : 0;
  const topListing = topListings[0];

  if (totalConvRate < 2 && funnel.views > 50) {
    ruleInsights.push({
      icon: '💡', color: 'border-amber-200 bg-amber-50',
      title: 'Low conversion rate',
      body: `Views → orders is ${totalConvRate.toFixed(1)}%. Try a 10–15% price drop or Best Offer to unlock buyers.`,
      cta: 'Adjust prices', href: '/seller/listings',
    });
  }
  if (topListing && topListing.views > 100 && topListing.orders === 0) {
    ruleInsights.push({
      icon: '🔥', color: 'border-red-200 bg-red-50',
      title: `High traffic, zero orders on "${topListing.title.slice(0, 28)}…"`,
      body: `${topListing.views.toLocaleString('en-IN')} views but no conversions — price or description needs work.`,
      cta: 'Edit listing', href: '/seller/listings',
    });
  }
  if (kpis.active_listings > 5 && totalConvRate < 1) {
    ruleInsights.push({
      icon: '⚡', color: 'border-blue-200 bg-blue-50',
      title: 'Flash sale can unlock stuck inventory',
      body: `${kpis.active_listings} active listings, very low sell-through. A 24h flash sale drives 3–5× normal volume.`,
      cta: 'Create flash sale', href: '/seller/listings/new',
    });
  }
  if (ruleInsights.length === 0) {
    ruleInsights.push({
      icon: '✅', color: 'border-green-200 bg-green-50',
      title: 'Listings are performing well',
      body: 'Conversion is healthy. Add more inventory to capitalise on buyer demand.',
      cta: 'Add inventory', href: '/seller/listings/new',
    });
  }

  async function fetchAiInsights() {
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
      setAiInsights(insight);
    } catch {
      setAiInsights(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="text-sm font-semibold text-gray-900">AI Insights — {period}</h2>
        </div>
        {!fetched && (
          <button
            onClick={fetchAiInsights}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200"
          >
            <span>✨</span>
            Ask Claude
          </button>
        )}
      </div>

      {/* Rule-based insights */}
      {ruleInsights.slice(0, 3).map((ins, i) => (
        <div key={i} className={`border rounded-xl p-4 mb-3 last:mb-0 ${ins.color}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">{ins.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-1">{ins.title}</p>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">{ins.body}</p>
              <a href={ins.href} className="text-xs font-semibold text-primary-600 hover:underline">{ins.cta} →</a>
            </div>
          </div>
        </div>
      ))}

      {/* Claude AI insight */}
      {fetched && (
        <div className="mt-3 border border-indigo-200 bg-indigo-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-indigo-800">Claude Analysis</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <span className="animate-spin">⟳</span> Analysing your data…
            </div>
          ) : aiInsights ? (
            <p className="text-xs text-indigo-900 leading-relaxed whitespace-pre-wrap">{aiInsights}</p>
          ) : (
            <p className="text-xs text-red-500">Could not load AI analysis. Check that ANTHROPIC_API_KEY is set.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-7 bg-gray-200 rounded w-28" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 h-48 bg-gray-100 rounded-xl" />
        <div className="card p-5 h-48 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SellerAnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-analytics', period],
    queryFn: () =>
      api.get<{ data: AnalyticsData }>('/seller/analytics', { params: { period } }),
    select: (res) => (res.data as unknown as { data: AnalyticsData })?.data ?? res.data,
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  useEffect(() => {
    if (error) toast.error('Failed to load analytics data');
  }, [error]);

  if (!ready || isLoading) return <AnalyticsSkeleton />;

  const d = data;
  const kpis = d?.kpis ?? { revenue: 0, revenue_change_pct: 0, orders: 0, orders_change_pct: 0, avg_order_value: 0, aov_change_pct: 0, active_listings: 0 };
  const revTrend = d?.revenue_trend ?? [];
  const catPerf = d?.category_performance ?? [];
  const funnel = d?.funnel ?? { views: 0, watchlists: 0, orders: 0 };
  const topListings = d?.top_listings ?? [];
  const geo = d?.geo ?? [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performance insights for your seller account</p>
        </div>
        {/* Period selector */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p.value
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(kpis.revenue)}
          change={kpis.revenue_change_pct}
          icon={IndianRupee}
          iconColor="text-primary-600 bg-primary-50"
        />
        <KpiCard
          label="Orders"
          value={kpis.orders.toLocaleString('en-IN')}
          change={kpis.orders_change_pct}
          icon={ShoppingCart}
          iconColor="text-amber-600 bg-amber-50"
        />
        <KpiCard
          label="Avg Order Value"
          value={formatCurrency(kpis.avg_order_value)}
          change={kpis.aov_change_pct}
          icon={TrendingUp}
          iconColor="text-green-600 bg-green-50"
        />
        <KpiCard
          label="Active Listings"
          value={kpis.active_listings.toLocaleString('en-IN')}
          icon={Package}
          iconColor="text-indigo-600 bg-indigo-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Trend */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-900">Revenue Trend</h2>
            <span className="text-xs text-gray-400">({period})</span>
          </div>
          <RevenueTrendChart data={revTrend} />
        </div>

        {/* Category Performance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-900">Category Performance (GMV)</h2>
          </div>
          <CategoryChart data={catPerf} />
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
        <FunnelChart funnel={funnel} />
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Listings */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Top Listings</h2>
          </div>
          {topListings.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No listing data for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-2.5 font-medium">Title</th>
                    <th className="text-right px-4 py-2.5 font-medium">Views</th>
                    <th className="text-right px-4 py-2.5 font-medium">Orders</th>
                    <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
                    <th className="text-right px-4 py-2.5 font-medium">Conv%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topListings.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800 max-w-[150px] truncate">{l.title}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{l.views.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{l.orders}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(l.revenue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${l.conversion_pct >= 5 ? 'text-green-600' : l.conversion_pct >= 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {l.conversion_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Insights Panel */}
        <AIInsightsPanel kpis={kpis} funnel={funnel} topListings={topListings} period={period} />

        {/* Buyer Geography */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Buyer Geography</h2>
          </div>
          {geo.length === 0 ? (
            <div className="text-center py-10">
              <Loader2 className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No geographic data for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-2.5 font-medium">State</th>
                    <th className="text-right px-4 py-2.5 font-medium">Orders</th>
                    <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {geo.map((g) => (
                    <tr key={g.state} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800">{g.state}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{g.order_count.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(g.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
