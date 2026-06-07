'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, LogOut, User, LayoutDashboard, Store, Bell, Gift, Moon, Sun } from 'lucide-react';
import { getUser, removeToken, isAuthenticated } from '@/lib/auth';
import { notificationsApi } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useState, useEffect, useRef } from 'react';
import type { AuthUser } from '@/lib/auth';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { colorMode, toggleColorMode } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getUser());
    } else {
      setUser(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    async function fetchUnreadCount() {
      try {
        const res = await notificationsApi.getUnreadCount();
        const payload = (res.data as unknown as { data?: { count: number }; count?: number });
        const count = payload?.data?.count ?? payload?.count ?? 0;
        setUnreadCount(count);
      } catch {
        // silently fail — badge just won't show
      }
    }

    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  function handleLogout() {
    removeToken();
    setUser(null);
    router.push('/');
  }

  const isSeller = user?.role === 'seller';
  const dashboardHref = isSeller ? '/seller/dashboard' : '/dashboard';

  return (
    <header className="bg-nm-surface dark:bg-nm-surface-dark border-b border-nm-border dark:border-nm-border-dark sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-nm-primary rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-nm-text dark:text-nm-text-dark">
              Nirmal<span className="text-nm-primary">Mandi</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/listings" className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-primary font-medium transition-colors">
              Browse Deals
            </Link>
            {(!user || !isSeller) && (
              <Link href="/seller-register" className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-primary font-medium transition-colors">
                Sell on NirmalMandi
              </Link>
            )}
            {isSeller && (
              <Link href="/seller/listings/new" className="text-sm text-nm-seller hover:text-nm-seller-dark font-medium transition-colors">
                + New Listing
              </Link>
            )}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleColorMode}
              className="p-1.5 rounded-lg text-nm-text-muted dark:text-nm-text-dark-muted hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {colorMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <>
                <Link
                  href={dashboardHref}
                  className="hidden sm:flex items-center gap-1.5 text-sm text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-primary font-medium transition-colors"
                >
                  {isSeller ? <Store className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                  {isSeller ? 'Seller Portal' : 'Dashboard'}
                </Link>

                <Link
                  href="/referral"
                  className="hidden sm:flex items-center gap-1.5 text-sm text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-primary font-medium transition-colors"
                >
                  <Gift className="w-4 h-4" />
                  <span className="hidden lg:inline">Referrals</span>
                </Link>

                <Link href="/notifications" className="relative text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-primary transition-colors p-1">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-nm-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                <div className="flex items-center gap-2 bg-gray-100 dark:bg-nm-surface-dark rounded-lg px-3 py-1.5">
                  <User className="w-4 h-4 text-nm-text-muted dark:text-nm-text-dark-muted" />
                  <span className="text-sm font-medium text-nm-text dark:text-nm-text-dark max-w-[100px] truncate">{user.name}</span>
                  {isSeller && (
                    <span className="text-xs font-medium bg-nm-seller-pale text-nm-seller-dark px-1.5 py-0.5 rounded">Seller</span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-danger font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="nm-btn-secondary text-sm py-1.5 px-3">
                  Login
                </Link>
                <Link href="/seller-register" className="nm-btn-seller text-sm py-1.5 px-3">
                  Sell Now
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
