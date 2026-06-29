'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, IndianRupee, Clock, CheckCircle, Loader2, Bell, Package } from 'lucide-react';
import { AppShell, Kpi, Badge, SectionCard, Avatar, inr } from '@/components/ui';
import PhoneVerificationWidget from '@/components/PhoneVerificationWidget';
import { ordersApi, type Order } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import { useBuyerNav, BUYER_SIDEBAR_FOOTER } from '@/lib/buyerNav';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function BuyerDashboard() {
  const router = useRouter();
  const user = getUser();
  const buyerNav = useBuyerNav();

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['buyer-orders-dashboard'],
    queryFn: async () => {
      const res = await ordersApi.getMyOrders({ limit: 10 } as Parameters<typeof ordersApi.getMyOrders>[0]);
      // API returns { success, data: { orders: [...], total, page, limit } }
      const payload = res.data as unknown as { data?: { orders?: Order[] } | Order[] };
      const inner = payload?.data;
      if (Array.isArray(inner)) return inner;
      if (inner && 'orders' in inner && Array.isArray(inner.orders)) return inner.orders;
      return [];
    },
    enabled: isAuthenticated(),
  });

  const totalSpent   = orders.filter(o => ['completed','delivered'].includes(o.status ?? '')).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const pending      = orders.filter(o => ['pending','pending_payment','paid','confirmed','shipped'].includes(o.status ?? '')).length;
  const delivered    = orders.filter(o => ['delivered','completed'].includes(o.status ?? '')).length;

  return (
    <AppShell
      navItems={buyerNav}
      brandSub="Buyer Portal"
      sidebarFooter={BUYER_SIDEBAR_FOOTER}
      title={`Welcome back, ${user?.name ?? user?.phone ?? 'there'}`}
      subtitle={user?.city ? `${user.city}` : undefined}
      actions={
        <div className="flex items-center gap-3">
          <Link href="/listings" className="nm-btn-primary no-underline" style={{ fontSize: 13.5, padding: '9px 16px' }}>Browse inventory</Link>
          <Link href="/notifications" style={{ color: 'var(--nm-muted)', display: 'flex', alignItems: 'center' }}><Bell size={20} strokeWidth={1.8} /></Link>
          <Avatar initials={(user?.name ?? user?.phone ?? 'B').slice(0, 2).toUpperCase()} size={38} />
        </div>
      }
    >
      {/* Phone verification prompt — shown only to email/Google signups without a phone */}
      {user && (!user.phone || user.phone.startsWith('email_') || user.phone.startsWith('google_')) && (
        <div className="mb-5">
          <PhoneVerificationWidget
            currentPhone={user.phone?.startsWith('email_') || user.phone?.startsWith('google_') ? null : user.phone}
            onVerified={() => window.location.reload()}
          />
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total orders" value={String(orders.length)} sub={`+${orders.filter(o => { const d = new Date(o.created_at ?? ''); return Date.now() - d.getTime() < 7*86400000; }).length} this week`} positive icon={ShoppingCart} />
        <Kpi label="Total spent" value={inr(totalSpent)} icon={IndianRupee} />
        <Kpi label="Pending" value={String(pending)} icon={Clock} positive={pending === 0} />
        <Kpi label="Delivered" value={String(delivered)} sub={delivered > 0 ? `${Math.round((delivered / Math.max(orders.length, 1)) * 100)}% on-time` : undefined} positive icon={CheckCircle} />
      </div>

      {/* Recent orders */}
      <SectionCard title="Recent orders" action={<Link href="/orders" style={{ fontSize: 13, color: 'var(--nm-green)', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>}>
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={24} style={{ color: 'var(--nm-green)' }} className="animate-spin" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10">
            <Package size={40} style={{ color: 'var(--nm-faint)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--nm-muted)', fontSize: 14 }}>No orders yet. <Link href="/listings" style={{ color: 'var(--nm-green)', fontWeight: 600 }}>Browse deals</Link> to get started.</p>
          </div>
        ) : (
          <table className="nm-table">
            <thead><tr>
              <th>Order</th><th>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Amount</th><th>Escrow</th><th>Status</th><th>Date</th>
            </tr></thead>
            <tbody>
              {orders.slice(0, 8).map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/orders/${o.id}`)}>
                  <td style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 13 }}>{String(o.order_number ?? o.id?.slice(0, 8))}</td>
                  <td style={{ maxWidth: 200 }}>
                    <span className="disp" style={{ fontSize: 13, fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {String((o as unknown as Record<string,unknown>).listing_title ?? 'Order')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--nm-faint)' }}>{timeAgo(o.created_at ?? '')}</span>
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>{o.quantity}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>{inr(Number(o.total_amount ?? 0))}</td>
                  <td>
                    {['paid','confirmed','shipped','in_transit'].includes(o.status ?? '') && (
                      <span className="nm-pill" style={{ color: 'var(--nm-info)', background: 'var(--nm-info-soft)', fontSize: 11 }}>Holding</span>
                    )}
                    {['delivered','completed'].includes(o.status ?? '') && (
                      <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontSize: 11 }}>Released</span>
                    )}
                  </td>
                  <td><Badge status={o.status ?? 'Pending'} /></td>
                  <td style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>{fmt(o.created_at ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </AppShell>
  );
}
