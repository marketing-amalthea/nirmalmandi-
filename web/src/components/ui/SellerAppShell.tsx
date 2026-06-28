'use client';

import { useSellerNav, SELLER_BRAND_SUB, SellerSidebarFooter } from '@/app/seller/_nav';
import AppShell from './AppShell';
import type { ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function SellerAppShell({ title, subtitle, actions, children }: Props) {
  const sellerNav = useSellerNav();
  return (
    <AppShell
      navItems={sellerNav}
      brandSub={SELLER_BRAND_SUB}
      sidebarFooter={<SellerSidebarFooter />}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}
