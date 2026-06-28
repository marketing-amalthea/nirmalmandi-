'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Loader2, CheckCheck, Package, AlertTriangle, Wallet,
  IndianRupee, Star, ShieldCheck, CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/ui';
import { notificationsApi, type Notification } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { SELLER_NAV, SELLER_BRAND_SUB, SellerSidebarFooter } from '../_nav';

const PAGE_SIZE = 50;

const TYPE_TABS = [
  { key: '',        label: 'All' },
  { key: 'order',   label: 'Orders' },
  { key: 'payment', label: 'Payments' },
  { key: 'dispute', label: 'Disputes' },
  { key: 'listing', label: 'Listings' },
];

function notifIcon(type: string) {
  if (type?.includes('order'))   return <Package size={18} style={{ color: 'var(--nm-green)' }} />;
  if (type?.includes('payment') || type?.includes('escrow') || type?.includes('payout'))
    return <IndianRupee size={18} style={{ color: 'var(--nm-gold-ink)' }} />;
  if (type?.includes('dispute')) return <AlertTriangle size={18} style={{ color: 'var(--nm-red)' }} />;
  if (type?.includes('kyc'))     return <ShieldCheck size={18} style={{ color: '#2563eb' }} />;
  if (type?.includes('listing') || type?.includes('featured')) return <Star size={18} style={{ color: 'var(--nm-gold-ink)' }} />;
  if (type?.includes('wallet'))  return <Wallet size={18} style={{ color: 'var(--nm-green)' }} />;
  if (type?.includes('approved')) return <CheckCircle size={18} style={{ color: 'var(--nm-green)' }} />;
  return <Bell size={18} style={{ color: 'var(--nm-muted)' }} />;
}

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function SellerNotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('');
  const [page] = useState(1);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-notifications', activeTab, page],
    queryFn: async () => {
      const res = await notificationsApi.getNotifications({
        page, limit: PAGE_SIZE, ...(activeTab ? { type: activeTab } : {}),
      });
      const payload = res.data as unknown as { data?: { data?: Notification[]; total?: number } | Notification[] };
      const inner = payload?.data;
      if (Array.isArray(inner)) return { items: inner, total: inner.length };
      const nested = (inner as { data?: Notification[]; total?: number });
      return { items: nested?.data ?? [], total: nested?.total ?? 0 };
    },
    enabled: isAuthenticated(),
  });

  const items: Notification[] = data?.items ?? [];
  const unread = items.filter(n => n.status !== 'read').length;

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      qc.invalidateQueries({ queryKey: ['seller-notifications'] });
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to mark all read'); }
  }

  async function markOne(id: string) {
    try {
      await notificationsApi.markRead(id);
      qc.invalidateQueries({ queryKey: ['seller-notifications'] });
    } catch { /* silent */ }
  }

  return (
    <AppShell
      navItems={SELLER_NAV}
      brandSub={SELLER_BRAND_SUB}
      sidebarFooter={<SellerSidebarFooter />}
      title={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      subtitle="Updates on your listings, orders and payouts"
      actions={
        unread > 0 ? (
          <button onClick={markAll} className="nm-btn-secondary"
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCheck size={14} /> Mark all read
          </button>
        ) : null
      }
    >
      {/* Tabs */}
      <div className="flex items-center gap-2" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {TYPE_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={activeTab === t.key ? 'nm-btn-primary' : 'nm-btn-secondary'}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4" style={{ padding: '60px 0', color: 'var(--nm-faint)' }}>
          <Bell size={40} strokeWidth={1.2} />
          <p style={{ fontSize: 14, color: 'var(--nm-muted)' }}>No notifications yet</p>
          <p style={{ fontSize: 13, color: 'var(--nm-faint)' }}>Order updates, payments and listing alerts will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(n => {
            const unreadItem = n.status !== 'read';
            return (
              <div key={n.id}
                onClick={() => unreadItem && markOne(n.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px',
                  borderRadius: 14, cursor: unreadItem ? 'pointer' : 'default',
                  background: unreadItem ? 'var(--nm-green-soft)' : 'var(--nm-card)',
                  border: `1px solid ${unreadItem ? 'rgba(31,107,58,.15)' : 'var(--nm-line)'}`,
                  transition: 'background .12s',
                }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: 'var(--nm-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {notifIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p style={{ fontSize: 13.5, fontWeight: unreadItem ? 700 : 600, color: 'var(--nm-ink)', margin: 0 }}>
                      {n.title}
                    </p>
                    <span style={{ fontSize: 11.5, color: 'var(--nm-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--nm-muted)', margin: '3px 0 0', lineHeight: 1.4 }}>
                    {n.body}
                  </p>
                </div>
                {unreadItem && (
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--nm-green)', flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
