'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Package, MapPin, Tag, IndianRupee, ShoppingCart,
  CheckCircle, AlertCircle, Loader2, Calculator, BadgeCheck, Zap, Megaphone, MessageCircle, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import MarketingPanel from '@/components/MarketingPanel';
import NegotiationModal from '@/components/NegotiationModal';
import AuctionPanel from '@/components/AuctionPanel';
import api, { inventoryApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  const [calcQuantity, setCalcQuantity] = useState(1);
  const [showMarketing, setShowMarketing] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('market') === '1';
  });
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  async function handleWatchlist() {
    if (!isAuthenticated()) { toast.error('Login to save listings'); router.push('/login'); return; }
    setWatchlistLoading(true);
    try {
      if (watchlisted) {
        await api.delete(`/buyer/watchlist/${String(l.id)}`);
        setWatchlisted(false);
        toast.success('Removed from watchlist');
      } else {
        await api.post('/buyer/watchlist', { listing_id: String(l.id) });
        setWatchlisted(true);
        toast.success('Saved to watchlist');
      }
    } catch { toast.error('Could not update watchlist'); }
    finally { setWatchlistLoading(false); }
  }

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => inventoryApi.getListing(id),
    select: (res) => (res.data as unknown as { data: Record<string, unknown> })?.data ?? null,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-semibold text-gray-800">Listing not found</h2>
          <p className="text-gray-500 text-sm">This listing may have been removed or does not exist.</p>
          <Link href="/listings" className="btn-primary">Browse all listings</Link>
        </div>
      </div>
    );
  }

  // Normalize field names
  const l = listing as Record<string, unknown>;
  const pricePerUnit = Number(l.asking_price ?? l.price_per_unit ?? 0);
  const availableQty = Number(l.available_quantity ?? l.quantity ?? 0);
  const sectorName = String(l.sector_name ?? l.sector ?? '—');
  const sellerLocation = [l.city ?? l.seller_city, l.state ?? l.seller_state].filter(Boolean).join(', ') || '—';
  const listingTitle = String(l.title ?? '');
  const listingDesc = l.description ? String(l.description) : null;
  const listingUnit = String(l.unit ?? 'unit');
  const listingStatus = String(l.status ?? 'unknown');
  const urgencyDays = l.urgency_days ? Number(l.urgency_days) : 0;
  const mrp = l.mrp ? Number(l.mrp) : null;
  const gstRate = Number(l.gst_rate ?? 18);
  const conditionGrade = l.condition_grade ? String(l.condition_grade) : null;
  const sellerVerificationTier = l.seller_verification_tier
    ? String(l.seller_verification_tier)
    : (l.seller_tier ? String(l.seller_tier) : null);
  const isVerifiedSeller = sellerVerificationTier === 'verified' || sellerVerificationTier === 'premium';
  const sellerBusinessName = l.seller_business_name ? String(l.seller_business_name) : null;
  const sectorSpecificFields = l.sector_specific_fields && typeof l.sector_specific_fields === 'object'
    ? l.sector_specific_fields as Record<string, unknown>
    : null;

  // Lot calculator derived values
  const safeCalcQty = Math.max(1, Math.min(availableQty || 1, calcQuantity));
  const calcTotal = pricePerUnit * safeCalcQty;
  const estimatedResale = mrp ? mrp * safeCalcQty : null;
  const estimatedMargin = mrp && mrp > 0 ? (((mrp - pricePerUnit) / mrp) * 100).toFixed(1) : null;

  function handleBuyNow() {
    if (!isAuthenticated()) {
      toast.error('Please login to place an order');
      router.push('/login');
      return;
    }
    router.push(`/checkout?listing_id=${String(l.id)}&quantity=${safeCalcQty}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {showNegotiation && (
        <NegotiationModal
          listing={{
            id: String(l.id ?? ''),
            title: listingTitle,
            asking_price: pricePerUnit,
            mrp: mrp ?? undefined,
            sector: sectorName,
            floor_price: l.floor_price ? Number(l.floor_price) : undefined,
          }}
          onClose={() => setShowNegotiation(false)}
          onAccepted={(agreedPrice, negId) => {
            router.push(`/checkout?listing_id=${String(l.id)}&quantity=${safeCalcQty}&agreed_price=${agreedPrice}&negotiation_id=${negId}`);
          }}
        />
      )}

      {showMarketing && (
        <MarketingPanel
          listing={{
            id: String(l.id ?? ''),
            title: listingTitle,
            sector_name: sectorName,
            asking_price: pricePerUnit,
            mrp: mrp ?? undefined,
            condition_grade: conditionGrade ?? undefined,
            city: String(l.city ?? l.seller_city ?? ''),
            state: String(l.state ?? l.seller_state ?? ''),
          }}
          onClose={() => setShowMarketing(false)}
        />
      )}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link
          href="/listings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to listings
        </Link>

        {/* Urgency banner */}
        {urgencyDays > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              Must sell in {urgencyDays} day{urgencyDays !== 1 ? 's' : ''} — seller is liquidating urgently
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Listing details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image area */}
            <div className="card overflow-hidden">
              {Array.isArray(l.images) && (l.images as string[]).length > 0 ? (
                <img
                  src={(l.images as string[])[0]}
                  alt={listingTitle}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 h-64 flex items-center justify-center">
                  <Package className="w-20 h-20 text-primary-300" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="card p-6">
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <span className="badge bg-primary-50 text-primary-700">
                  <Tag className="w-3 h-3 mr-1" />
                  {sectorName}
                </span>
                <span className={`badge ${listingStatus === 'live' || listingStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {listingStatus}
                </span>
                {conditionGrade && (
                  <span className="badge bg-blue-50 text-blue-700">
                    Grade: {conditionGrade}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">{listingTitle}</h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  {sellerLocation}
                </span>
                {sellerBusinessName && (
                  <span className="flex items-center gap-1.5">
                    {isVerifiedSeller ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full border border-blue-200">
                        <BadgeCheck className="w-3 h-3" />
                        Verified Seller
                      </span>
                    ) : null}
                    <span>{sellerBusinessName}</span>
                  </span>
                )}
              </div>

              {listingDesc && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{listingDesc}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Price per {listingUnit}</p>
                  <p className="flex items-center text-xl font-bold text-gray-900">
                    <IndianRupee className="w-4 h-4" />
                    {pricePerUnit.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Available Quantity</p>
                  <p className="text-xl font-bold text-accent-600">
                    {availableQty.toLocaleString('en-IN')} {listingUnit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">GST Rate</p>
                  <p className="text-xl font-bold text-gray-900">{gstRate}%</p>
                </div>
                {mrp && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">MRP</p>
                    <p className="text-lg font-semibold text-gray-700">₹{mrp.toLocaleString('en-IN')}</p>
                  </div>
                )}
                {estimatedMargin && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Potential Margin</p>
                    <p className="text-lg font-bold text-green-600">{estimatedMargin}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sector-specific fields */}
            {sectorSpecificFields && Object.keys(sectorSpecificFields).length > 0 && (
              <div className="card p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Product Specifications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(sectorSpecificFields).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-500 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Auction / Lot Calculator + Order CTA */}
          <div className="lg:col-span-1 space-y-4">
            {/* Auction Panel — shown only for auction listings */}
            {(String(l.price_type) === 'auction' || String(l.pricing_mode) === 'auction') && (
              <AuctionPanel
                listingId={String(l.id ?? '')}
                askingPrice={pricePerUnit}
                reservePrice={l.auction_reserve_price ? Number(l.auction_reserve_price) : null}
                auctionEndsAt={l.auction_ends_at ? String(l.auction_ends_at) : null}
                onLoginRequired={() => router.push('/login')}
              />
            )}

            {/* Lot Calculator */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Calculator className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-gray-900">Calculate Your Order</h2>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity ({listingUnit})
                </label>
                <input
                  type="number"
                  value={calcQuantity}
                  onChange={(e) => setCalcQuantity(Math.max(1, Math.min(availableQty || 999999, Number(e.target.value))))}
                  min={1}
                  max={availableQty}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-0.5">
                  Max: {availableQty.toLocaleString('en-IN')} {listingUnit}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2.5 text-sm mb-5">
                <div className="flex justify-between text-gray-700">
                  <span>Total Price</span>
                  <span className="font-bold text-gray-900">
                    ₹{calcTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Per Unit Cost</span>
                  <span>₹{pricePerUnit.toLocaleString('en-IN')}</span>
                </div>
                {estimatedResale !== null && (
                  <div className="flex justify-between text-gray-600">
                    <span>Est. Resale Value</span>
                    <span className="text-green-700 font-medium">
                      ₹{estimatedResale.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                {estimatedMargin !== null && (
                  <div className="flex justify-between border-t border-gray-200 pt-2 text-gray-600">
                    <span>Est. Margin</span>
                    <span className="font-bold text-green-600">{estimatedMargin}%</span>
                  </div>
                )}
              </div>

              {!isAuthenticated() ? (
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-4">Login required to place orders</p>
                  <Link href="/login" className="btn-primary block w-full text-center">
                    Login to Order
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleBuyNow}
                    disabled={listingStatus !== 'live' && listingStatus !== 'active'}
                    className="nm-btn-seller w-full flex items-center justify-center gap-2 py-2.5"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {(listingStatus !== 'live' && listingStatus !== 'active')
                      ? 'Not Available'
                      : `Buy Now — ${safeCalcQty.toLocaleString('en-IN')} unit${safeCalcQty !== 1 ? 's' : ''}`}
                  </button>

                  <button
                    onClick={() => setShowNegotiation(true)}
                    disabled={listingStatus !== 'live' && listingStatus !== 'active'}
                    className="nm-btn-secondary w-full flex items-center justify-center gap-2 py-2.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Make an Offer
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center mt-3">
                GST invoice will be provided with your order
              </p>

              {/* Watchlist + Marketing buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleWatchlist}
                  disabled={watchlistLoading}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    watchlisted
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-nm-border dark:border-nm-border-dark hover:border-nm-primary/40 text-nm-text-muted dark:text-nm-text-dark-muted'
                  }`}
                >
                  {watchlisted
                    ? <><BookmarkCheck className="w-4 h-4" /> Saved</>
                    : <><Bookmark className="w-4 h-4" /> Watchlist</>
                  }
                </button>
                <button
                  onClick={() => setShowMarketing(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border-2 border-nm-primary/30 bg-nm-primary-pale hover:bg-nm-primary/10 text-nm-primary-dark font-semibold text-sm transition-all"
                >
                  <Megaphone className="w-4 h-4" />
                  Market It
                </button>
              </div>
              <p className="text-xs text-center text-nm-text-muted mt-1">
                AI captions for WhatsApp, Instagram &amp; more
              </p>
            </div>

            {/* Quick stats */}
            <div className="card p-4">
              <div className="space-y-2 text-sm">
                {!!l.moq && Number(l.moq) > 1 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Min. Order Qty</span>
                    <span className="font-medium">{Number(l.moq).toLocaleString('en-IN')} {listingUnit}</span>
                  </div>
                )}
                {!!l.lot_type && (
                  <div className="flex justify-between text-gray-600">
                    <span>Lot Type</span>
                    <span className="font-medium capitalize">{String(l.lot_type)}</span>
                  </div>
                )}
                {!!l.dead_stock_type && (
                  <div className="flex justify-between text-gray-600">
                    <span>Stock Type</span>
                    <span className="font-medium capitalize">{String(l.dead_stock_type).replace(/_/g, ' ')}</span>
                  </div>
                )}
                {l.view_count !== undefined && (
                  <div className="flex justify-between text-gray-500">
                    <span>Views</span>
                    <span>{Number(l.view_count).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {l.watchlist_count !== undefined && (
                  <div className="flex justify-between text-gray-500">
                    <span>Watching</span>
                    <span>{Number(l.watchlist_count).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Escrow info box */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-800 mb-1">Escrow-Protected Payment</p>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Your funds are held securely and released to the seller only after you confirm delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
