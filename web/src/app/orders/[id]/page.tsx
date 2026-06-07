'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Package, Loader2, AlertCircle, CheckCircle,
  ExternalLink, Download, XCircle, AlertTriangle, Lock,
  MapPin, Truck, IndianRupee
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { ordersApi, invoiceApi, type OrderDetail } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type Stage = {
  label: string;
  key: string;
  timestampField?: keyof OrderDetail;
};

const STAGES: Stage[] = [
  { label: 'Order Placed', key: 'placed', timestampField: 'created_at' },
  { label: 'Payment in Escrow', key: 'paid', timestampField: 'paid_at' },
  { label: 'Seller Confirmed', key: 'confirmed', timestampField: 'confirmed_at' },
  { label: 'Shipped', key: 'shipped', timestampField: 'shipped_at' },
  { label: 'In Transit', key: 'in_transit' },
  { label: 'Delivered', key: 'delivered', timestampField: 'delivered_at' },
  { label: 'Payment Released', key: 'completed', timestampField: 'completed_at' },
];

function getStageIndex(status: string): number {
  const map: Record<string, number> = {
    pending_payment: 0,
    pending: 0,
    paid: 1,
    confirmed: 2,
    shipped: 3,
    in_transit: 4,
    delivered: 5,
    completed: 6,
  };
  return map[status] ?? 0;
}

// ── Live Tracking Card ─────────────────────────────────────────────────────────
const TRACKING_STAGES = [
  { key: 'booked',           label: 'Booked',             icon: '📋' },
  { key: 'picked_up',        label: 'Picked Up',          icon: '📦' },
  { key: 'in_transit',       label: 'In Transit',         icon: '🚚' },
  { key: 'out_for_delivery', label: 'Out for Delivery',   icon: '🛵' },
  { key: 'delivered',        label: 'Delivered',          icon: '✅' },
];
const STAGE_ORDER = TRACKING_STAGES.map((s) => s.key);

function LiveTrackingCard({ orderId, order }: { orderId: string; order: import('@/lib/api').OrderDetail }) {
  const { data: shipment } = useQuery({
    queryKey: ['shipment', orderId],
    queryFn: () =>
      fetch(`/api/logistics/shipments/order/${orderId}`, {
        headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('nm_access_token') ?? '' : ''}` },
      }).then((r) => r.json()).then((j) => j?.data ?? null),
    refetchInterval: 60_000,
    retry: 1,
  });

  const currentStatus: string = (shipment as { status?: string } | null)?.status ?? (order.status === 'shipped' ? 'in_transit' : order.status);
  const currentIdx = STAGE_ORDER.indexOf(currentStatus);

  const awb = (shipment as { awb_number?: string } | null)?.awb_number ?? order.awb_number;
  const trackingUrl = (shipment as { tracking_url?: string } | null)?.tracking_url ?? order.tracking_url;
  const provider = (shipment as { logistics_provider?: string } | null)?.logistics_provider ?? order.carrier;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary-600" />
          Live Tracking
        </h2>
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg px-2.5 py-1 hover:bg-primary-50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open Tracker
          </a>
        )}
      </div>

      {/* Stage progress */}
      <div className="flex items-center gap-0 mb-4 overflow-x-auto">
        {TRACKING_STAGES.map((stage, i) => {
          const done = currentIdx >= i;
          const active = currentIdx === i;
          return (
            <div key={stage.key} className="flex items-center flex-shrink-0">
              <div className={`flex flex-col items-center gap-1 ${active ? 'scale-110' : ''} transition-transform`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-colors ${
                  done ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-400'
                }`}>
                  {stage.icon}
                </div>
                <p className={`text-[9px] font-semibold text-center leading-tight max-w-[60px] ${
                  done ? 'text-primary-700' : 'text-gray-400'
                }`}>{stage.label}</p>
              </div>
              {i < TRACKING_STAGES.length - 1 && (
                <div className={`h-0.5 w-8 mx-1 flex-shrink-0 mb-4 ${currentIdx > i ? 'bg-primary-600' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        {awb && <p><span className="font-medium">AWB:</span> {awb}</p>}
        {provider && <p><span className="font-medium">Carrier:</span> {String(provider)}</p>}
        {(shipment as { expected_delivery?: string } | null)?.expected_delivery && (
          <p><span className="font-medium">Expected:</span> {formatDate((shipment as { expected_delivery: string }).expected_delivery)}</p>
        )}
      </div>
    </div>
  );
}

function CancelModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Cancel Order?</h3>
        <p className="text-sm text-gray-500 text-center mb-5">
          This action cannot be undone. Your payment (if made) will be refunded within 5–7 business days.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get('paid') === 'true';

  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (justPaid) {
      toast.success('Payment successful! Your order is confirmed.');
    }
  }, [justPaid]);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getOrder(id),
    select: (res) => {
      const payload = res.data as unknown as { data?: OrderDetail } | OrderDetail;
      return (payload as { data?: OrderDetail })?.data ?? payload as OrderDetail;
    },
    enabled: !!id && isAuthenticated(),
  });

  async function handleConfirmDelivery() {
    setConfirmingDelivery(true);
    try {
      await ordersApi.confirmDelivery(id);
      toast.success('Delivery confirmed. Payment released to seller.');
      refetch();
    } catch {
      toast.error('Failed to confirm delivery. Please try again.');
    } finally {
      setConfirmingDelivery(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await ordersApi.cancelOrder(id);
      toast.success('Order cancelled successfully.');
      setShowCancelModal(false);
      refetch();
    } catch {
      toast.error('Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownloadInvoice() {
    setDownloadingInvoice(true);
    try {
      const res = await invoiceApi.getInvoice(id);
      const payload = res.data as unknown as { data?: { url: string } } | { url: string };
      const url = (payload as { data?: { url: string } })?.data?.url ?? (payload as { url: string })?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('Invoice not available yet');
      }
    } catch {
      toast.error('Could not download invoice. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-semibold text-gray-800">Order not found</h2>
          <Link href="/orders" className="btn-primary">My Orders</Link>
        </div>
      </div>
    );
  }

  const currentStageIdx = getStageIndex(order.status);

  const canConfirmDelivery = order.status === 'delivered';
  const canRaiseDispute = ['paid', 'confirmed', 'shipped', 'in_transit', 'delivered'].includes(order.status);
  const canCancel = order.status === 'pending_payment' || order.status === 'pending';

  const escrowHolding = ['paid', 'confirmed', 'shipped', 'in_transit', 'delivered'].includes(order.status);

  return (
    <>
      {showCancelModal && (
        <CancelModal
          onConfirm={handleCancel}
          onCancel={() => setShowCancelModal(false)}
          loading={cancelling}
        />
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Back + header */}
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            My Orders
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Order #{order.order_number ?? id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Placed on {formatDate(order.created_at)}
              </p>
            </div>
            <button
              onClick={handleDownloadInvoice}
              disabled={downloadingInvoice}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 font-medium border border-gray-200 rounded-lg px-3 py-2 hover:border-primary-300 transition-colors disabled:opacity-60"
            >
              {downloadingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download Invoice
            </button>
          </div>

          <div className="space-y-5">
            {/* Visual Timeline */}
            <div className="card p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-6">Order Status</h2>

              {/* Desktop: horizontal */}
              <div className="hidden sm:block overflow-x-auto pb-2">
                <div className="flex items-start min-w-max">
                  {STAGES.map((stage, idx) => {
                    const completed = idx < currentStageIdx;
                    const current = idx === currentStageIdx;
                    const future = idx > currentStageIdx;
                    const ts = stage.timestampField ? order[stage.timestampField] as string | undefined : undefined;

                    return (
                      <div key={stage.key} className="flex items-start">
                        {/* Circle + label */}
                        <div className="flex flex-col items-center w-24">
                          <div className="relative flex items-center justify-center">
                            {current && (
                              <span className="absolute inline-flex w-8 h-8 rounded-full bg-indigo-400 opacity-30 animate-ping" />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 ${
                                completed
                                  ? 'bg-indigo-600 border-indigo-600'
                                  : current
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'bg-white border-gray-300'
                              }`}
                            >
                              {completed && <CheckCircle className="w-4 h-4 text-white" />}
                              {current && <div className="w-3 h-3 rounded-full bg-white" />}
                            </div>
                          </div>
                          <p className={`text-xs font-medium mt-2 text-center leading-tight ${
                            completed || current ? 'text-indigo-700' : 'text-gray-400'
                          }`}>
                            {stage.label}
                          </p>
                          {(completed || current) && ts && (
                            <p className="text-[10px] text-gray-400 mt-0.5 text-center">{formatDateTime(ts)}</p>
                          )}
                        </div>

                        {/* Connector line */}
                        {idx < STAGES.length - 1 && (
                          <div className={`h-0.5 w-8 mt-4 flex-shrink-0 ${
                            idx < currentStageIdx ? 'bg-indigo-600' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile: vertical */}
              <div className="sm:hidden space-y-0">
                {STAGES.map((stage, idx) => {
                  const completed = idx < currentStageIdx;
                  const current = idx === currentStageIdx;
                  const ts = stage.timestampField ? order[stage.timestampField] as string | undefined : undefined;

                  return (
                    <div key={stage.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="relative flex items-center justify-center">
                          {current && (
                            <span className="absolute inline-flex w-7 h-7 rounded-full bg-indigo-400 opacity-30 animate-ping" />
                          )}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center z-10 border-2 flex-shrink-0 ${
                              completed
                                ? 'bg-indigo-600 border-indigo-600'
                                : current
                                  ? 'bg-indigo-600 border-indigo-600'
                                  : 'bg-white border-gray-300'
                            }`}
                          >
                            {completed && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            {current && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        {idx < STAGES.length - 1 && (
                          <div className={`w-0.5 h-8 ${idx < currentStageIdx ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-medium ${completed || current ? 'text-indigo-700' : 'text-gray-400'}`}>
                          {stage.label}
                        </p>
                        {(completed || current) && ts && (
                          <p className="text-xs text-gray-400">{formatDateTime(ts)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Escrow status */}
            <div className={`card p-5 ${escrowHolding ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                <Lock className={`w-5 h-5 ${escrowHolding ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  {escrowHolding ? (
                    <>
                      <p className="text-sm font-semibold text-green-800">
                        ₹{(order.total_amount ?? 0).toLocaleString('en-IN')} is held in escrow
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Funds will be released to the seller upon your delivery confirmation or 7 days after delivery
                      </p>
                    </>
                  ) : order.status === 'completed' ? (
                    <p className="text-sm font-medium text-gray-600">
                      Escrow released — Payment sent to seller
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-gray-500">
                      Awaiting payment — Escrow not yet funded
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Live shipment tracking */}
            {['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(order.status) && (
              <LiveTrackingCard orderId={id} order={order} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Seller info */}
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Seller Information</h2>
                <div className="space-y-1.5 text-sm">
                  <p className="font-medium text-gray-900">
                    {order.seller_business_name ?? 'Seller'}
                  </p>
                  {(order.seller_city || order.seller_state) && (
                    <p className="text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {[order.seller_city, order.seller_state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {order.seller_response_rate !== undefined && (
                    <p className="text-gray-500">
                      Response Rate: <span className="font-medium text-green-600">{order.seller_response_rate}%</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Product info */}
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Product Details</h2>
                <div className="space-y-1.5 text-sm">
                  <p className="font-medium text-gray-900 truncate">
                    {order.listing_title ?? 'Inventory Item'}
                  </p>
                  <p className="text-gray-600">
                    Quantity: <span className="font-medium">{order.quantity.toLocaleString('en-IN')}{order.unit ? ` ${order.unit}` : ''}</span>
                  </p>
                  {order.condition_grade && (
                    <p className="text-gray-600">
                      Condition: <span className="font-medium">Grade {order.condition_grade}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Amount breakdown */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary-600" />
                Amount Breakdown
              </h2>
              <div className="border border-gray-200 rounded-xl overflow-hidden text-sm">
                <div className="divide-y divide-gray-100">
                  <div className="flex justify-between px-4 py-3 text-gray-600">
                    <span>Subtotal ({order.quantity} × ₹{(order.price_per_unit ?? 0).toLocaleString('en-IN')})</span>
                    <span>₹{(order.subtotal ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                  {order.platform_fee !== undefined && (
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>Platform Commission</span>
                      <span>₹{(order.platform_fee ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {order.gst_amount !== undefined && (
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>GST ({order.gst_rate ?? 18}%)</span>
                      <span>₹{(order.gst_amount ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {order.freight_amount !== undefined && (
                    <div className="flex justify-between px-4 py-3 text-gray-600">
                      <span>Freight</span>
                      <span>
                        {order.freight_amount === 0
                          ? <span className="text-green-600">Free</span>
                          : `₹${order.freight_amount.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-3 bg-gray-50 font-bold text-gray-900 text-base">
                    <span>Total</span>
                    <span className="text-primary-600">
                      ₹{(order.total_amount ?? 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {canConfirmDelivery && (
                <button
                  onClick={handleConfirmDelivery}
                  disabled={confirmingDelivery}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
                >
                  {confirmingDelivery
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <CheckCircle className="w-5 h-5" />}
                  Confirm Receipt — Release Payment to Seller
                </button>
              )}
              {canRaiseDispute && (
                <Link
                  href={`/orders/${id}/dispute`}
                  className="flex items-center gap-2 py-2.5 px-5 border-2 border-red-300 text-red-600 hover:bg-red-50 font-medium rounded-xl transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Raise a Dispute
                </Link>
              )}
              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-2 py-2.5 px-5 border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 font-medium rounded-xl transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
