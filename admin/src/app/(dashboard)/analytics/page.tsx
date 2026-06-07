'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi, adminAnalyticsApi } from '@/lib/api';
import StatsCard from '@/components/ui/StatsCard';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  IndianRupee,
  Package,
  Users,
  ShoppingCart,
  Scale,
  TrendingUp,
  RefreshCw,
  BarChart2,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DashboardData {
  totalGmv: number;
  gmvChange: number;
  activeListings: number;
  listingsChange: number;
  activeSellers: number;
  sellersChange: number;
  activeBuyers: number;
  buyersChange: number;
  todaysCommission: number;
  commissionChange: number;
  openDisputes: number;
  disputesChange: number;
}

interface GmvPoint {
  date: string;
  gmv: number;
}

interface AlertData {
  openDisputes: number;
  agingListings: number;
  pendingKyc: number;
}

function formatINR(val: number): string {
  if (val >= 10_000_000) return `${(val / 10_000_000).toFixed(2)}Cr`;
  if (val >= 100_000) return `${(val / 100_000).toFixed(2)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(0);
}

// ── Inventory Age Heatmap ─────────────────────────────────────────────────────
const AGE_BUCKETS = [
  { key: 'age_0_7',    label: '0–7d',   color: 'bg-green-500' },
  { key: 'age_8_14',   label: '8–14d',  color: 'bg-yellow-400' },
  { key: 'age_15_30',  label: '15–30d', color: 'bg-orange-400' },
  { key: 'age_31_60',  label: '31–60d', color: 'bg-red-400' },
  { key: 'age_60_plus',label: '60d+',   color: 'bg-red-700' },
];

function InventoryHeatmap() {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-heatmap'],
    queryFn: async () => { const r = await adminAnalyticsApi.getInventoryHeatmap(); return (r.data as any)?.data ?? []; },
    retry: 1,
  });
  const rows: any[] = data ?? [];

  return (
    <div className="nm-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={16} className="text-nm-primary" />
        <h2 className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">Inventory Age Heatmap</h2>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          {AGE_BUCKETS.map((b) => (
            <span key={b.key} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm inline-block ${b.color}`} />
              {b.label}
            </span>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="animate-pulse space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-7 bg-gray-100 dark:bg-gray-800 rounded"/>)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-nm-text-muted text-center py-6">No listing data</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row: any) => {
            const total = row.total || 1;
            return (
              <div key={row.sector} className="flex items-center gap-3">
                <p className="text-xs text-nm-text-muted w-28 flex-shrink-0 truncate">{row.sector}</p>
                <div className="flex-1 flex h-6 rounded overflow-hidden gap-px">
                  {AGE_BUCKETS.map((b) => {
                    const pct = (row[b.key] / total) * 100;
                    if (pct < 1) return null;
                    return (
                      <div
                        key={b.key}
                        style={{ width: `${pct}%` }}
                        className={`${b.color} opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center`}
                        title={`${b.label}: ${row[b.key]} listings`}
                      >
                        {row[b.key] > 2 && <span className="text-white text-[9px] font-bold">{row[b.key]}</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-nm-text w-10 text-right">{total}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Demand-Supply Gap ─────────────────────────────────────────────────────────
function DemandSupplyChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['demand-supply'],
    queryFn: async () => { const r = await adminAnalyticsApi.getDemandSupply(); return (r.data as any)?.data ?? []; },
    retry: 1,
  });
  const rows: any[] = (data ?? []).slice(0, 10);
  const maxViews = Math.max(...rows.map((r: any) => Number(r.total_views) || 0), 1);
  const maxListings = Math.max(...rows.map((r: any) => Number(r.supply_listings) || 0), 1);

  return (
    <div className="nm-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Scale size={16} className="text-nm-primary" />
        <h2 className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">Demand vs Supply by Sector</h2>
        <div className="ml-auto flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block"/>Demand (views)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block"/>Supply (listings)</span>
        </div>
      </div>
      {isLoading ? (
        <div className="animate-pulse space-y-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded"/>)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-nm-text-muted text-center py-6">No data</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row: any) => (
            <div key={row.sector}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-nm-text dark:text-nm-text-dark truncate max-w-[120px]">{row.sector}</p>
                <p className="text-[10px] text-nm-text-muted">{row.orders_30d} orders/30d</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] w-14 text-nm-text-muted flex-shrink-0">Demand</p>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div style={{ width: `${(row.total_views / maxViews) * 100}%` }} className="h-full bg-blue-400 rounded-full" />
                  </div>
                  <p className="text-[10px] w-12 text-right text-nm-text-muted">{Number(row.total_views).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] w-14 text-nm-text-muted flex-shrink-0">Supply</p>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div style={{ width: `${(row.supply_listings / maxListings) * 100}%` }} className="h-full bg-green-400 rounded-full" />
                  </div>
                  <p className="text-[10px] w-12 text-right text-nm-text-muted">{row.supply_listings}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Seller Scorecard ──────────────────────────────────────────────────────────
function SellerScorecard() {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-scorecard'],
    queryFn: async () => { const r = await adminAnalyticsApi.getSellerScorecard(20); return (r.data as any)?.data ?? []; },
    retry: 1,
  });
  const rows: any[] = data ?? [];

  return (
    <div className="nm-card overflow-hidden">
      <div className="px-5 py-4 border-b border-nm-border dark:border-nm-border-dark flex items-center gap-2">
        <Users size={16} className="text-nm-primary" />
        <h2 className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">Seller Performance Scorecard</h2>
        <span className="text-xs text-nm-text-muted ml-auto">Top 20 by GMV</span>
      </div>
      {isLoading ? (
        <div className="animate-pulse p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded"/>)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-nm-text-muted text-center py-10">No sellers yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-nm-text-muted uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Seller</th>
                <th className="text-left px-4 py-2.5 font-medium">Tier</th>
                <th className="text-right px-4 py-2.5 font-medium">GMV</th>
                <th className="text-right px-4 py-2.5 font-medium">Orders</th>
                <th className="text-right px-4 py-2.5 font-medium">Score</th>
                <th className="text-right px-4 py-2.5 font-medium">Dispute%</th>
                <th className="text-right px-4 py-2.5 font-medium">Fill%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nm-border dark:divide-nm-border-dark">
              {rows.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-nm-text dark:text-nm-text-dark max-w-[160px] truncate">{s.business_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      s.verification_tier === 'premium' ? 'bg-purple-100 text-purple-700' :
                      s.verification_tier === 'verified' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.verification_tier}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-nm-text dark:text-nm-text-dark">₹{formatINR(parseFloat(s.gmv) || 0)}</td>
                  <td className="px-4 py-2.5 text-right text-nm-text-muted">{s.total_orders}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-semibold ${parseFloat(s.performance_score) >= 80 ? 'text-green-600' : parseFloat(s.performance_score) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.performance_score}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={parseFloat(s.dispute_rate_pct) > 5 ? 'text-red-600 font-semibold' : 'text-nm-text-muted'}>
                      {s.dispute_rate_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={parseFloat(s.fulfillment_rate_pct) >= 90 ? 'text-green-600' : 'text-amber-600'}>
                      {s.fulfillment_rate_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="nm-card px-3 py-2 text-xs shadow-lg">
      <p className="text-nm-text-muted dark:text-nm-text-dark-muted mb-1">{label}</p>
      <p className="font-bold text-nm-primary">₹{formatINR(payload[0].value)}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [gmvDays, setGmvDays] = useState(30);

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery<DashboardData | null>({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => {
      const res = await statsApi.getDashboard();
      return res.data?.data ?? null;
    },
    retry: 1,
  });

  const { data: gmvHistory, isLoading: gmvLoading, refetch: refetchGmv } = useQuery<GmvPoint[]>({
    queryKey: ['analytics-gmv', gmvDays],
    queryFn: async () => {
      const res = await statsApi.getGmvHistory(gmvDays);
      return res.data?.data ?? [];
    },
    retry: 1,
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery<AlertData | null>({
    queryKey: ['analytics-alerts'],
    queryFn: async () => {
      const res = await statsApi.getAlerts();
      return res.data?.data ?? null;
    },
    retry: 1,
  });

  function refetchAll() {
    refetchDash();
    refetchGmv();
    refetchAlerts();
  }

  const gmv = gmvHistory ?? [];
  const d = dashboard;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Analytics</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Platform performance overview
          </p>
        </div>
        <button
          onClick={refetchAll}
          className="nm-btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {dashLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatsCard key={i} title="" value="" loading />
          ))}
        </div>
      ) : d ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatsCard
            title="Total GMV"
            value={formatINR(d.totalGmv)}
            prefix="₹"
            change={d.gmvChange}
            changeLabel="vs last month"
            icon={<IndianRupee size={16} className="text-nm-primary" />}
            iconBg="bg-nm-primary/10"
          />
          <StatsCard
            title="Commission Earned"
            value={formatINR(d.todaysCommission)}
            prefix="₹"
            change={d.commissionChange}
            changeLabel="vs yesterday"
            icon={<TrendingUp size={16} className="text-green-600" />}
            iconBg="bg-green-100 dark:bg-green-900/20"
          />
          <StatsCard
            title="Active Listings"
            value={d.activeListings.toLocaleString('en-IN')}
            change={d.listingsChange}
            changeLabel="vs last week"
            icon={<Package size={16} className="text-purple-600" />}
            iconBg="bg-purple-100 dark:bg-purple-900/20"
          />
          <StatsCard
            title="Active Sellers"
            value={d.activeSellers}
            change={d.sellersChange}
            changeLabel="vs last week"
            icon={<Users size={16} className="text-nm-accent" />}
            iconBg="bg-green-100 dark:bg-green-900/20"
          />
          <StatsCard
            title="Active Buyers"
            value={d.activeBuyers}
            change={d.buyersChange}
            changeLabel="vs last week"
            icon={<ShoppingCart size={16} className="text-blue-600" />}
            iconBg="bg-blue-100 dark:bg-blue-900/20"
          />
          <StatsCard
            title="Open Disputes"
            value={d.openDisputes}
            change={d.disputesChange}
            changeLabel="vs last week"
            icon={<Scale size={16} className="text-nm-danger" />}
            iconBg="bg-red-100 dark:bg-red-900/20"
          />
          {alerts && (
            <>
              <StatsCard
                title="Aging Listings"
                value={alerts.agingListings}
                icon={<Package size={16} className="text-nm-warning" />}
                iconBg="bg-yellow-100 dark:bg-yellow-900/20"
              />
              <StatsCard
                title="KYC Pending"
                value={alerts.pendingKyc}
                icon={<Users size={16} className="text-orange-600" />}
                iconBg="bg-orange-100 dark:bg-orange-900/20"
              />
            </>
          )}
        </div>
      ) : (
        <div className="nm-card p-8 text-center text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
          Analytics data unavailable. Click Refresh to try again.
        </div>
      )}

      {/* GMV Chart */}
      <div className="nm-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">GMV History</h2>
          <div className="flex gap-1">
            {([7, 14, 30, 60, 90] as const).map((days) => (
              <button
                key={days}
                onClick={() => setGmvDays(days)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  gmvDays === days
                    ? 'bg-nm-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-text dark:hover:text-nm-text-dark'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {gmvLoading ? (
          <div className="h-[260px] flex items-center justify-center">
            <div className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm animate-pulse">
              Loading chart data...
            </div>
          </div>
        ) : gmv.length === 0 ? (
          <div className="h-[260px] flex flex-col items-center justify-center gap-2">
            <BarChart2 size={32} className="text-nm-text-muted dark:text-nm-text-dark-muted" />
            <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
              No GMV data available for this period
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={gmv} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => {
                  try { return format(parseISO(d), 'd MMM'); } catch { return d; }
                }}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(gmv.length / 10) - 1)}
              />
              <YAxis
                tickFormatter={(v) => `₹${formatINR(v)}`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={68}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="gmv"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#2563eb' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Inventory Age Heatmap */}
      <InventoryHeatmap />

      {/* Demand-Supply Gap */}
      <DemandSupplyChart />

      {/* Seller Scorecard */}
      <SellerScorecard />

      {/* GMV Summary */}
      {gmv.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="nm-card p-4 text-center">
            <div className="text-2xl font-bold text-nm-primary">
              ₹{formatINR(gmv.reduce((sum, p) => sum + p.gmv, 0))}
            </div>
            <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1">
              Total GMV ({gmvDays}d)
            </div>
          </div>
          <div className="nm-card p-4 text-center">
            <div className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">
              ₹{formatINR(gmv.reduce((sum, p) => sum + p.gmv, 0) / gmv.length)}
            </div>
            <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1">
              Daily Average
            </div>
          </div>
          <div className="nm-card p-4 text-center">
            <div className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">
              ₹{formatINR(Math.max(...gmv.map((p) => p.gmv)))}
            </div>
            <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1">
              Peak Day
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
