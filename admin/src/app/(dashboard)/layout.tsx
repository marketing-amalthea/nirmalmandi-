'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('nm_admin_token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden bg-nm-bg dark:bg-nm-bg-dark">
      <Sidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
