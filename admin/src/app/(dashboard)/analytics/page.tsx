'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi, adminAnalyticsApi } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  IndianRupee, Package, Users, ShoppingCart, Scale, TrendingUp, Download,
  BarChart2, Percent, MapPin, UserPlus, FileBarChart, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import AdminShell from '@/components/ui/AdminShell';
import Kpi from '@/components/ui/Kpi';
import SectionCard from '@/components/ui/SectionCard';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DashboardData {
  totalGmv: number; gmvChange: number;
  activeListings: number; listingsChange: number;
  activeSellers: number; sellersChange: number;
  activeBuyers: number; buyersChange: number;
  todaysCommission: number; commissionChange: number;
  openDisputes: number; disputesChange: number;
}
interface GmvPoint { date: string; gmv: number; }
interface AlertData { openDisputes: number; agingListings: number; pendingKyc: number; }

function formatINR(val: number): string {
  if (val >= 10_000_000) return `${(val / 10_000_000).toFixed(2)}Cr`;
  if (val >= 100_000) return `${(val / 100_000).toFixed(2)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(0);
}
function toLakh(val: number): string {
  return `₹${(val / 100_000).toFixed(1)}L`;
}
function deltaSub(change: number | undefined, label: string): { sub: string; positive?: boolean } {
  if (change == null) return { sub: label };
  const sign = change > 0 ? '+' : '';
  return { sub: `${sign}${change.toFixed(1)}% ${label}`, positive: change >= 0 };
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  let d = label ?? '';
  try { d = format(parseISO(label ?? ''), 'd MMM'); } catch { /* keep */ }
  return (
    <div className="nm-card" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--nm-muted)', marginBottom: 2 }}>{d}</div>
      <div className="num" style={{ color: 'var(--nm-green)', fontWeight: 800 }}>₹{formatINR(payload[0].value)}</div>
    </div>
  );
}

// ── SIGNATURE: Inventory Ageing Heatmap ─────────────────────────────────────
// Sector rows × 3 age columns (0–30 / 31–60 / 61–90+), each cell shaded by value.
const AGE_COLS = [
  { keys: ['age_0_7', 'age_8_14', 'age_15_30'], label: '0–30d' },
  { keys: ['age_31_60'], label: '31–60d' },
  { keys: ['age_60_plus', 'age_61_90', 'age_90_plus'], label: '61–90d+' },
];

function sumKeys(row: any, keys: string[]): number {
  return keys.reduce((acc, k) => acc + (Number(row[k]) || 0), 0);
}

function InventoryAgeingHeatmap() {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-heatmap'],
    queryFn: async () => { const r = await adminAnalyticsApi.getInventoryHeatmap(); return (r.data as any)?.data ?? []; },
    retry: 1,
  });
  const rows: any[] = data ?? [];

  // Build the matrix: each cell = ₹ value (uses *_value keys when present, else count proxy).
  const matrix = rows.map((row) => {
    const cells = AGE_COLS.map((col) => {
      const valueKeys = col.keys.map((k) => `${k}_value`);
      const hasValue = valueKeys.some((vk) => row[vk] != null);
      return hasValue ? sumKeys(row, valueKeys) : sumKeys(row, col.keys);
    });
    return { sector: row.sector ?? row.sector_name ?? '—', cells, isValue: AGE_COLS.some((c) => c.keys.some((k) => row[`${k}_value`] != null)) };
  });

  const max = Math.max(1, ...matrix.flatMap((m) => m.cells));
  const showAsValue = matrix.some((m) => m.isValue);

  function cellBg(v: number): string {
    const opacity = v <= 0 ? 0.05 : 0.08 + (v / max) * (0.5 - 0.08);
    return `rgba(31,107,58,${opacity.toFixed(3)})`;
  }
  function cellLabel(v: number): string {
    if (v <= 0) return '—';
    return showAsValue ? toLakh(v) : v.toLocaleString('en-IN');
  }

  return (
    <SectionCard title="Inventory ageing heatmap"
      action={<span style={{ fontSize: 12, color: 'var(--nm-muted)' }}>Stuck capital by sector & age</span>}>
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 36, background: 'var(--nm-line-soft)', borderRadius: 8 }} />)}
        </div>
      ) : matrix.length === 0 ? (
        <p className="text-center" style={{ padding: '32px 0', color: 'var(--nm-muted)', fontSize: 13 }}>No listing data</p>
      ) : (
        <>
          <div className="overflow-x-auto scrollbar-thin">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
              <thead>
                <tr>
                  <th style={{ width: 160, textAlign: 'left' }} />
                  {AGE_COLS.map((c) => (
                    <th key={c.label} className="label" style={{ textAlign: 'center', padding: '0 0 6px', color: 'var(--nm-faint)' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((m) => (
                  <tr key={m.sector}>
                    <td style={{ fontSize: 13, color: 'var(--nm-ink)', fontWeight: 600, paddingRight: 12, whiteSpace: 'nowrap' }}>{m.sector}</td>
                    {m.cells.map((v, i) => (
                      <td key={i} className="num" style={{
                        textAlign: 'center', padding: '14px 8px', borderRadius: 10,
                        background: cellBg(v),
                        color: v > max * 0.55 ? '#fff' : 'var(--nm-ink)',
                        fontWeight: 700, fontSize: 13, minWidth: 90,
                      }}>
                        {cellLabel(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-4" style={{ fontSize: 11.5, color: 'var(--nm-muted)' }}>
            <span>Low stuck capital</span>
            <span style={{
              flex: 'none', width: 160, height: 12, borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(31,107,58,0.08), rgba(31,107,58,0.5))',
            }} />
            <span>High</span>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Demand vs Supply ─────────────────────────────────────────────────────────
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
    <SectionCard title="Demand vs supply by sector"
      action={
        <div className="flex items-center gap-4" style={{ fontSize: 11.5, color: 'var(--nm-muted)' }}>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--nm-info)' }} />Demand</span>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--nm-green)' }} />Supply</span>
        </div>
      }>
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 30, background: 'var(--nm-line-soft)', borderRadius: 8 }} />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-center" style={{ padding: '24px 0', color: 'var(--nm-muted)', fontSize: 13 }}>No data</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row: any) => (
            <div key={row.sector}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nm-ink)' }}>{row.sector}</span>
                <span style={{ fontSize: 11, color: 'var(--nm-muted)' }}>{row.orders_30d} orders/30d</span>
              </div>
              <Bar value={Number(row.total_views)} max={maxViews} color="var(--nm-info)" label={Number(row.total_views).toLocaleString('en-IN')} />
              <Bar value={Number(row.supply_listings)} max={maxListings} color="var(--nm-green)" label={String(row.supply_listings)} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
      <div style={{ flex: 1, height: 10, background: 'var(--nm-line-soft)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span className="num" style={{ width: 56, textAlign: 'right', fontSize: 11.5, color: 'var(--nm-muted)' }}>{label}</span>
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
    <SectionCard title="Seller performance scorecard" pad={0}
      action={<span style={{ fontSize: 12, color: 'var(--nm-muted)', padding: '18px 22px 0' }}>Top 20 by GMV</span>}>
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-3" style={{ padding: 22 }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 28, background: 'var(--nm-line-soft)', borderRadius: 8 }} />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-center" style={{ padding: '40px 0', color: 'var(--nm-muted)', fontSize: 13 }}>No sellers yet</p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin" style={{ padding: '6px 22px 18px' }}>
          <table className="nm-table">
            <thead>
              <tr>
                <th>Seller</th><th>Tier</th>
                <th style={{ textAlign: 'right' }}>GMV</th><th style={{ textAlign: 'right' }}>Orders</th>
                <th style={{ textAlign: 'right' }}>Score</th><th style={{ textAlign: 'right' }}>Dispute%</th><th style={{ textAlign: 'right' }}>Fill%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.business_name}</td>
                  <td><span className="nm-pill" style={{ background: 'var(--nm-green-soft)', color: 'var(--nm-green)', textTransform: 'capitalize' }}>{s.verification_tier}</span></td>
                  <td className="num">₹{formatINR(parseFloat(s.gmv) || 0)}</td>
                  <td className="num" style={{ color: 'var(--nm-muted)' }}>{s.total_orders}</td>
                  <td className="num" style={{ color: parseFloat(s.performance_score) >= 80 ? 'var(--nm-green)' : parseFloat(s.performance_score) >= 60 ? 'var(--nm-gold-ink)' : 'var(--nm-red)', fontWeight: 700 }}>{s.performance_score}</td>
                  <td className="num" style={{ color: parseFloat(s.dispute_rate_pct) > 5 ? 'var(--nm-red)' : 'var(--nm-muted)' }}>{s.dispute_rate_pct}%</td>
                  <td className="num" style={{ color: parseFloat(s.fulfillment_rate_pct) >= 90 ? 'var(--nm-green)' : 'var(--nm-gold-ink)' }}>{s.fulfillment_rate_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export default function AnalyticsPage() {
  const [gmvDays, setGmvDays] = useState(30);

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData | null>({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => (await statsApi.getDashboard()).data?.data ?? null,
    retry: 1,
  });
  const { data: gmvHistory, isLoading: gmvLoading } = useQuery<GmvPoint[]>({
    queryKey: ['analytics-gmv', gmvDays],
    queryFn: async () => (await statsApi.getGmvHistory(gmvDays)).data?.data ?? [],
    retry: 1,
  });
  const { data: alerts } = useQuery<AlertData | null>({
    queryKey: ['analytics-alerts'],
    queryFn: async () => (await statsApi.getAlerts()).data?.data ?? null,
    retry: 1,
  });

  const gmv = gmvHistory ?? [];
  const d = dashboard;

  function handleExport() {
    if (gmv.length === 0) { toast.error('No data to export'); return; }
    const csv = ['date,gmv', ...gmv.map((p) => `${p.date},${p.gmv}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gmv-${gmvDays}d.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('GMV exported');
  }

  return (
    <AdminShell
      title="Analytics"
      subtitle="Platform performance & business intelligence"
      actions={
        <div className="flex items-center gap-3">
          <div className="nm-tabbar">
            {([7, 14, 30, 60, 90] as const).map((days) => (
              <button key={days} onClick={() => setGmvDays(days)} className={`nm-tab ${gmvDays === days ? 'active' : ''}`}>{days}d</button>
            ))}
          </div>
          <button onClick={handleExport} className="nm-btn-secondary" style={{ padding: '9px 14px', fontSize: 13 }}>
            <Download size={14} /> Export
          </button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total GMV" loading={dashLoading} icon={IndianRupee} value={`₹${formatINR(d?.totalGmv ?? 0)}`} {...deltaSub(d?.gmvChange, 'vs last month')} />
        <Kpi label="Commission earned" loading={dashLoading} icon={TrendingUp} value={`₹${formatINR(d?.todaysCommission ?? 0)}`} {...deltaSub(d?.commissionChange, 'vs yesterday')} />
        <Kpi label="Active listings" loading={dashLoading} icon={Package} value={(d?.activeListings ?? 0).toLocaleString('en-IN')} {...deltaSub(d?.listingsChange, 'vs last week')} />
        <Kpi label="Active sellers" loading={dashLoading} icon={Users} value={(d?.activeSellers ?? 0).toLocaleString('en-IN')} {...deltaSub(d?.sellersChange, 'vs last week')} />
        <Kpi label="Active buyers" loading={dashLoading} icon={ShoppingCart} value={(d?.activeBuyers ?? 0).toLocaleString('en-IN')} {...deltaSub(d?.buyersChange, 'vs last week')} />
        <Kpi label="Open disputes" loading={dashLoading} icon={Scale} danger value={(d?.openDisputes ?? 0).toLocaleString('en-IN')} {...deltaSub(d?.disputesChange, 'vs last week')} />
        <Kpi label="Ageing listings" icon={Package} value={(alerts?.agingListings ?? 0).toLocaleString('en-IN')} />
        <Kpi label="KYC pending" icon={Users} value={(alerts?.pendingKyc ?? 0).toLocaleString('en-IN')} />
      </div>

      <div className="flex flex-col gap-4 mt-4">
        {/* GMV chart */}
        <SectionCard title="GMV history" action={<span style={{ fontSize: 12, color: 'var(--nm-muted)' }}>{gmvDays}-day window</span>}>
          {gmvLoading ? (
            <div className="flex items-center justify-center" style={{ height: 260, color: 'var(--nm-muted)', fontSize: 13 }}>Loading…</div>
          ) : gmv.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2" style={{ height: 260, color: 'var(--nm-muted)' }}>
              <BarChart2 size={30} style={{ color: 'var(--nm-faint)' }} />
              <p style={{ fontSize: 13 }}>No GMV data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={gmv} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="agmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f6b3a" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1f6b3a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ece1cd" />
                <XAxis dataKey="date" tickFormatter={(x) => { try { return format(parseISO(x), 'd MMM'); } catch { return x; } }}
                  tick={{ fontSize: 11, fill: '#7a6f5d' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(gmv.length / 10) - 1)} />
                <YAxis tickFormatter={(v) => `₹${formatINR(v)}`} tick={{ fontSize: 11, fill: '#7a6f5d' }} tickLine={false} axisLine={false} width={68} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="gmv" stroke="#1f6b3a" strokeWidth={2} fill="url(#agmv)" activeDot={{ r: 4, fill: '#1f6b3a' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* SIGNATURE heatmap */}
        <InventoryAgeingHeatmap />

        <DemandSupplyChart />
        <SellerScorecard />

        {/* Sprint 14 engines */}
        <BuyerBehaviorPanel />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CvrPanel />
          <GeoDemandPanel />
        </div>
        <SellerAcquisitionPanel />
        <BoardReportPanel />

        {gmv.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <SummaryStat label={`Total GMV (${gmvDays}d)`} value={`₹${formatINR(gmv.reduce((s, p) => s + p.gmv, 0))}`} accent />
            <SummaryStat label="Daily average" value={`₹${formatINR(gmv.reduce((s, p) => s + p.gmv, 0) / gmv.length)}`} />
            <SummaryStat label="Peak day" value={`₹${formatINR(Math.max(...gmv.map((p) => p.gmv)))}`} />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="nm-card text-center" style={{ padding: 18 }}>
      <div className="num" style={{ fontSize: 22, fontWeight: 800, color: accent ? 'var(--nm-green)' : 'var(--nm-ink)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--nm-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Engine 5: Buyer Behavior Funnel ──────────────────────────────────────────
function BuyerBehaviorPanel() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({
    queryKey: ['buyer-behavior', days],
    queryFn: async () => {
      const r = await adminAnalyticsApi.getBuyerBehavior(days);
      return (r.data as { data: unknown }).data as {
        funnel: Array<{ event_type: string; count: number }>;
        topSearches: Array<{ search_query: string; count: number }>;
        deviceBreakdown: Array<{ device_type: string; count: number }>;
        dropOffPoints: { viewed: number; purchased: number; drop_off_pct: number } | null;
      };
    },
    retry: 1,
  });

  const FUNNEL_ORDER = ['listing_view', 'watchlist_add', 'cart_add', 'checkout_started', 'purchase_completed'];
  const FUNNEL_LABELS: Record<string, string> = {
    listing_view: 'Listing views', watchlist_add: 'Saved', cart_add: 'Added to cart',
    checkout_started: 'Checkout', purchase_completed: 'Purchased',
  };
  const funnelMap = Object.fromEntries((data?.funnel ?? []).map((f) => [f.event_type, Number(f.count)]));
  const maxFunnel = Math.max(...FUNNEL_ORDER.map((k) => funnelMap[k] ?? 0), 1);

  return (
    <SectionCard title="Engine 5 — Buyer behavior funnel"
      action={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="nm-select" style={{ width: 110, padding: '7px 12px', fontSize: 12.5 }}>
          <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
        </select>
      }>
      {isLoading ? (
        <div className="animate-pulse" style={{ height: 120, background: 'var(--nm-line-soft)', borderRadius: 10 }} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-2">
            {FUNNEL_ORDER.map((key, i) => {
              const count = funnelMap[key] ?? 0;
              const prev = i > 0 ? (funnelMap[FUNNEL_ORDER[i - 1]] ?? 0) : count;
              const pct = prev > 0 ? Math.round((count / prev) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between" style={{ fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: 'var(--nm-ink)' }}>{FUNNEL_LABELS[key]}</span>
                    <span style={{ color: 'var(--nm-muted)' }}>{count.toLocaleString('en-IN')} {i > 0 && <span style={{ color: 'var(--nm-green)' }}>({pct}%)</span>}</span>
                  </div>
                  <div style={{ height: 18, background: 'var(--nm-line-soft)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / maxFunnel) * 100}%`, height: '100%', background: 'var(--nm-green)', borderRadius: 999, opacity: 1 - i * 0.12 }} />
                  </div>
                </div>
              );
            })}
            {data?.dropOffPoints && (
              <p style={{ fontSize: 12, color: 'var(--nm-muted)', marginTop: 6 }}>
                Overall drop-off: <span style={{ color: 'var(--nm-red)', fontWeight: 700 }}>{data.dropOffPoints.drop_off_pct}%</span> of viewing sessions didn’t purchase
              </p>
            )}
          </div>
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Top searches</p>
            <div className="flex flex-col gap-1.5">
              {(data?.topSearches ?? []).slice(0, 8).map((s) => (
                <div key={s.search_query} className="flex items-center justify-between">
                  <span className="truncate" style={{ fontSize: 12.5, color: 'var(--nm-ink)' }}>{s.search_query}</span>
                  <span className="num" style={{ fontSize: 12.5, color: 'var(--nm-green)', fontWeight: 700, marginLeft: 8 }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Engine 7: CVR ─────────────────────────────────────────────────────────────
function CvrPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['cvr'],
    queryFn: async () => {
      const r = await adminAnalyticsApi.getCvr(30);
      return (r.data as { data: unknown }).data as {
        bySector: Array<{ sector_name: string; listing_views: number; orders: number; cvr_pct: number }>;
        byPriceBand: Array<{ price_band: string; views: number; orders: number; cvr_pct: number }>;
      };
    },
    retry: 1,
  });

  return (
    <SectionCard title="Engine 7 — CVR by sector"
      action={<Percent size={16} style={{ color: 'var(--nm-green)' }} />}>
      {isLoading ? (
        <div className="animate-pulse" style={{ height: 180, background: 'var(--nm-line-soft)', borderRadius: 10 }} />
      ) : (
        <div className="flex flex-col gap-2">
          {(data?.bySector ?? []).slice(0, 8).map((row) => (
            <div key={row.sector_name} className="flex items-center gap-3">
              <span className="truncate" style={{ width: 110, fontSize: 12.5, color: 'var(--nm-ink)' }}>{row.sector_name}</span>
              <div style={{ flex: 1, height: 10, background: 'var(--nm-line-soft)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((row.cvr_pct ?? 0) * 5, 100)}%`, height: '100%', background: 'var(--nm-green)', borderRadius: 999 }} />
              </div>
              <span className="num" style={{ width: 42, textAlign: 'right', fontSize: 12.5, color: 'var(--nm-green)', fontWeight: 700 }}>{row.cvr_pct ?? 0}%</span>
            </div>
          ))}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--nm-line)', marginTop: 4 }}>
            <p className="label" style={{ marginBottom: 8 }}>By price band</p>
            <div className="grid grid-cols-2 gap-2">
              {(data?.byPriceBand ?? []).map((row) => (
                <div key={row.price_band} className="nm-card text-center" style={{ padding: 10 }}>
                  <p className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--nm-green)' }}>{row.cvr_pct ?? 0}%</p>
                  <p style={{ fontSize: 11, color: 'var(--nm-muted)' }}>{row.price_band}</p>
                  <p style={{ fontSize: 11, color: 'var(--nm-faint)' }}>{row.orders} orders</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Engine 8: Geo Demand ───────────────────────────────────────────────────────
function GeoDemandPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['geo-demand'],
    queryFn: async () => {
      const r = await adminAnalyticsApi.getGeoDemand(30);
      return (r.data as { data: unknown }).data as {
        byState: Array<{ state: string; buyer_events: number; gmv_30d: number; orders_30d: number; demand_score: number }>;
        unservedStates: Array<{ state: string; buyer_events: number; registered_sellers: number }>;
      };
    },
    retry: 1,
  });

  return (
    <SectionCard title="Engine 8 — Geographic demand" action={<MapPin size={16} style={{ color: 'var(--nm-green)' }} />}>
      {isLoading ? (
        <div className="animate-pulse" style={{ height: 180, background: 'var(--nm-line-soft)', borderRadius: 10 }} />
      ) : (
        <div className="flex flex-col gap-4">
          <table className="nm-table">
            <thead><tr><th>State</th><th style={{ textAlign: 'right' }}>Events</th><th style={{ textAlign: 'right' }}>GMV</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
            <tbody>
              {(data?.byState ?? []).slice(0, 8).map((row) => (
                <tr key={row.state}>
                  <td style={{ fontWeight: 600 }}>{row.state}</td>
                  <td className="num" style={{ color: 'var(--nm-muted)' }}>{Number(row.buyer_events).toLocaleString('en-IN')}</td>
                  <td className="num" style={{ color: 'var(--nm-green)', fontWeight: 700 }}>{Number(row.gmv_30d) >= 100000 ? toLakh(Number(row.gmv_30d)) : `₹${Number(row.gmv_30d).toFixed(0)}`}</td>
                  <td className="num" style={{ color: 'var(--nm-green)', fontWeight: 800 }}>{row.demand_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.unservedStates ?? []).length > 0 && (
            <div style={{ background: 'var(--nm-gold-soft)', border: '1px solid var(--nm-gold-line)', borderRadius: 12, padding: 12 }}>
              <p className="disp" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--nm-gold-ink)', marginBottom: 3 }}>Unserved states (demand, 0 sellers)</p>
              <p style={{ fontSize: 12, color: 'var(--nm-gold-ink)' }}>{(data?.unservedStates ?? []).map((s) => s.state).join(' · ')}</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Engine 6: Seller Acquisition ────────────────────────────────────────────
function SellerAcquisitionPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-acquisition'],
    queryFn: async () => {
      const r = await adminAnalyticsApi.getSellerAcquisition();
      return (r.data as { data: unknown }).data as {
        sectorGaps: Array<{ sector_name: string; search_events: number; active_sellers: number; demand_supply_ratio: number }>;
        geoGaps: Array<{ state: string; buyer_events: number; registered_sellers: number; opportunity_score: number }>;
        churnRisk: Array<{ business_name: string; last_listing_date: string; total_gmv: number }>;
      };
    },
    retry: 1,
  });

  return (
    <SectionCard title="Engine 6 — Seller acquisition targeting" action={<UserPlus size={16} style={{ color: 'var(--nm-green)' }} />}>
      {isLoading ? (
        <div className="animate-pulse" style={{ height: 150, background: 'var(--nm-line-soft)', borderRadius: 10 }} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Sector gaps</p>
            <div className="flex flex-col gap-2">
              {(data?.sectorGaps ?? []).slice(0, 5).map((row) => (
                <div key={row.sector_name} className="flex items-center justify-between">
                  <span className="truncate" style={{ fontSize: 12.5, color: 'var(--nm-ink)' }}>{row.sector_name}</span>
                  <span className="num" style={{ fontSize: 12.5, color: 'var(--nm-gold-ink)', fontWeight: 700 }}>{row.demand_supply_ratio}x</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label" style={{ marginBottom: 8 }}>State opportunities</p>
            <div className="flex flex-col gap-2">
              {(data?.geoGaps ?? []).slice(0, 5).map((row) => (
                <div key={row.state} className="flex items-center justify-between">
                  <span style={{ fontSize: 12.5, color: 'var(--nm-ink)' }}>{row.state}</span>
                  <span className="num" style={{ fontSize: 12.5, color: 'var(--nm-green)', fontWeight: 700 }}>{row.opportunity_score}x</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Churn risk sellers</p>
            <div className="flex flex-col gap-2">
              {(data?.churnRisk ?? []).slice(0, 5).map((row, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="truncate" style={{ fontSize: 12.5, color: 'var(--nm-ink)' }}>{row.business_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--nm-red)' }}>{row.last_listing_date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Board Report PDF ──────────────────────────────────────────────────────────
function BoardReportPanel() {
  const [generating, setGenerating] = useState(false);
  const { data: reports, refetch } = useQuery({
    queryKey: ['board-reports'],
    queryFn: async () => {
      const r = await adminAnalyticsApi.getBoardReports();
      return (r.data as { data: unknown }).data as Array<{ id: string; period: string; report_url: string; created_at: string }>;
    },
    retry: 1,
  });

  async function generate() {
    setGenerating(true);
    try {
      const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
      const period = `${new Date().getFullYear()}-${quarter}`;
      const r = await adminAnalyticsApi.generateBoardReport(period);
      const url = (r.data as { data: { reportUrl: string } }).data?.reportUrl;
      if (url) window.open(url, '_blank');
      toast.success(`Board report generated for ${period}`);
      refetch();
    } catch { toast.error('Failed to generate board report'); }
    finally { setGenerating(false); }
  }

  return (
    <SectionCard title="Board report — PDF export"
      action={
        <button onClick={generate} disabled={generating} className="nm-btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>
          {generating ? <Loader2 size={14} className="animate-spin" /> : <FileBarChart size={14} />}
          {generating ? 'Generating…' : 'Generate report'}
        </button>
      }>
      <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', marginBottom: 16 }}>
        Compiles all 8 BI engines into a single executive PDF: KPIs, CVR, geo demand, acquisition targets, revenue forecast.
      </p>
      {(reports ?? []).length > 0 && (
        <div className="flex flex-col">
          <p className="label" style={{ marginBottom: 6 }}>Previous reports</p>
          {(reports ?? []).slice(0, 5).map((r) => (
            <div key={r.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--nm-line)' }}>
              <div>
                <p className="disp" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--nm-ink)' }}>{r.period}</p>
                <p style={{ fontSize: 11, color: 'var(--nm-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
              </div>
              <a href={r.report_url} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ fontSize: 12.5, color: 'var(--nm-green)', fontWeight: 600 }}>
                <Download size={13} /> Download
              </a>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
