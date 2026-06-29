'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2, AlertCircle, CheckCircle, ExternalLink, Download,
  XCircle, AlertTriangle, Shield, Truck, LayoutDashboard,
  ShoppingBag, Package, Heart, Gift, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, Badge, Avatar, inr } from '@/components/ui';
import { type NavItem } from '@/components/ui/Sidebar';
import VoiceMessageThread from '@/components/VoiceMessageThread';
import { ordersApi, invoiceApi, type OrderDetail } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const NAV: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard', icon: LayoutDashboard },
  { label: 'Browse lots', href: '/listings',  icon: ShoppingBag },
  { label: 'Orders',      href: '/orders',    icon: Package },
  { label: 'Watchlist',   href: '/watchlist', icon: Heart },
  { label: 'Referral',    href: '/referral',  icon: Gift },
  { label: 'Profile',     href: '/profile',   icon: User },
];

const sidebarFooter = (
  <div style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px' }}>
    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', margin: 0, lineHeight: 1.4 }}>🛡 Escrow protected — every order is held safe until you confirm delivery.</p>
  </div>
);

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

type Stage = { label: string; key: string; timestampField?: keyof OrderDetail };

const STAGES: Stage[] = [
  { label: 'Order placed', key: 'placed', timestampField: 'created_at' },
  { label: 'Payment in escrow', key: 'paid', timestampField: 'paid_at' },
  { label: 'Seller confirmed', key: 'confirmed', timestampField: 'confirmed_at' },
  { label: 'Shipped', key: 'shipped', timestampField: 'shipped_at' },
  { label: 'In transit', key: 'in_transit' },
  { label: 'Delivered', key: 'delivered', timestampField: 'delivered_at' },
  { label: 'Payment released', key: 'completed', timestampField: 'completed_at' },
];

function getStageIndex(status: string): number {
  const map: Record<string, number> = {
    payment_pending: 0, pending_payment: 0, pending: 0, paid: 1,
    payment_confirmed: 1, payment_received: 1, confirmed: 2,
    shipped: 3, in_transit: 4, delivered: 5, completed: 6,
  };
  return map[status] ?? 0;
}

// ── Live Tracking Card ──────────────────────────────────────────────────────
const TRACKING_STAGES = [
  { key: 'booked',           label: 'Booked' },
  { key: 'picked_up',        label: 'Picked up' },
  { key: 'in_transit',       label: 'In transit' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered',        label: 'Delivered' },
];
const STAGE_ORDER = TRACKING_STAGES.map((s) => s.key);

function LiveTrackingCard({ orderId, order }: { orderId: string; order: OrderDetail }) {
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
  const expected = (shipment as { expected_delivery?: string } | null)?.expected_delivery;

  return (
    <div className="nm-card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <h3 className="disp flex items-center gap-2" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>
          <Truck size={16} style={{ color: 'var(--nm-green)' }} /> Live tracking
        </h3>
        {trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="nm-pill no-underline"
            style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontWeight: 700 }}>
            <ExternalLink size={12} /> Open tracker
          </a>
        )}
      </div>

      <div className="flex items-start" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {TRACKING_STAGES.map((stage, i) => {
          const done = currentIdx >= 0 && currentIdx > i;
          const active = currentIdx === i;
          return (
            <div key={stage.key} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center" style={{ width: 78 }}>
                <div className="flex items-center justify-center" style={{
                  width: 28, height: 28, borderRadius: 999,
                  background: done ? 'var(--nm-green)' : active ? 'var(--nm-gold)' : 'var(--nm-card)',
                  border: done || active ? 'none' : '2px solid var(--nm-line)',
                }}>
                  {done ? <CheckCircle size={15} color="#fff" /> : active ? <Truck size={14} color="#fff" /> : <span className="num" style={{ fontSize: 12, color: 'var(--nm-faint)', fontWeight: 700 }}>{i + 1}</span>}
                </div>
                <p style={{ fontSize: 10.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.2, marginTop: 6, color: done || active ? 'var(--nm-ink)' : 'var(--nm-faint)' }}>{stage.label}</p>
              </div>
              {i < TRACKING_STAGES.length - 1 && (
                <div style={{ height: 2, width: 26, marginTop: 13, flexShrink: 0, background: currentIdx > i ? 'var(--nm-green)' : 'var(--nm-line)' }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4" style={{ fontSize: 12.5, color: 'var(--nm-muted)', marginTop: 14 }}>
        {awb && <span><b style={{ color: 'var(--nm-ink)' }}>AWB:</b> {awb}</span>}
        {provider && <span><b style={{ color: 'var(--nm-ink)' }}>Carrier:</b> {String(provider)}</span>}
        {expected && <span><b style={{ color: 'var(--nm-ink)' }}>Expected:</b> {formatDate(expected)}</span>}
      </div>
    </div>
  );
}

function CancelModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,12,4,.45)' }}>
      <div className="nm-card" style={{ padding: 28, maxWidth: 380, width: '100%' }}>
        <div className="flex items-center justify-center mx-auto" style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--nm-gold-soft)', marginBottom: 14 }}>
          <AlertTriangle size={24} style={{ color: 'var(--nm-gold-ink)' }} />
        </div>
        <h3 className="disp text-center" style={{ fontSize: 18, fontWeight: 800, color: 'var(--nm-ink)', marginBottom: 8 }}>Cancel order?</h3>
        <p className="text-center" style={{ fontSize: 13.5, color: 'var(--nm-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          This action cannot be undone. Your payment (if made) will be refunded within 5–7 business days.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="nm-btn-secondary" style={{ flex: 1 }}>Keep order</button>
          <button onClick={onConfirm} disabled={loading} className="nm-btn-danger" style={{ flex: 1, opacity: loading ? 0.6 : 1 }}>
            {loading && <Loader2 size={16} className="animate-spin" />} Cancel order
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
  const [downloadingPo, setDownloadingPo] = useState(false);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);
  useEffect(() => { if (justPaid) toast.success('Payment successful! Your order is confirmed.'); }, [justPaid]);

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

  async function handleDownloadPo() {
    setDownloadingPo(true);
    try {
      const res = await ordersApi.generatePo(id);
      const payload = (res.data as { data?: { poUrl: string; poNumber: string } }).data;
      if (payload?.poUrl) {
        window.open(payload.poUrl, '_blank');
        toast.success(`Purchase Order ${payload.poNumber} ready`);
      }
    } catch {
      toast.error('Could not generate PO. Please try again.');
    } finally {
      setDownloadingPo(false);
    }
  }

  async function handleDownloadInvoice() {
    setDownloadingInvoice(true);
    try {
      const res = await invoiceApi.getInvoice(id);
      const payload = res.data as unknown as { data?: { url: string } } | { url: string };
      const url = (payload as { data?: { url: string } })?.data?.url ?? (payload as { url: string })?.url;
      if (url) window.open(url, '_blank');
      else toast.error('Invoice not available yet');
    } catch {
      toast.error('Could not download invoice. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell navItems={NAV} brandSub="Buyer Portal" sidebarFooter={sidebarFooter} title="Order">
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      </AppShell>
    );
  }

  if (isError || !order) {
    return (
      <AppShell navItems={NAV} brandSub="Buyer Portal" sidebarFooter={sidebarFooter} title="Order">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <AlertCircle size={48} style={{ color: 'var(--nm-red)' }} />
          <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: 'var(--nm-ink)' }}>Order not found</h2>
          <Link href="/orders" className="nm-btn-primary no-underline">My orders</Link>
        </div>
      </AppShell>
    );
  }

  const currentStageIdx = getStageIndex(order.status);
  const canConfirmDelivery = ['delivered', 'shipped', 'payment_confirmed', 'confirmed'].includes(order.status);
  const canRaiseDispute = ['paid', 'payment_confirmed', 'payment_received', 'confirmed', 'shipped', 'in_transit', 'delivered'].includes(order.status);
  const canCancel = ['payment_pending', 'pending_payment', 'pending'].includes(order.status);
  const escrowHolding = ['paid', 'payment_confirmed', 'payment_received', 'confirmed', 'shipped', 'in_transit', 'delivered'].includes(order.status);
  const orderNumber = order.order_number ?? id.slice(0, 8).toUpperCase();
  const initials = (order.seller_business_name ?? 'S').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const showTracking = ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(order.status);

  return (
    <>
      <style>{`@keyframes pulse {0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}`}</style>

      {showCancelModal && (
        <CancelModal onConfirm={handleCancel} onCancel={() => setShowCancelModal(false)} loading={cancelling} />
      )}

      <AppShell
        navItems={NAV} brandSub="Buyer Portal" sidebarFooter={sidebarFooter}
        title={`Order NM-${orderNumber}`}
        subtitle={order.status.replace(/_/g, ' ')}
        actions={
          <div className="flex items-center gap-2.5">
            <button onClick={handleDownloadInvoice} disabled={downloadingInvoice} className="nm-btn-secondary" style={{ fontSize: 13, padding: '9px 14px' }}>
              {downloadingInvoice ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Invoice
            </button>
            <button onClick={handleDownloadPo} disabled={downloadingPo} className="nm-btn-secondary" style={{ fontSize: 13, padding: '9px 14px' }}>
              {downloadingPo ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />} Download PO
            </button>
            <Badge status={order.status === 'completed' ? 'Completed' : order.status === 'delivered' ? 'Delivered' : escrowHolding ? 'In escrow' : 'Pending'} />
          </div>
        }
      >
        <div className="flex flex-col" style={{ gap: 20, maxWidth: 1080 }}>
          {/* ── Escrow timeline ── */}
          <div className="nm-card" style={{ padding: 24 }}>
            <h3 className="disp" style={{ fontSize: 15, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 22px' }}>Escrow timeline</h3>

            {/* Desktop horizontal */}
            <div className="hidden sm:block" style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <div className="flex items-start" style={{ minWidth: 'max-content' }}>
                {STAGES.map((stage, idx) => {
                  const completed = idx < currentStageIdx;
                  const current = idx === currentStageIdx;
                  const ts = stage.timestampField ? (order[stage.timestampField] as string | undefined) : undefined;
                  return (
                    <div key={stage.key} className="flex items-start">
                      <div className="flex flex-col items-center" style={{ width: 104 }}>
                        <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
                          {current && (
                            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--nm-gold)', animation: 'pulse 1.4s ease-out infinite' }} />
                          )}
                          <div className="flex items-center justify-center" style={{
                            width: 32, height: 32, borderRadius: 999, zIndex: 1,
                            background: completed ? 'var(--nm-green)' : current ? 'var(--nm-gold)' : 'var(--nm-card)',
                            border: completed || current ? 'none' : '2px solid var(--nm-line)',
                          }}>
                            {completed ? <CheckCircle size={17} color="#fff" /> : current ? <Truck size={16} color="#fff" /> : <span className="num" style={{ fontSize: 13, color: 'var(--nm-faint)', fontWeight: 700 }}>{idx + 1}</span>}
                          </div>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.25, marginTop: 9, color: completed || current ? 'var(--nm-ink)' : 'var(--nm-faint)' }}>{stage.label}</p>
                        {current && (
                          <span className="nm-pill" style={{ background: 'var(--nm-gold-soft)', color: 'var(--nm-gold-ink)', fontWeight: 700, fontSize: 10.5, marginTop: 4, padding: '3px 9px' }}>Now</span>
                        )}
                        {completed && ts && (
                          <p style={{ fontSize: 11, color: 'var(--nm-faint)', marginTop: 4, textAlign: 'center' }}>{formatDateTime(ts)}</p>
                        )}
                      </div>
                      {idx < STAGES.length - 1 && (
                        <div style={{ height: 2, width: 34, marginTop: 15, flexShrink: 0, background: idx < currentStageIdx ? 'var(--nm-green)' : 'var(--nm-line)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile vertical */}
            <div className="sm:hidden">
              {STAGES.map((stage, idx) => {
                const completed = idx < currentStageIdx;
                const current = idx === currentStageIdx;
                const ts = stage.timestampField ? (order[stage.timestampField] as string | undefined) : undefined;
                return (
                  <div key={stage.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
                        {current && <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--nm-gold)', animation: 'pulse 1.4s ease-out infinite' }} />}
                        <div className="flex items-center justify-center" style={{
                          width: 32, height: 32, borderRadius: 999, zIndex: 1, flexShrink: 0,
                          background: completed ? 'var(--nm-green)' : current ? 'var(--nm-gold)' : 'var(--nm-card)',
                          border: completed || current ? 'none' : '2px solid var(--nm-line)',
                        }}>
                          {completed ? <CheckCircle size={16} color="#fff" /> : current ? <Truck size={15} color="#fff" /> : <span className="num" style={{ fontSize: 12, color: 'var(--nm-faint)', fontWeight: 700 }}>{idx + 1}</span>}
                        </div>
                      </div>
                      {idx < STAGES.length - 1 && <div style={{ width: 2, height: 30, background: idx < currentStageIdx ? 'var(--nm-green)' : 'var(--nm-line)' }} />}
                    </div>
                    <div style={{ paddingBottom: 16 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: completed || current ? 'var(--nm-ink)' : 'var(--nm-faint)', margin: 0 }}>
                        {stage.label}
                        {current && <span className="nm-pill" style={{ background: 'var(--nm-gold-soft)', color: 'var(--nm-gold-ink)', fontWeight: 700, fontSize: 10, marginLeft: 8, padding: '2px 8px' }}>Now</span>}
                      </p>
                      {completed && ts && <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', margin: '2px 0 0' }}>{formatDateTime(ts)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Escrow card + Live tracking ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 20 }}>
            <div className="flex items-start gap-3" style={{ background: 'var(--nm-green-soft)', borderRadius: 16, padding: 20 }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--nm-green)' }}>
                <Shield size={20} color="#fff" />
              </div>
              <div>
                <p className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-deep)', margin: 0 }}>
                  {order.status === 'completed' ? 'Payment released to seller' : 'Payment held in escrow'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--nm-green)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  {order.status === 'completed'
                    ? `${inr(order.total_amount ?? 0)} has been released following your confirmation.`
                    : `${inr(order.total_amount ?? 0)} protected until you confirm receipt.`}
                </p>
              </div>
            </div>

            {showTracking ? (
              <LiveTrackingCard orderId={id} order={order} />
            ) : (
              <div className="nm-card flex items-center gap-3" style={{ padding: 20 }}>
                <Truck size={20} style={{ color: 'var(--nm-faint)' }} />
                <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: 0 }}>Live tracking appears once the lot is shipped.</p>
              </div>
            )}
          </div>

          {/* ── Amount breakdown + Seller ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 20 }}>
            <div className="nm-card" style={{ padding: 20 }}>
              <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 16px' }}>Amount breakdown</h3>
              <div className="flex flex-col" style={{ gap: 10 }}>
                <Row label={`Subtotal (${order.quantity} × ${inr(order.price_per_unit ?? 0)})`} value={inr(order.subtotal ?? 0)} />
                {order.platform_fee !== undefined && <Row label="Platform commission" value={inr(order.platform_fee ?? 0)} />}
                {order.gst_amount !== undefined && <Row label={`GST (${order.gst_rate ?? 18}%)`} value={inr(order.gst_amount ?? 0)} />}
                {order.freight_amount !== undefined && <Row label="Freight" value={order.freight_amount === 0 ? 'Free' : inr(order.freight_amount)} freeHint={order.freight_amount === 0} />}
                <div style={{ borderTop: '1px dashed var(--nm-line)', margin: '4px 0' }} />
                <div className="flex items-center justify-between">
                  <span className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-ink)' }}>Total paid</span>
                  <span className="num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--nm-green)' }}>{inr(order.total_amount ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="nm-card" style={{ padding: 20 }}>
              <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--nm-ink)', margin: '0 0 16px' }}>Seller</h3>
              <div className="flex items-start gap-3">
                <Avatar initials={initials} size={44} />
                <div>
                  <p className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-ink)', margin: 0 }}>{order.seller_business_name ?? 'Seller'}</p>
                  {(order.seller_city || order.seller_state) && (
                    <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '3px 0 0' }}>{[order.seller_city, order.seller_state].filter(Boolean).join(', ')}</p>
                  )}
                  <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '6px 0 0' }}>
                    {order.seller_response_rate ?? 94}% response · ★4.6
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          {(canConfirmDelivery || canRaiseDispute || canCancel) && (
            <div className="flex flex-wrap gap-3">
              {canConfirmDelivery && (
                <button onClick={handleConfirmDelivery} disabled={confirmingDelivery} className="nm-btn-primary" style={{ opacity: confirmingDelivery ? 0.6 : 1 }}>
                  {confirmingDelivery ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Confirm receipt
                </button>
              )}
              {canRaiseDispute && (
                <Link href={`/orders/${id}/dispute`} className="nm-btn-secondary no-underline" style={{ color: 'var(--nm-red)', borderColor: 'var(--nm-red-soft)' }}>
                  <AlertTriangle size={16} /> Raise dispute
                </Link>
              )}
              {canCancel && (
                <button onClick={() => setShowCancelModal(true)} className="nm-btn-secondary">
                  <XCircle size={16} /> Cancel
                </button>
              )}
            </div>
          )}

          {/* ── Voice messages ── */}
          <VoiceMessageThread orderId={id} />
        </div>
      </AppShell>
    </>
  );
}

function Row({ label, value, freeHint }: { label: string; value: string; freeHint?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{label}</span>
      <span className="num" style={{ fontSize: 13.5, color: freeHint ? 'var(--nm-green)' : 'var(--nm-ink)', fontWeight: freeHint ? 700 : 500 }}>{value}</span>
    </div>
  );
}
