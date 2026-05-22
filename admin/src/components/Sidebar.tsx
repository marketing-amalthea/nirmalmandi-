'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Scale,
  Users,
  Tag,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Inventory', href: '/inventory', icon: Package },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { label: 'Disputes', href: '/disputes', icon: Scale },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Categories', href: '/categories', icon: Tag },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nm_admin_token');
      localStorage.removeItem('nm_admin_user');
      window.location.href = '/login';
    }
  };

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-nm-surface dark:bg-nm-surface-dark border-r border-nm-border dark:border-nm-border-dark transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-nm-border dark:border-nm-border-dark h-16">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-nm-primary rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-nm-text dark:text-nm-text-dark truncate">NirmalMandi</p>
              <p className="text-[10px] text-nm-text-muted dark:text-nm-text-dark-muted truncate">Amalthea Command</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-nm-primary rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">N</span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-nm-text-muted dark:text-nm-text-dark-muted transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100',
                isActive
                  ? 'bg-nm-primary/10 text-nm-primary dark:bg-nm-primary/20 dark:text-nm-primary-light'
                  : 'text-nm-text-muted dark:text-nm-text-dark-muted hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-nm-text dark:hover:text-nm-text-dark',
                collapsed && 'justify-center'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-nm-border dark:border-nm-border-dark p-2 space-y-0.5">
        <Link
          href="/notifications"
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100',
            pathname === '/notifications'
              ? 'bg-nm-primary/10 text-nm-primary dark:bg-nm-primary/20 dark:text-nm-primary-light'
              : 'text-nm-text-muted dark:text-nm-text-dark-muted hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-nm-text dark:hover:text-nm-text-dark',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell size={18} className="shrink-0" />
          {!collapsed && <span>Notifications</span>}
        </Link>

        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-nm-danger hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-nm-text-muted dark:text-nm-text-dark-muted hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
