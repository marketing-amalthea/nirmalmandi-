'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, Package, Loader2, Search, AlertCircle,
  ChevronRight, ChevronLeft, CheckCircle, Clock, Truck,
  XCircle, IndianRupee, Eye, ExternalLink, Megaphone, RefreshCw, Download
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { ordersApi, type Order } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending_payment', label: 'Pending Payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending_payment: { label: 'Pending Payment', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  paid: { label: 'Paid', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  confirmed: { label: 'Confirmed', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
  shipped: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function EscrowChip({ status }: { status: string }) {
  const escrowStatuses: Record<string, { label: string; color: string }> = {
    holding: { label: 'Escrow: Holding', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    released: { label: 'Escrow: Released', color: 'bg-green-50 text-green-700 border-green-200' },
    frozen: { label: 'Escrow: Frozen', color: 'bg-red-50 text-red-700 border-red-200' },
    refunded: { label: 'Escrow: Refunded', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  };
  const cfg = escrowStatuses[status] ?? { label: `Escrow: ${status}`, color: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', activeTab, appliedSearch, page],
    queryFn: () => ordersApi.getMyOrders({
      status: activeTab || undefined,
      search: appliedSearch || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    select: (res) => {
      const payload = res.data as unknown as { data: Order[] | { rows: Order[]; total: number }; total?: number } | Order[];
      if (Array.isArray(payload)) return { orders: payload, total: payload.length };
      const d = (payload as { data: Order[] | { rows: Order[]; total: number }; total?: number })?.data;
      if (Array.isArray(d)) return { orders: d, total: (payload as { total?: number }).total ?? d.length };
      if (d && 'rows' in d) return { orders: d.rows, total: d.total };
      return { orders: [], total: 0 };
    },
    enabled: isAuthenticated(),
  });

  const orders: Order[] = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function exportCSV() {
    if (orders.length === 0) { toast.error('No orders to export'); return; }
    const headers = [
      'Order Number', 'Date', 'Item', 'Quantity', 'Unit Price (₹)',
      'Subtotal (₹)', 'Platform Fee (₹)', 'GST (₹)', 'Freight (₹)',
      'Total (₹)', 'Status', 'Escrow Status', 'Payment Status',
    ];
    const rows = orders.map((o) => [
      o.order_number ?? o.id.slice(0, 8).toUpperCase(),
      new Date(o.created_at).toLocaleDateString('en-IN'),
      `"${(o.listing_title ?? '').replace(/"/g, '""')}"`,
      o.quantity,
      o.price_per_unit ?? 0,
      o.subtotal ?? 0,
      o.platform_fee ?? 0,
      o.gst_amount ?? 0,
      o.freight_amount ?? 0,
      o.total_amount ?? 0,
      o.status,
      o.escrow_status ?? '',
      o.payment_status ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nirmalmandi_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleConfirmDelivery(orderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirmingId(orderId);
    try {
      await ordersApi.confirmDelivery(orderId);
      toast.success('Delivery confirmed. Payment released to seller.');
      refetch();
    } catch {
      toast.error('Failed to confirm delivery. Please try again.');
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <div className="flex items-center gap-2">
            {orders.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            <Link href="/listings" className="btn-primary text-sm py-1.5 px-3">
              Browse Inventory
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setAppliedSearch(search);
                  setPage(1);
                }
              }}
              placeholder="Search by order number..."
              className="input-field pl-9 pr-4"
            />
          </div>
          <button
            onClick={() => { setAppliedSearch(search); setPage(1); }}
            className="btn-primary px-4"
          >
            Search
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-24 space-y-2">
                    <div className="h-5 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-20">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {appliedSearch || activeTab ? 'No orders found' : 'No orders yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {appliedSearch || activeTab
                ? 'Try changing your filters or search term'
                : 'Start browsing and place your first order'}
            </p>
            <Link href="/listings" className="btn-primary text-sm">
              Browse Inventory
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] ?? {
                label: order.status,
                color: 'bg-gray-100 text-gray-600',
                icon: Clock,
              };
              const StatusIcon = statusCfg.icon;
              const isDelivered = order.status === 'delivered';
              const isShipped = order.status === 'shipped' || order.status === 'in_transit';
              const isPendingPayment = order.status === 'pending_payment' || order.status === 'pending';

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <Package className="w-8 h-8 text-primary-200" />
                    </div>

                    {/* Center info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-mono">
                        #{order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="font-medium text-gray-900 truncate mt-0.5">
                        {order.listing_title ?? 'Inventory Item'}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {order.buyer_name ?? 'Seller'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>

                    {/* Right: amount + status */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="font-bold text-gray-900 flex items-center gap-0.5">
                        <IndianRupee className="w-3.5 h-3.5" />
                        {(order.total_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                      <span className={`badge gap-1 ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      {order.escrow_status && (
                        <EscrowChip status={order.escrow_status} />
                      )}
                      <span className="text-xs text-gray-400">
                        {order.quantity.toLocaleString('en-IN')} unit{order.quantity !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDelivered && (
                        <button
                          onClick={(e) => handleConfirmDelivery(order.id, e)}
                          disabled={confirmingId === order.id}
                          className="flex items-center gap-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {confirmingId === order.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle className="w-3 h-3" />}
                          Confirm Receipt
                        </button>
                      )}
                      {isShipped && (
                        <Link
                          href={`/orders/${order.id}`}
                          className="flex items-center gap-1 text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 rounded-lg transition-colors border border-cyan-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Track Order
                        </Link>
                      )}
                      {isPendingPayment && (
                        <Link
                          href={`/checkout?listing_id=${order.listing_id}&quantity=${order.quantity}`}
                          className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-2.5 py-1 rounded-lg transition-colors border border-yellow-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Complete Payment
                        </Link>
                      )}
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-primary-600 px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-primary-50 border border-gray-200 hover:border-primary-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="w-3 h-3" />
                        View Details
                      </Link>

                      {/* Market Again — available for all completed/delivered orders */}
                      {(order.status === 'completed' || order.status === 'delivered') && order.listing_id && (
                        <Link
                          href={`/listings/${order.listing_id}?market=1`}
                          className="flex items-center gap-1 text-xs font-medium text-nm-primary hover:text-nm-primary-dark px-2.5 py-1 rounded-lg bg-nm-primary-pale hover:bg-nm-primary/10 border border-nm-primary/20 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Megaphone className="w-3 h-3" />
                          Market Again
                        </Link>
                      )}

                      {/* Reorder */}
                      {order.status === 'completed' && order.listing_id && (
                        <Link
                          href={`/checkout?listing_id=${order.listing_id}&quantity=${order.quantity}`}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reorder
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary p-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pageNum = start + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary p-2 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
