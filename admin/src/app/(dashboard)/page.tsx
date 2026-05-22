'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { statsApi, transactionsApi } from '@/lib/api';
import StatsCard from '@/components/ui/StatsCard';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  IndianRupee,
  Package,
  Users,
  ShoppingCart,
  Percent,
  Scale,
  AlertTriangle,
  Clock,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface KpiData {
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

interface RecentOrder {
  id: string;
  orderNumber: string;
  buyerName: string;
  sellerName: string;
  amount: number;
  status: string;
  createdAt: string;
}

function formatINR(val: number): string {
  if (val >= 10_000_000) return `${(val / 10_000_000).toFixed(2)}Cr`;
  if (val >= 100_000) return `${(val / 100_000).toFixed(2)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(0);
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

export default function DashboardPage() {
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpi } = useQuery<KpiData | null>({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => {
      const res = await statsApi.getDashboard();
      return res.data?.data ?? null;
    },
    retry: 1,
  });

  const { data: gmvData, refetch: refetchGmv } = useQuery<GmvPoint[]>({
    queryKey: ['gmv-history'],
    queryFn: async () => {
      const res = await statsApi.getGmvHistory(30);
      return res.data?.data ?? [];
    },
    retry: 1,
  });

  const { data: alertData, refetch: refetchAlerts } = useQuery<AlertData | null>({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const res = await statsApi.getAlerts();
      return res.data?.data ?? null;
    },
    retry: 1,
  });

  const { data: recentOrdersData, refetch: refetchOrders } = useQuery<RecentOrder[]>({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const res = await transactionsApi.getOrders({ limit: 10, page: 1 });
      const payload = res.data?.data;
      return Array.isArray(payload) ? payload : (payload as { rows?: RecentOrder[] })?.rows ?? [];
    },
    retry: 1,
  });

  function refetchAll() {
    refetchKpi();
    refetchGmv();
    refetchAlerts();
    refetchOrders();
  }

  const kpi = kpiData ?? null;
  const gmv = gmvData ?? [];
  const alerts = alertData ?? null;
  const recentOrders: RecentOrder[] = recentOrdersData ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Dashboard</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Amalthea Command Center —{' '}
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
      {kpiLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatsCard key={i} title="" value="" loading />
          ))}
        </div>
      ) : kpi ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard
            title="Total GMV"
            value={formatINR(kpi.totalGmv)}
            prefix="₹"
            change={kpi.gmvChange}
            changeLabel="vs last month"
            icon={<IndianRupee size={16} className="text-nm-primary" />}
            iconBg="bg-nm-primary/10"
          />
          <StatsCard
            title="Active Listings"
            value={kpi.activeListings.toLocaleString('en-IN')}
            change={kpi.listingsChange}
            changeLabel="vs last week"
            icon={<Package size={16} className="text-purple-600" />}
            iconBg="bg-purple-100 dark:bg-purple-900/20"
          />
          <StatsCard
            title="Active Sellers"
            value={kpi.activeSellers}
            change={kpi.sellersChange}
            changeLabel="vs last week"
            icon={<Users size={16} className="text-nm-accent" />}
            iconBg="bg-green-100 dark:bg-green-900/20"
          />
          <StatsCard
            title="Active Buyers"
            value={kpi.activeBuyers}
            change={kpi.buyersChange}
            changeLabel="vs last week"
            icon={<ShoppingCart size={16} className="text-blue-600" />}
            iconBg="bg-blue-100 dark:bg-blue-900/20"
          />
          <StatsCard
            title="Today's Commission"
            value={formatINR(kpi.todaysCommission)}
            prefix="₹"
            change={kpi.commissionChange}
            changeLabel="vs yesterday"
            icon={<Percent size={16} className="text-nm-warning" />}
            iconBg="bg-yellow-100 dark:bg-yellow-900/20"
          />
          <StatsCard
            title="Open Disputes"
            value={kpi.openDisputes}
            change={kpi.disputesChange}
            changeLabel="vs last week"
            icon={<Scale size={16} className="text-nm-danger" />}
            iconBg="bg-red-100 dark:bg-red-900/20"
          />
        </div>
      ) : (
        <div className="nm-card p-8 text-center text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
          KPI data unavailable. Click Refresh to try again.
        </div>
      )}

      {/* GMV Chart + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* GMV Chart */}
        <div className="xl:col-span-2 nm-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">GMV — Last 30 Days</h2>
            <span className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">Daily gross merchandise value</span>
          </div>
          {gmv.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
              No GMV data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gmv} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => {
                    try { return format(parseISO(d), 'd MMM'); } catch { return d; }
                  }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tickFormatter={(v) => `₹${formatINR(v)}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
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

        {/* Alert Cards */}
        <div className="space-y-3">
          <div className="nm-card p-4 border-l-4 border-nm-danger">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-nm-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">
                  {alerts?.openDisputes ?? kpi?.openDisputes ?? '—'} Disputes Need Attention
                </p>
                <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
                  Review and respond before SLA breach.
                </p>
                <a href="/disputes" className="text-xs text-nm-primary font-medium mt-2 inline-block hover:underline">
                  View Dispute Queue →
                </a>
              </div>
            </div>
          </div>

          <div className="nm-card p-4 border-l-4 border-nm-warning">
            <div className="flex items-start gap-3">
              <Clock size={18} className="text-nm-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">
                  {alerts?.agingListings ?? '—'} Listings Aging &gt;30 Days
                </p>
                <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
                  These listings risk de-ranking. Consider seller outreach or featuring them.
                </p>
                <a href="/inventory?filter=aging" className="text-xs text-nm-primary font-medium mt-2 inline-block hover:underline">
                  View in Inventory →
                </a>
              </div>
            </div>
          </div>

          <div className="nm-card p-4 border-l-4 border-nm-primary">
            <div className="flex items-start gap-3">
              <FileCheck size={18} className="text-nm-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">
                  {alerts?.pendingKyc ?? '—'} KYC Documents Pending
                </p>
                <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
                  Sellers are blocked from transacting until KYC is approved.
                </p>
                <a href="/users?tab=sellers&kyc=pending" className="text-xs text-nm-primary font-medium mt-2 inline-block hover:underline">
                  Review KYC Docs →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="nm-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-nm-border dark:border-nm-border-dark">
          <h2 className="text-sm font-semibold text-nm-text dark:text-nm-text-dark">Recent Transactions</h2>
          <a href="/orders" className="text-xs text-nm-primary font-medium hover:underline">
            View all →
          </a>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-5 py-12 text-center text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
            No recent transactions
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-nm-border dark:border-nm-border-dark">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">Order #</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">Buyer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">Seller</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nm-border dark:divide-nm-border-dark">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-nm-primary">{order.orderNumber}</td>
                    <td className="px-5 py-3 text-nm-text dark:text-nm-text-dark">{order.buyerName}</td>
                    <td className="px-5 py-3 text-nm-text-muted dark:text-nm-text-dark-muted">{order.sellerName}</td>
                    <td className="px-5 py-3 text-right font-semibold text-nm-text dark:text-nm-text-dark">
                      ₹{(order.amount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="px-5 py-3 text-nm-text-muted dark:text-nm-text-dark-muted text-xs">
                      {format(new Date(order.createdAt), 'h:mm a')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
