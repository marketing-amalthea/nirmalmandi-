'use client';

import { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';
import { inventoryApi, type Sector, type Listing } from '@/lib/api';

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'quantity_desc', label: 'Quantity: High to Low' },
];

const PAGE_SIZE = 12;

export default function ListingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [sector, setSector] = useState(searchParams.get('sector') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') ?? '');
  const [sortBy, setSortBy] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Applied filters (used for query)
  const [applied, setApplied] = useState({
    search: searchParams.get('search') ?? '',
    sector: searchParams.get('sector') ?? '',
    minPrice: searchParams.get('min_price') ?? '',
    maxPrice: searchParams.get('max_price') ?? '',
    sortBy: '',
  });

  const { data: sectorsData } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => inventoryApi.getSectors(),
    // res.data = { success, data: [...sectors] }
    select: (res) => (res.data as unknown as { data: Sector[] })?.data ?? res.data,
  });
  const sectors: Sector[] = Array.isArray(sectorsData) ? sectorsData : [];

  const { data, isLoading } = useQuery({
    queryKey: ['listings', applied, page],
    queryFn: () =>
      inventoryApi.getListings({
        page,
        limit: PAGE_SIZE,
        search: applied.search || undefined,
        sector: applied.sector || undefined,
        min_price: applied.minPrice ? Number(applied.minPrice) : undefined,
        max_price: applied.maxPrice ? Number(applied.maxPrice) : undefined,
        sort_by: applied.sortBy || undefined,
      }),
    // res.data = { success, data: { rows: [...], total, page, limit } }
    select: (res) => (res.data as unknown as { data: { rows: unknown[]; total: number } })?.data ?? null,
  });

  const listings = ((data as { rows?: Listing[]; total?: number } | null)?.rows ?? []) as Listing[];
  const total = (data as { rows?: Listing[]; total?: number } | null)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyFilters = useCallback(() => {
    setApplied({ search, sector, minPrice, maxPrice, sortBy });
    setPage(1);
    setShowFilters(false);
    // Update URL
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    router.replace(`/listings${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  }, [search, sector, minPrice, maxPrice, sortBy, router]);

  function clearFilters() {
    setSearch('');
    setSector('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('');
    setApplied({ search: '', sector: '', minPrice: '', maxPrice: '', sortBy: '' });
    setPage(1);
    router.replace('/listings', { scroll: false });
  }

  const hasActiveFilters = applied.search || applied.sector || applied.minPrice || applied.maxPrice;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Browse Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total.toLocaleString('en-IN')} listings found` : 'Browse all available inventory'}
          </p>
        </div>

        {/* Search + filter row */}
        <div className="flex gap-3 mb-4">
          <form
            onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
            className="flex-1 relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings..."
              className="input-field pl-9 pr-4"
            />
          </form>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'ring-2 ring-primary-600' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <button onClick={applyFilters} className="btn-primary px-4">
            Search
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="input-field"
              >
                <option value="">All Sectors</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Price (₹)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                min="0"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Price (₹)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Any"
                min="0"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-field"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Active filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 font-medium">Active filters:</span>
            {applied.search && (
              <span className="badge bg-primary-50 text-primary-700 gap-1">
                Search: {applied.search}
              </span>
            )}
            {applied.sector && (
              <span className="badge bg-primary-50 text-primary-700">
                Sector: {applied.sector}
              </span>
            )}
            {(applied.minPrice || applied.maxPrice) && (
              <span className="badge bg-primary-50 text-primary-700">
                Price: ₹{applied.minPrice || '0'} – {applied.maxPrice ? '₹' + applied.maxPrice : 'Any'}
              </span>
            )}
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium ml-1"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-40 bg-gray-200 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No listings found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-4 btn-secondary text-sm">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary p-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pageNum = start + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary p-2 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
