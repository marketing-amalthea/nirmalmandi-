'use client';

import Link from 'next/link';
import { MapPin, Package, IndianRupee } from 'lucide-react';
import type { Listing } from '@/lib/api';
import clsx from 'clsx';

interface Props {
  listing: Listing;
  compareSelected?: boolean;
  onCompareToggle?: (listing: Listing) => void;
}

const STATUS_COLORS: Record<string, string> = {
  live: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  sold: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  delisted: 'bg-red-100 text-red-700',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-orange-500',
  D: 'bg-red-500',
};

export default function ListingCard({ listing, compareSelected, onCompareToggle }: Props) {
  const askingPrice = listing.price_per_unit ?? listing.asking_price ?? 0;
  const mrp: number | undefined = (listing as unknown as Record<string, unknown>).mrp as number | undefined;

  const discountPct =
    mrp && mrp > askingPrice
      ? Math.round((1 - askingPrice / mrp) * 100)
      : null;

  const conditionGrade = listing.condition_grade ?? '';
  const gradeColor = GRADE_COLORS[conditionGrade.toUpperCase()] ?? 'bg-gray-400';

  const sectorLabel = listing.sector_name ?? listing.sector ?? null;

  const locationCity = listing.seller_city ?? listing.city ?? null;
  const locationState = listing.seller_state ?? listing.state ?? null;
  const locationStr = [locationCity, locationState].filter(Boolean).join(', ') || null;

  const seller = (listing as unknown as Record<string, unknown>).seller as
    | { verification_tier?: string }
    | undefined;
  const sellerTier = seller?.verification_tier ?? listing.seller_tier ?? null;
  const isVerified = sellerTier === 'verified' || sellerTier === 'premium';

  const urgencyDays = listing.urgency_days ?? 0;

  return (
    <div className="relative">
    {/* Compare checkbox */}
    {onCompareToggle && (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCompareToggle(listing); }}
        className={`absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
          compareSelected
            ? 'bg-nm-primary text-white border-nm-primary'
            : 'bg-white/90 text-gray-600 border-gray-300 hover:border-nm-primary hover:text-nm-primary'
        }`}
      >
        {compareSelected ? '✓ Added' : '+ Compare'}
      </button>
    )}
    <Link
      href={`/listings/${listing.id}`}
      className="card block hover:shadow-md transition-shadow duration-150 group relative"
    >
      {/* Image area */}
      <div className="relative bg-gradient-to-br from-primary-50 to-primary-100 h-40 rounded-t-xl flex items-center justify-center overflow-hidden">
        <Package className="w-12 h-12 text-primary-300" />

        {/* Discount badge — top-right */}
        {discountPct !== null && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm">
            {discountPct}% off
          </span>
        )}

        {/* Condition grade — top-left */}
        {conditionGrade && (
          <span
            className={clsx(
              'absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm',
              gradeColor
            )}
            title={`Condition Grade ${conditionGrade}`}
          >
            {conditionGrade.toUpperCase()}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Top row: sector pill + status badge */}
        <div className="flex items-center justify-between mb-2 gap-1 flex-wrap">
          {sectorLabel ? (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium truncate max-w-[120px]">
              {sectorLabel}
            </span>
          ) : (
            <span />
          )}
          <span
            className={clsx(
              'badge',
              STATUS_COLORS[listing.status] ?? 'bg-gray-100 text-gray-600'
            )}
          >
            {listing.status}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {listing.title}
        </h3>

        {/* Location */}
        {locationStr && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {locationStr}
          </p>
        )}

        {/* Verified seller badge */}
        {isVerified && (
          <p className="text-xs text-blue-600 font-medium mb-2">&#10003; Verified Seller</p>
        )}

        {/* Price and quantity */}
        <div className="flex items-end justify-between border-t border-gray-100 pt-3 mt-2">
          <div>
            <p className="text-xs text-gray-500">Price per {listing.unit}</p>
            <p className="flex items-center text-lg font-bold text-gray-900">
              <IndianRupee className="w-4 h-4" />
              {askingPrice.toLocaleString('en-IN')}
            </p>
            {mrp && mrp > askingPrice && (
              <span className="line-through text-gray-400 text-sm">
                ₹{(mrp as number).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Available</p>
            <p className="text-sm font-semibold text-accent-600">
              {(listing.quantity ?? listing.available_quantity ?? 0).toLocaleString('en-IN')}{' '}
              {listing.unit}
            </p>
          </div>
        </div>

        {/* Urgency chip */}
        {urgencyDays > 0 && (
          <div className="mt-3">
            <span className="bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded border border-amber-200 inline-block">
              &#9889; Must sell in {urgencyDays} days
            </span>
          </div>
        )}
      </div>
    </Link>
    </div>
  );
}
