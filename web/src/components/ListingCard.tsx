import Link from 'next/link';
import { MapPin, Package, Tag, IndianRupee } from 'lucide-react';
import type { Listing } from '@/lib/api';
import clsx from 'clsx';

interface Props {
  listing: Listing;
}

const STATUS_COLORS: Record<string, string> = {
  live: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  sold: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  delisted: 'bg-red-100 text-red-700',
};

export default function ListingCard({ listing }: Props) {
  return (
    <Link href={`/listings/${listing.id}`} className="card block hover:shadow-md transition-shadow duration-150 group">
      {/* Image placeholder */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 h-40 rounded-t-xl flex items-center justify-center">
        <Package className="w-12 h-12 text-primary-300" />
      </div>

      <div className="p-4">
        {/* Sector badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="badge bg-primary-50 text-primary-700">
            <Tag className="w-3 h-3 mr-1" />
            {listing.sector ?? listing.sector_name ?? '—'}
          </span>
          <span className={clsx('badge', STATUS_COLORS[listing.status] ?? 'bg-gray-100 text-gray-600')}>
            {listing.status}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {listing.title}
        </h3>

        {/* Location */}
        <p className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[listing.seller_city ?? listing.city, listing.seller_state ?? listing.state].filter(Boolean).join(', ') || '—'}
        </p>

        {/* Price and quantity */}
        <div className="flex items-end justify-between border-t border-gray-100 pt-3">
          <div>
            <p className="text-xs text-gray-500">Price per {listing.unit}</p>
            <p className="flex items-center text-lg font-bold text-gray-900">
              <IndianRupee className="w-4 h-4" />
              {(listing.price_per_unit ?? listing.asking_price ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Available</p>
            <p className="text-sm font-semibold text-accent-600">
              {(listing.quantity ?? listing.available_quantity ?? 0).toLocaleString('en-IN')} {listing.unit}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
