'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee,
  Package,
  Wallet,
  ShoppingBag,
  AlertTriangle,
  Truck,
  ArrowRight,
  Plus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, Kpi, Badge, SectionCard, inr } from '@/components/ui';
import api from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import { SELLER_NAV, SELLER_BRAND_SUB, SellerSidebarFooter } from '../_nav';

// ── Types ──────────────────────────────────────────────────────────────────────
interface RecentOrder {
  id: string;
  order_number: string;
  buyer_business_name: string;
  buyer_name?: string;
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
function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// Map raw order status → Badge status string
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Pending',
  ready_to_ship: 'Awaiting ship',
  shipped: 'Shipped',
  in_transit: 'In transit',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

export default function SellerDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const user = getUser();

  useEffect(() => { setReady(true); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-dashboard'],
    queryFn: () => api.get<{ success: boolean; data: SellerDashboardData }>('/seller/dashboard'),
    select: (res) => (res.data as unknown as { data: SellerDashboardData })?.data ?? res.data,
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  useEffect(() => { if (error) toast.error('Failed to load dashboard data'); }, [error]);

  const d: SellerDashboardData = data ?? {
    gmv_month: 0, gmv_change_pct: 0, pending_payout: 0, next_payout_date: '',
    active_listings: 0, orders_awaiting_action: 0, aging_listings_count: 0,
    orders_awaiting_shipment: 0, recent_orders: [],
  };

  // ── Capital recovery waterfall ────────────────────────────────────────────────
  const gmv = d.gmv_month;
  const fee = gmv * 0.025;
  const gst = fee * 0.18;
  const net = gmv - fee - gst;
  const pct = (n: number) => (gmv > 0 ? Math.max((n / gmv) * 100, 1.5) : 0);

  const name = (user?.name ?? 'there').split(' ')[0];
  const bizName = (user as (typeof user) & { business_name?: string })?.business_name ?? 'Your business';
  const city = user?.city ?? 'India';

  return (
    <AppShell
      navItems={SELLER_NAV}
      brandSub={SELLER_BRAND_SUB}
      sidebarFooter={<SellerSidebarFooter />}
      title={`Good morning, ${name}`}
      subtitle={`${bizName} · ${city}`}
      actions={
        <Link href="/seller/listings/new" className="nm-btn-primary no-underline" style={{ fontSize: 13.5, padding: '9px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> New listing
        </Link>
      }
    >
      {/* Onboarding banner — shown when business name not set or no listings yet */}
      {(!bizName || bizName === name || !(d.active_listings ?? d.live_listings ?? 1)) && (
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4"
          style={{ background: 'var(--nm-green-soft)', border: '1px solid rgba(31,107,58,.2)', borderRadius: 14, padding: '14px 20px' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-green)', margin: 0 }}>
              Complete your seller profile to unlock payouts
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--nm-muted)', margin: '3px 0 0' }}>
              Add business details, GST & bank account — takes 2 minutes
            </p>
          </div>
          <Link href="/seller/profile" className="nm-btn-soft no-underline" style={{ fontSize: 13, padding: '9px 16px', flexShrink: 0 }}>
            Complete profile →
          </Link>
        </div>
      )}

      {/* Alert banners */}
      {d.aging_listings_count > 0 && (
        <div
          className="flex items-center gap-3 mb-3"
          style={{ background: 'var(--nm-gold-soft)', border: '1px solid var(--nm-gold-line)', borderRadius: 14, padding: '12px 18px' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--nm-gold-ink)', flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-gold-ink)', margin: 0, flex: 1 }}>
            {d.aging_listings_count} listing{d.aging_listings_count > 1 ? 's' : ''} haven&apos;t sold in 30+ days
          </p>
          <Link href="/seller/listings" className="flex items-center gap-1 no-underline" style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-gold-ink)', whiteSpace: 'nowrap' }}>
            Review <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {d.orders_awaiting_shipment > 0 && (
        <div
          className="flex items-center gap-3 mb-3"
          style={{ background: 'var(--nm-info-soft)', border: '1px solid #c9e3ec', borderRadius: 14, padding: '12px 18px' }}
        >
          <Truck size={18} style={{ color: 'var(--nm-info)', flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nm-info)', margin: 0, flex: 1 }}>
            {d.orders_awaiting_shipment} order{d.orders_awaiting_shipment > 1 ? 's' : ''} awaiting shipment
          </p>
          <Link href="/seller/orders" className="flex items-center gap-1 no-underline" style={{ fontSize: 13, fontWeight: 700, color: 'var(--nm-info)', whiteSpace: 'nowrap' }}>
            View orders <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-1 mb-6">
        <Kpi
          label="GMV this month"
          value={inr(d.gmv_month)}
          sub={d.gmv_change_pct ? `${d.gmv_change_pct >= 0 ? '+' : ''}${d.gmv_change_pct.toFixed(1)}% vs last month` : undefined}
          positive={d.gmv_change_pct >= 0}
          icon={IndianRupee}
        />
        <Kpi
          label="Pending payout"
          value={inr(d.pending_payout)}
          sub={d.next_payout_date ? `Expected ${fmtDate(d.next_payout_date)}` : 'No payout scheduled'}
          icon={Wallet}
        />
        <Kpi label="Active listings" value={d.active_listings.toLocaleString('en-IN')} icon={Package} />
        <Kpi
          label="Awaiting action"
          value={d.orders_awaiting_action.toLocaleString('en-IN')}
          positive={d.orders_awaiting_action === 0}
          icon={ShoppingBag}
        />
      </div>

      {/* Two-column row */}
      <div className="grid gap-5 mb-6" style={{ gridTemplateColumns: '1.2fr .8fr' }}>
        {/* Capital recovery estimator */}
        <div className="nm-card" style={{ padding: 22 }}>
          <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--nm-ink)' }}>Capital recovery</h3>
          <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: '4px 0 18px' }}>
            What you&apos;ll actually receive this cycle.
          </p>

          {/* Waterfall */}
          <div className="flex flex-col gap-3">
            {/* GMV */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: 12.5, color: 'var(--nm-muted)', fontWeight: 600 }}>Gross sales (GMV)</span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-ink)' }}>{inr(gmv)}</span>
              </div>
              <div style={{ height: 22, borderRadius: 8, background: 'var(--nm-green)', width: '100%' }} />
            </div>

            {/* Platform fee */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: 12.5, color: 'var(--nm-muted)', fontWeight: 600 }}>− Platform fee 2.5%</span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-red)' }}>−{inr(fee)}</span>
              </div>
              <div style={{ height: 22, borderRadius: 8, background: 'var(--nm-red-soft)', borderLeft: '4px solid var(--nm-red)', width: `${pct(fee)}%`, minWidth: 60 }} />
            </div>

            {/* GST on fee */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: 12.5, color: 'var(--nm-muted)', fontWeight: 600 }}>− GST on fee 18%</span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--nm-red)' }}>−{inr(gst)}</span>
              </div>
              <div style={{ height: 18, borderRadius: 8, background: 'var(--nm-red-soft)', borderLeft: '4px solid var(--nm-red)', width: `${pct(gst)}%`, minWidth: 40 }} />
            </div>
          </div>

          {/* Net result */}
          <div
            className="flex items-center justify-between mt-5"
            style={{ background: 'var(--nm-green-soft)', borderRadius: 14, padding: '16px 18px' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nm-green)' }}>Net payout</span>
            <span className="num disp" style={{ fontSize: 22, fontWeight: 800, color: 'var(--nm-green)' }}>{inr(net)}</span>
          </div>
        </div>

        {/* Recent orders */}
        <SectionCard
          title="Recent orders"
          action={<Link href="/seller/orders" className="no-underline" style={{ fontSize: 13, color: 'var(--nm-green)', fontWeight: 600 }}>View all →</Link>}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
          ) : d.recent_orders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag size={34} style={{ color: 'var(--nm-faint)', margin: '0 auto 10px' }} />
              <p style={{ color: 'var(--nm-muted)', fontSize: 13 }}>No orders yet.</p>
            </div>
          ) : (
            <table className="nm-table">
              <thead><tr>
                <th>Order</th><th>Item</th><th>Buyer</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th>
              </tr></thead>
              <tbody>
                {d.recent_orders.slice(0, 6).map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/seller/orders`)}>
                    <td style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 12.5 }}>
                      {o.order_number ?? o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ maxWidth: 130 }}>
                      <span className="disp" style={{ fontSize: 12.5, fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.listing_title}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--nm-muted)', maxWidth: 110, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.buyer_business_name || o.buyer_name || '—'}
                    </td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>{inr(Number(o.total_amount ?? 0))}</td>
                    <td><Badge status={STATUS_LABEL[o.status] ?? 'Pending'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/seller/listings/new" className="nm-btn-soft no-underline" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Plus size={16} /> Add listing
        </Link>
        <Link href="/seller/orders" className="nm-btn-soft no-underline" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <ShoppingBag size={16} /> View all orders
        </Link>
        <Link href="/seller/payouts" className="nm-btn-soft no-underline" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Wallet size={16} /> Check payouts
        </Link>
      </div>
    </AppShell>
  );
}
