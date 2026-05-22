'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, LogOut, User, LayoutDashboard, Store, Bell } from 'lucide-react';
import { getUser, removeToken, isAuthenticated } from '@/lib/auth';
import { useState, useEffect } from 'react';
import type { AuthUser } from '@/lib/auth';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (isAuthenticated()) setUser(getUser());
    else setUser(null);
  }, [pathname]);

  function handleLogout() {
    removeToken();
    setUser(null);
    router.push('/');
  }

  const isSeller = user?.role === 'seller';
  const dashboardHref = isSeller ? '/seller/dashboard' : '/dashboard';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              Nirmal<span className="text-primary-600">Mandi</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/listings" className="text-sm text-gray-600 hover:text-primary-600 font-medium transition-colors">
              Browse Deals
            </Link>
            {!user && (
              <Link href="/seller/register" className="text-sm text-gray-600 hover:text-primary-600 font-medium transition-colors">
                Sell on NirmalMandi
              </Link>
            )}
            {isSeller && (
              <Link href="/seller/listings/new" className="text-sm text-accent-600 hover:text-accent-700 font-medium transition-colors">
                + New Listing
              </Link>
            )}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href={dashboardHref}
                  className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 font-medium transition-colors"
                >
                  {isSeller ? <Store className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                  {isSeller ? 'Seller Portal' : 'Dashboard'}
                </Link>
                <Link href="/notifications" className="relative text-gray-500 hover:text-primary-600 transition-colors p-1">
                  <Bell className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">{user.name}</span>
                  {isSeller && (
                    <span className="text-xs font-medium bg-accent-100 text-accent-700 px-1.5 py-0.5 rounded">Seller</span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary text-sm py-1.5 px-3">
                  Login
                </Link>
                <Link href="/seller/register" className="btn-accent text-sm py-1.5 px-3">
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
