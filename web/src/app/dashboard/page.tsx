'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag, LayoutDashboard, Package, User, LogOut,
  TrendingUp, IndianRupee, ShoppingCart, Clock, CheckCircle,
  XCircle, Loader2, Menu, X
} from 'lucide-react';
import { ordersApi, type Order } from '@/lib/api';
import { getUser, removeToken, isAuthenticated } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: Loader2 },
  shipped: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-700', icon: Package },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setUser(getUser());
  }, [router]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => ordersApi.getMyOrders(),
    // Backend returns { success, data: [...orders] }
    select: (res) => {
      const payload = (res.data as unknown as { data: Order[] | { rows: Order[] } })?.data;
      if (Array.isArray(payload)) return payload;
      if (payload && 'rows' in payload) return payload.rows;
      return [];
    },
    enabled: isAuthenticated(),
  });

  const orderList: Order[] = Array.isArray(orders) ? orders : [];

  const totalOrders = orderList.length;
  const totalSpent = orderList.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const pendingOrders = orderList.filter((o) => o.status === 'pending').length;
  const deliveredOrders = orderList.filter((o) => o.status === 'delivered').length;

  function handleLogout() {
    removeToken();
    router.push('/');
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">
            Nirmal<span className="text-primary-600">Mandi</span>
          </span>
        </Link>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500">Buyer Account</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {[
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/listings', label: 'Browse Inventory', icon: Package },
          { href: '/dashboard', label: 'My Orders', icon: ShoppingCart },
          { href: '/dashboard', label: 'My Profile', icon: User },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col border-r border-gray-200 shadow-xl">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-500">Welcome back, {user.name}</p>
          </div>
          <div className="ml-auto">
            <Link href="/listings" className="btn-primary text-sm py-1.5 px-3">
              Browse Inventory
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Orders',
                value: totalOrders,
                icon: ShoppingCart,
                color: 'text-primary-600 bg-primary-50',
              },
              {
                label: 'Total Spent',
                value: `₹${totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                icon: IndianRupee,
                color: 'text-accent-600 bg-accent-50',
              },
              {
                label: 'Pending',
                value: pendingOrders,
                icon: Clock,
                color: 'text-yellow-600 bg-yellow-50',
              },
              {
                label: 'Delivered',
                value: deliveredOrders,
                icon: TrendingUp,
                color: 'text-green-600 bg-green-50',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Orders table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">My Orders</h2>
              <span className="badge bg-gray-100 text-gray-600">{totalOrders} total</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : orderList.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-700 mb-1">No orders yet</h3>
                <p className="text-sm text-gray-500 mb-4">Start browsing and place your first order</p>
                <Link href="/listings" className="btn-primary text-sm">
                  Browse Inventory
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                      <th className="text-left px-6 py-3 font-medium">Order #</th>
                      <th className="text-left px-6 py-3 font-medium">Item</th>
                      <th className="text-left px-6 py-3 font-medium">Qty</th>
                      <th className="text-left px-6 py-3 font-medium">Amount</th>
                      <th className="text-left px-6 py-3 font-medium">Status</th>
                      <th className="text-left px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderList.map((order) => {
                      const status = STATUS_CONFIG[order.status] ?? {
                        label: order.status,
                        color: 'bg-gray-100 text-gray-600',
                        icon: Clock,
                      };
                      const StatusIcon = status.icon;
                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-medium text-primary-600">
                            {order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-6 py-4 max-w-[200px]">
                            <p className="font-medium text-gray-900 truncate">
                              {order.listing_title ?? 'Inventory Item'}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {order.quantity.toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            ₹{(order.total_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`badge gap-1 ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                            {formatDate(order.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Profile section */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-5 h-5 text-primary-600" />
              <h2 className="text-base font-semibold text-gray-900">My Profile</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Full Name', value: user.name },
                { label: 'Mobile', value: user.phone },
                { label: 'State', value: user.state ?? '—' },
                { label: 'City', value: user.city ?? '—' },
                { label: 'Role', value: 'Buyer' },
                { label: 'Language', value: user.language_preference ?? 'English' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
