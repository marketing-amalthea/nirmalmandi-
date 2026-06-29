'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, MapPin, BadgeCheck, Package, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { storefrontApi, type Listing } from '@/lib/api';

interface StorefrontSeller {
  business_name: string;
  slug: string;
  banner_url: string | null;
  tagline: string | null;
  verification_tier: string;
  city: string | null;
  state: string | null;
  total_gmv: number;
  reseller_margin_pct: number;
}

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [seller, setSeller] = useState<StorefrontSeller | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await storefrontApi.get(slug, { page: p, limit: 12 });
      const d = (res.data as { data: { seller: StorefrontSeller; listings: Listing[]; total: number } }).data;
      setSeller(d.seller);
      setListings(d.listings);
      setTotal(d.total);
      setPage(p);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      setError(err?.response?.status === 404 ? 'Storefront not found or not active.' : 'Failed to load storefront.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, [slug]);

  const tierLabel: Record<string, string> = {
    unverified: '', basic: 'Verified', verified: 'Verified', premium: 'Premium Seller',
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-nm-primary" />
    </div>
  );

  if (error || !seller) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <AlertCircle className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 font-medium">{error || 'Storefront not found'}</p>
      <Link href="/" className="text-nm-primary text-sm hover:underline font-medium">Browse all listings</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      {seller.banner_url ? (
        <div className="h-48 sm:h-64 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={seller.banner_url} alt="Storefront banner" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-32 sm:h-48 w-full bg-gradient-to-r from-nm-primary to-blue-700" />
      )}

      {/* Header card */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 mb-8">
        <div className="bg-white dark:bg-nm-surface-dark rounded-2xl shadow-lg p-6 flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-nm-primary flex items-center justify-center flex-shrink-0 shadow">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-nm-text dark:text-nm-text-dark">{seller.business_name}</h1>
              {seller.verification_tier !== 'unverified' && (
                <span className="flex items-center gap-1 text-xs font-semibold text-nm-primary bg-nm-primary-pale px-2 py-0.5 rounded-full">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  {tierLabel[seller.verification_tier]}
                </span>
              )}
            </div>
            {seller.tagline && <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-1">{seller.tagline}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
              {(seller.city || seller.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[seller.city, seller.state].filter(Boolean).join(', ')}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {total} listing{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
            <a
              href="#listings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-nm-primary hover:opacity-90 px-3.5 py-2 rounded-lg transition-opacity"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Contact seller
            </a>
            <Link href="/listings" className="flex items-center gap-1.5 text-[11px] text-nm-primary font-medium hover:underline">
              <ExternalLink className="w-3 h-3" /> NirmalMandi
            </Link>
          </div>
        </div>

        {seller.reseller_margin_pct > 0 && (
          <div className="mt-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
            Prices include a {seller.reseller_margin_pct}% reseller margin set by this seller.
          </div>
        )}
      </div>

      {/* Listings grid */}
      <div id="listings" className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 scroll-mt-6">
        {listings.length === 0 ? (
          <div className="text-center py-20 text-nm-text-muted dark:text-nm-text-dark-muted">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active listings</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map(listing => (
                <Link key={listing.id} href={`/listings/${listing.id}`}
                  className="bg-white dark:bg-nm-surface-dark rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-nm-border dark:border-nm-border-dark group">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {listing.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.images[0]} alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-nm-text dark:text-nm-text-dark line-clamp-2 leading-snug">{listing.title}</p>
                    <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1">
                      {(listing as unknown as { sector_name?: string }).sector_name} · Grade {listing.condition_grade}
                    </p>
                    <p className="text-base font-bold text-nm-primary mt-2">
                      ₹{Number(listing.asking_price).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-nm-text-muted dark:text-nm-text-dark-muted">
                      {listing.available_quantity} units
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {total > 12 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button onClick={() => load(page - 1)} disabled={page === 1}
                  className="nm-btn-secondary px-5 py-2 text-sm disabled:opacity-40">Previous</button>
                <span className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted">
                  Page {page} of {Math.ceil(total / 12)}
                </span>
                <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 12)}
                  className="nm-btn-secondary px-5 py-2 text-sm disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
            Powered by{' '}
            <Link href="/" className="text-nm-primary font-semibold hover:underline">NirmalMandi</Link>
            {' '}— India's B2B Dead Inventory Marketplace
          </p>
        </div>
      </div>
    </div>
  );
}
