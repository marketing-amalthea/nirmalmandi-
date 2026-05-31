'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee,
  Package,
  ShoppingCart,
  Wallet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Loader2,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface RecentOrder {
  id: string;
  order_number: string;
  buyer_business_name: string;
  listing_title: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface SellerDashboardData {
  gmv_month: number;
  gmv_change_pct: number;
  pending_payout: number;
  next_payout_date: string;
  active_listings: number;
  orders_awaiting_action: number;
  aging_listings_count: number;
  orders_awaiting_shipment: number;
  recent_orders: RecentOrder[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  ready_to_ship: { label: 'Ready to Ship', color: 'bg-cyan-100 text-cyan-700', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: number;
  trendLabel?: string;
}) {
  const isPositive = (trend ?? 0) >= 0;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{trend.toFixed(1)}% {trendLabel ?? 'vs last month'}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
            </div>
            <div className="h-7 bg-gray-200 rounded w-28" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="card p-5 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SellerDashboardPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-dashboard'],
    queryFn: () =>
      api.get<{ success: boolean; data: SellerDashboardData }>('/seller/dashboard'),
    select: (res) => (res.data as unknown as { data: SellerDashboardData })?.data ?? res.data,
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  useEffect(() => {
    if (error) toast.error('Failed to load dashboard data');
  }, [error]);

  if (!ready || isLoading) return <DashboardSkeleton />;

  // Fallback empty state data
  const d: SellerDashboardData = data ?? {
    gmv_month: 0,
    gmv_change_pct: 0,
    pending_payout: 0,
    next_payout_date: '',
    active_listings: 0,
    orders_awaiting_action: 0,
    aging_listings_count: 0,
    orders_awaiting_shipment: 0,
    recent_orders: [],
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening with your store today.</p>
        </div>
        <Link
          href="/seller/listings/new"
          className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Listing
        </Link>
      </div>

      {/* Alert banners */}
      {d.aging_listings_count > 0 && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              {d.aging_listings_count} listing{d.aging_listings_count > 1 ? 's' : ''} haven&apos;t sold in 30+ days
            </p>
          </div>
          <Link
            href="/seller/listings"
            className="flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap"
          >
            Review Listings <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {d.orders_awaiting_shipment > 0 && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              {d.orders_awaiting_shipment} order{d.orders_awaiting_shipment > 1 ? 's' : ''} awaiting shipment
            </p>
          </div>
          <Link
            href="/seller/orders"
            className="flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap"
          >
            View Orders <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="GMV This Month"
          value={formatCurrency(d.gmv_month)}
          icon={IndianRupee}
          iconColor="text-primary-600 bg-primary-50"
          trend={d.gmv_change_pct}
          trendLabel="vs last month"
        />
        <KpiCard
          label="Pending Payout"
          value={formatCurrency(d.pending_payout)}
          subtitle={d.next_payout_date ? `Next payout: ${formatDate(d.next_payout_date)}` : 'No payout scheduled'}
          icon={Wallet}
          iconColor="text-green-600 bg-green-50"
        />
        <KpiCard
          label="Active Listings"
          value={d.active_listings.toLocaleString('en-IN')}
          icon={Package}
          iconColor="text-indigo-600 bg-indigo-50"
        />
        <KpiCard
          label="Orders Awaiting Action"
          value={d.orders_awaiting_action.toLocaleString('en-IN')}
          icon={ShoppingCart}
          iconColor="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Capital Recovery Estimator */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <IndianRupee className="w-4 h-4 text-green-600" />
          <h2 className="text-base font-semibold text-gray-900">Capital Recovery Estimator</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">GMV This Month</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(d.gmv_month)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">After Platform Fee (2.5%)</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(d.gmv_month * 0.975)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Pending Payout</p>
            <p className="text-xl font-bold text-blue-700">{formatCurrency(d.pending_payout)}</p>
            {d.next_payout_date && (
              <p className="text-[10px] text-blue-500 mt-0.5">Due {formatDate(d.next_payout_date)}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Platform fee: 2.5% + 18% GST on fee. Full payout after buyer confirms delivery.
        </p>
      </div>

      {/* Recent Orders */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
          <Link
            href="/seller/orders"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {d.recent_orders.length === 0 ? (
          <div className="text-center py-14">
            <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-600 mb-1">No orders yet</h3>
            <p className="text-xs text-gray-400">Orders will appear here once buyers purchase your listings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left px-6 py-3 font-medium">Order #</th>
                  <th className="text-left px-6 py-3 font-medium">Buyer</th>
                  <th className="text-left px-6 py-3 font-medium">Product</th>
                  <th className="text-left px-6 py-3 font-medium">Amount</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.recent_orders.map((order) => {
                  const sc = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    color: 'bg-gray-100 text-gray-600',
                    icon: Clock,
                  };
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-primary-600">
                        {order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800 max-w-[140px] truncate">
                        {order.buyer_business_name ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">
                        {order.listing_title}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/seller/listings/new"
            className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Listing
          </Link>
          <Link
            href="/seller/orders"
            className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            View All Orders
          </Link>
          <Link
            href="/seller/payouts"
            className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            Check Payouts
          </Link>
        </div>
      </div>
    </div>
  );
}
