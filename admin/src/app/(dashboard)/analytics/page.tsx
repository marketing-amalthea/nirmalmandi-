'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/lib/api';
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
