'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingBag,
  Search,
  X,
  ShoppingCart,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { SellerAppShell, Badge, Kpi, inr } from '@/components/ui';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SellerOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_business_name: string;
  buyer_phone: string;
  listing_title: string;
  quantity: number;
  unit: string;
  total_amount: number;
  escrow_status: string;
  status: string;
  created_at: string;
  images?: string[];
}

interface OrdersResponse {
  orders: SellerOrder[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;

// Filter tabs → backend status values they include
const STATUS_TABS: { value: string; label: string; match: string[] }[] = [
  { value: '', label: 'All', match: [] },
  { value: 'awaiting_payment', label: 'Awaiting Payment', match: ['pending_payment'] },
  { value: 'active', label: 'Active', match: ['payment_received', 'payment_confirmed', 'confirmed'] },
  { value: 'shipped', label: 'Shipped', match: ['shipped', 'delivered'] },
  { value: 'completed', label: 'Completed', match: ['completed'] },
  { value: 'disputed', label: 'Disputed', match: ['disputed', 'cancelled'] },
];

// Backend status → human label (matches Badge color map)
const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending payment',
  payment_received: 'Paid',
  payment_confirmed: 'Confirmed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

// Statuses where the seller can still mark the order shipped
const SHIPPABLE = new Set(['payment_received', 'payment_confirmed', 'confirmed']);

const COURIERS = ['Delhivery', 'BlueDart', 'DTDC', 'Ekart', 'India Post', 'Other'];

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Mark Shipped Modal ──────────────────────────────────────────────────────────
function MarkShippedModal({
  order,
  onClose,
  onShipped,
}: {
  order: SellerOrder;
  onClose: () => void;
  onShipped: () => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [errors, setErrors] = useState<{ tracking?: string; courier?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const errs: typeof errors = {};
    if (!trackingNumber.trim()) errs.tracking = 'Tracking number is required';
    if (!courier) errs.courier = 'Please select a courier';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await api.patch(`/orders/${order.id}/ship`, {
        tracking_number: trackingNumber.trim(),
        courier,
      });
      toast.success('Order marked as shipped');
      onShipped();
      onClose();
    } catch {
      toast.error('Failed to mark order as shipped');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,73,42,.35)' }}>
      <div className="nm-card" style={{ padding: 24, maxWidth: 440, width: '100%' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="disp" style={{ fontSize: 17, fontWeight: 700, color: 'var(--nm-ink)' }}>Mark as shipped</h3>
          <button onClick={onClose} style={{ color: 'var(--nm-faint)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--nm-muted)', marginBottom: 18 }}>
          Order <span style={{ fontWeight: 700, color: 'var(--nm-ink)' }}>{order.order_number}</span> — {order.listing_title}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Tracking number *</label>
            <input
              value={trackingNumber}
              onChange={(e) => { setTrackingNumber(e.target.value); setErrors((p) => ({ ...p, tracking: undefined })); }}
              placeholder="e.g. 1234567890"
              className="nm-input"
              style={{ width: '100%' }}
            />
            {errors.tracking && <p style={{ fontSize: 12, color: 'var(--nm-red)', marginTop: 4 }}>{errors.tracking}</p>}
          </div>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Courier *</label>
            <select
              value={courier}
              onChange={(e) => { setCourier(e.target.value); setErrors((p) => ({ ...p, courier: undefined })); }}
              className="nm-select"
              style={{ width: '100%' }}
            >
              <option value="">Select courier…</option>
              {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.courier && <p style={{ fontSize: 12, color: 'var(--nm-red)', marginTop: 4 }}>{errors.courier}</p>}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="nm-btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="nm-btn-primary flex items-center justify-center gap-2" style={{ flex: 1 }}>
            {loading && <Loader2 size={16} className="animate-spin" />} Mark shipped
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SellerOrdersPage() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [shipModal, setShipModal] = useState<SellerOrder | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-orders', page],
    queryFn: () =>
      api.get<OrdersResponse>('/orders/my/seller', {
        params: { page, limit: PAGE_SIZE },
      }),
    select: (res) => (res.data as unknown as { data: OrdersResponse })?.data ?? (res.data as unknown as OrdersResponse),
    enabled: isAuthenticated(),
    placeholderData: (prev) => prev,
  });

  const allOrders: SellerOrder[] = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // KPIs computed from the fetched orders
  const kpis = useMemo(() => {
    let pendingPayment = 0;
    let inTransit = 0;
    let completed = 0;
    for (const o of allOrders) {
      if (o.status === 'pending_payment') pendingPayment += 1;
      if (o.status === 'shipped' || o.status === 'delivered') inTransit += 1;
      if (o.status === 'completed') completed += 1;
    }
    return { total: allOrders.length, pendingPayment, inTransit, completed };
  }, [allOrders]);

  // Filter by tab + search
  const tab = STATUS_TABS.find((t) => t.value === statusTab);
  const q = search.trim().toLowerCase();
  const orders = allOrders.filter((o) => {
    if (tab && tab.match.length && !tab.match.includes(o.status)) return false;
    if (q) {
      return (
        (o.order_number ?? '').toLowerCase().includes(q) ||
        (o.listing_title ?? '').toLowerCase().includes(q) ||
        (o.buyer_business_name ?? o.buyer_name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  function refetchOrders() {
    qc.invalidateQueries({ queryKey: ['seller-orders'] });
  }

  return (
    <SellerAppShell
      title="Orders"
      subtitle={`${total.toLocaleString('en-IN')} total orders`}
      actions={
        <div className="relative">
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nm-faint)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #…"
            className="nm-input"
            style={{ paddingLeft: 34, width: 220, borderRadius: 999, padding: '9px 14px 9px 34px', fontSize: 13.5 }}
          />
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="Total orders" value={kpis.total.toLocaleString('en-IN')} icon={ShoppingCart} />
        <Kpi label="Pending payment" value={kpis.pendingPayment.toLocaleString('en-IN')} icon={Clock} />
        <Kpi label="In transit" value={kpis.inTransit.toLocaleString('en-IN')} icon={Truck} />
        <Kpi label="Completed" value={kpis.completed.toLocaleString('en-IN')} icon={CheckCircle2} />
      </div>

      {/* Status tabs */}
      <div className="nm-tabbar mb-5">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => { setStatusTab(t.value); setPage(1); }} className={`nm-tab${statusTab === t.value ? ' active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag size={48} style={{ color: 'var(--nm-faint)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--nm-muted)', fontSize: 14 }}>No orders found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => {
            const shippable = SHIPPABLE.has(o.status);
            const img = o.images?.[0];
            return (
              <div key={o.id} className="nm-card flex items-center gap-4" style={{ padding: '16px 20px' }}>
                {/* Thumbnail */}
                <div className="flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--nm-panel)' }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={22} style={{ color: 'var(--nm-faint)' }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.listing_title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: '0 0 4px' }}>
                    #{o.order_number ?? o.id.slice(0, 8)} · {o.buyer_business_name || o.buyer_name || 'Buyer'} · Qty {o.quantity} · {timeAgo(o.created_at)}
                  </p>
                  <Link
                    href={`/orders/${o.id}`}
                    className="inline-flex items-center gap-1"
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--nm-green)' }}
                  >
                    View details <ArrowRight size={12} />
                  </Link>
                </div>

                {/* Status badge */}
                <Badge status={STATUS_LABEL[o.status] ?? o.status} />

                {/* Amount */}
                <div className="flex-shrink-0 text-right" style={{ minWidth: 96 }}>
                  <p className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--nm-ink)', margin: 0 }}>{inr(Number(o.total_amount ?? 0))}</p>
                </div>

                {/* Context action */}
                {shippable ? (
                  <button onClick={() => setShipModal(o)} className="nm-btn-primary flex-shrink-0 flex items-center gap-1.5" style={{ fontSize: 12.5, padding: '8px 14px' }}>
                    <Truck size={14} /> Mark shipped
                  </button>
                ) : (
                  <Link href={`/orders/${o.id}`} className="nm-btn-secondary flex-shrink-0" style={{ fontSize: 12.5, padding: '8px 14px' }}>
                    View order
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="nm-btn-secondary" style={{ padding: '8px 12px' }}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const pageNum = start + i;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className="num flex items-center justify-center"
                style={{ width: 38, height: 38, borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: page === pageNum ? 'var(--nm-green)' : 'var(--nm-card)', color: page === pageNum ? '#fff' : 'var(--nm-ink)', border: `1px solid ${page === pageNum ? 'var(--nm-green)' : 'var(--nm-line)'}`, cursor: 'pointer' }}
              >
                {pageNum}
              </button>
            );
          })}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="nm-btn-secondary" style={{ padding: '8px 12px' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {shipModal && (
        <MarkShippedModal
          order={shipModal}
          onClose={() => setShipModal(null)}
          onShipped={refetchOrders}
        />
      )}
    </SellerAppShell>
  );
}
