'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Heart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, ListingCard } from '@/components/ui';
import { inventoryApi, type Listing } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { useBuyerNav, BUYER_SIDEBAR_FOOTER } from '@/lib/buyerNav';

const sidebarFooter = (
  <div style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px' }}>
    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', margin: 0, lineHeight: 1.4 }}>🛡 Escrow protected — every order is held safe until you confirm delivery.</p>
  </div>
);

type WatchlistListing = Listing & { price_dropped?: boolean; previous_price?: number };

export default function WatchlistPage() {
  const router = useRouter();
  const buyerNav = useBuyerNav();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => inventoryApi.getWatchlist(),
    select: (res) => {
      const payload = res.data as unknown as { data?: WatchlistListing[] } | WatchlistListing[];
      if (Array.isArray(payload)) return payload;
      return payload?.data ?? [];
    },
    enabled: isAuthenticated(),
  });

  const all: WatchlistListing[] = Array.isArray(data) ? data : [];
  const listings = all.filter((l) => !removedIds.has(l.id));
  const priceDrops = listings.filter((l) => l.price_dropped || (l.previous_price && l.previous_price > (l.asking_price ?? l.price_per_unit ?? 0))).length;

  async function handleRemove(listingId: string) {
    setRemovedIds((prev) => new Set([...prev, listingId]));
    try {
      await import('@/lib/api').then(m => m.default.delete(`/buyer/watchlist/${listingId}`));
      toast.success('Removed from watchlist');
    } catch {
      setRemovedIds((prev) => { const next = new Set(prev); next.delete(listingId); return next; });
      toast.error('Could not remove. Please try again.');
      refetch();
    }
  }

  return (
    <AppShell
      navItems={buyerNav} brandSub="Buyer Portal" sidebarFooter={BUYER_SIDEBAR_FOOTER}
      title={`${listings.length} saved lot${listings.length !== 1 ? 's' : ''}`}
      subtitle={priceDrops > 0 ? `${priceDrops} dropped price` : 'lots you are watching'}
      actions={<Link href="/listings" className="nm-btn-secondary no-underline" style={{ fontSize: 13, padding: '9px 14px' }}>Browse more</Link>}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      ) : isError ? (
        <div className="text-center py-16">
          <p style={{ color: 'var(--nm-red)', fontSize: 14, fontWeight: 600 }}>Failed to load watchlist.</p>
          <button onClick={() => refetch()} className="nm-btn-secondary mt-4" style={{ fontSize: 13 }}>Try again</button>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} style={{ color: 'var(--nm-faint)', margin: '0 auto 12px' }} />
          <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, color: 'var(--nm-ink)', marginBottom: 6 }}>No saved lots yet</h3>
          <Link href="/listings" className="no-underline" style={{ fontSize: 14, color: 'var(--nm-green)', fontWeight: 600 }}>Browse deals →</Link>
        </div>
      ) : (
        <>
          {priceDrops > 0 && (
            <div style={{ background: 'var(--nm-green-soft)', borderRadius: 12, padding: '13px 18px', marginBottom: 20 }}>
              <p style={{ fontSize: 13.5, color: 'var(--nm-green)', fontWeight: 600, margin: 0 }}>💰 {priceDrops} lot{priceDrops !== 1 ? 's' : ''} dropped in price since you saved them</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 18 }}>
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} watchlisted onWatchlist={handleRemove} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
