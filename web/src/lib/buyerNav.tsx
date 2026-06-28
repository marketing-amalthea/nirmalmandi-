'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Package, Heart, Gift, User, Bell,
} from 'lucide-react';
import { type NavItem } from '@/components/ui/Sidebar';
import { notificationsApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

export const BUYER_NAV_BASE: NavItem[] = [
  { label: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard },
  { label: 'Browse lots',   href: '/listings',      icon: ShoppingBag },
  { label: 'Orders',        href: '/orders',        icon: Package },
  { label: 'Watchlist',     href: '/watchlist',     icon: Heart },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Referral',      href: '/referral',      icon: Gift },
  { label: 'Profile',       href: '/profile',       icon: User },
];

export function useBuyerNav(): NavItem[] {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await notificationsApi.getUnreadCount();
        const count = (res.data as unknown as { data?: { count?: number } })?.data?.count ?? 0;
        if (!cancelled) setUnread(count);
      } catch { /* silent */ }
    }
    fetchUnread();
    const iv = setInterval(fetchUnread, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return BUYER_NAV_BASE.map(item =>
    item.href === '/notifications' && unread > 0 ? { ...item, badge: unread } : item
  );
}

export const BUYER_SIDEBAR_FOOTER = (
  <div style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px' }}>
    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', margin: 0, lineHeight: 1.4 }}>
      🛡 Escrow protected — every order is held safe until you confirm delivery.
    </p>
  </div>
);
