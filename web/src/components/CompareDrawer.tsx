'use client';

import { X, ArrowRight, IndianRupee, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import type { Listing } from '@/lib/api';

interface CompareDrawerProps {
  listings: Listing[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const COMPARE_FIELDS: { label: string; key: keyof Listing; format?: (v: unknown) => string }[] = [
  { label: 'Asking Price', key: 'asking_price', format: (v) => `₹${Number(v).toLocaleString('en-IN')}` },
  { label: 'Condition Grade', key: 'condition_grade' },
  { label: 'Lot Type', key: 'lot_type' },
  { label: 'Quantity', key: 'available_quantity', format: (v) => Number(v).toLocaleString('en-IN') },
  { label: 'Unit', key: 'unit' },
  { label: 'MOQ', key: 'moq', format: (v) => Number(v).toLocaleString('en-IN') },
  { label: 'Sector', key: 'sector_name' },
  { label: 'Dead Stock Type', key: 'dead_stock_type' },
  { label: 'Seller City', key: 'seller_city' },
  { label: 'Seller State', key: 'seller_state' },
];

function best(field: keyof Listing, listings: Listing[]): string | null {
  if (field === 'asking_price') {
    const min = Math.min(...listings.map((l) => Number(l[field] ?? 0)));
    return String(min);
  }
  if (field === 'available_quantity') {
    const max = Math.max(...listings.map((l) => Number(l[field] ?? 0)));
    return String(max);
  }
  if (field === 'condition_grade') {
    const order = ['A', 'B', 'C', 'D'];
    const sorted = listings
      .map((l) => String(l[field] ?? 'D'))
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return sorted[0];
  }
  return null;
}

export default function CompareDrawer({ listings, onRemove, onClear }: CompareDrawerProps) {
  if (listings.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-nm-primary text-white">
        <span className="text-sm font-semibold">
          Compare {listings.length}/3 listings
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="text-xs text-white/80 hover:text-white underline"
          >
            Clear all
          </button>
          <button onClick={onClear}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compare table */}
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 w-36 text-xs font-semibold text-gray-500 uppercase">Field</th>
              {listings.map((l) => (
                <th key={l.id} className="px-4 py-3 min-w-[200px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 text-xs leading-tight line-clamp-2">{l.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{l.seller_business_name}</div>
                    </div>
                    <button
                      onClick={() => onRemove(l.id)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0 mt-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {COMPARE_FIELDS.map(({ label, key, format }) => {
              const bestVal = best(key, listings);
              return (
                <tr key={String(key)} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">{label}</td>
                  {listings.map((l) => {
                    const rawVal = l[key];
                    const display = rawVal != null
                      ? (format ? format(rawVal) : String(rawVal))
                      : <span className="text-gray-300">—</span>;
                    const isBest = bestVal !== null && String(rawVal) === bestVal;
                    return (
                      <td
                        key={l.id}
                        className={`px-4 py-2.5 text-sm font-medium ${isBest ? 'text-green-700 bg-green-50' : 'text-gray-800'}`}
                      >
                        {display}
                        {isBest && key === 'asking_price' && (
                          <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                            Lowest
                          </span>
                        )}
                        {isBest && key === 'available_quantity' && (
                          <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                            Most
                          </span>
                        )}
                        {isBest && key === 'condition_grade' && (
                          <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                            Best
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* CTA row */}
            <tr className="bg-gray-50">
              <td className="px-4 py-3 text-xs font-medium text-gray-500">Action</td>
              {listings.map((l) => (
                <td key={l.id} className="px-4 py-3">
                  <Link
                    href={`/listings/${l.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-nm-primary hover:bg-nm-primary-dark px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    View Deal
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
