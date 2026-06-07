'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X, Loader2, Bookmark, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';
import CompareDrawer from '@/components/CompareDrawer';
import { inventoryApi, type Sector, type Listing } from '@/lib/api';

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'quantity_desc', label: 'Quantity: High to Low' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'discount_desc', label: 'Highest Discount' },
];

const LISTING_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'best_offer', label: 'Best Offer' },
  { value: 'auction', label: 'Auction' },
  { value: 'flash_sale', label: 'Flash Sale' },
];

const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const PAGE_SIZE = 12;

interface SavedSearch {
  name: string;
  filters: {
    search: string;
    sector: string;
    minPrice: string;
    maxPrice: string;
    sortBy: string;
    selectedStates: string[];
    listingTypes: string[];
    verifiedOnly: boolean;
  };
}

function loadSavedSearches(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem('nm_saved_searches') || '[]');
  } catch {
    return [];
  }
}

function persistSavedSearches(searches: SavedSearch[]) {
  try {
    localStorage.setItem('nm_saved_searches', JSON.stringify(searches));
  } catch {
    // ignore
  }
}

export default function ListingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Filter state (draft — not yet applied) ───────────────────────────────────
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [sector, setSector] = useState(searchParams.get('sector') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') ?? '');
  const [sortBy, setSortBy] = useState('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [listingTypes, setListingTypes] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // ── Applied filters (used for actual fetch) ──────────────────────────────────
  const [applied, setApplied] = useState({
    search: searchParams.get('search') ?? '',
    sector: searchParams.get('sector') ?? '',
    minPrice: searchParams.get('min_price') ?? '',
    maxPrice: searchParams.get('max_price') ?? '',
    sortBy: '',
    selectedStates: [] as string[],
    listingTypes: [] as string[],
    verifiedOnly: false,
  });

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const savedDropdownRef = useRef<HTMLDivElement>(null);

  // ── Load-more listing state ──────────────────────────────────────────────────
  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Sectors ──────────────────────────────────────────────────────────────────
  const [sectors, setSectors] = useState<Sector[]>([]);

  // ── Close saved dropdown on outside click ────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (savedDropdownRef.current && !savedDropdownRef.current.contains(e.target as Node)) {
        setShowSavedDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Load sectors ──────────────────────────────────────────────────────────────
  useEffect(() => {
    inventoryApi
      .getSectors()
      .then((res) => {
        const raw = (res.data as unknown as { data: Sector[] })?.data ?? res.data;
        if (Array.isArray(raw)) setSectors(raw);
      })
      .catch(() => {});
  }, []);

  // ── Load saved searches from localStorage ────────────────────────────────────
  useEffect(() => {
    setSavedSearches(loadSavedSearches());
  }, []);

  // ── Fetch listings ────────────────────────────────────────────────────────────
  const fetchListings = useCallback(
    async (pageNum: number, filters: typeof applied, append: boolean) => {
      if (!append) setInitialLoading(true);
      else setLoadingMore(true);

      try {
        const params: Parameters<typeof inventoryApi.getListings>[0] & Record<string, unknown> = {
          page: pageNum,
          limit: PAGE_SIZE,
          search: filters.search || undefined,
          sector: filters.sector || undefined,
          min_price: filters.minPrice ? Number(filters.minPrice) : undefined,
          max_price: filters.maxPrice ? Number(filters.maxPrice) : undefined,
          sort_by: filters.sortBy || undefined,
        };
        if (filters.selectedStates.length > 0) {
          params.state = filters.selectedStates.join(',');
        }
        if (filters.listingTypes.length > 0) {
          params.price_type = filters.listingTypes.join(',');
        }
        if (filters.verifiedOnly) {
          params.verified_only = true;
        }

        const res = await inventoryApi.getListings(params as Parameters<typeof inventoryApi.getListings>[0]);
        const raw = (res.data as unknown as { data: { rows: Listing[]; total?: number } })?.data;
        const rows: Listing[] = raw?.rows ?? [];
        const fetchedTotal = raw?.total ?? 0;

        if (append) {
          setListings((prev) => [...prev, ...rows]);
        } else {
          setListings(rows);
        }
        setTotal(fetchedTotal);
        setHasMore(rows.length >= PAGE_SIZE);
      } catch {
        if (!append) setListings([]);
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchListings(1, applied, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply filters ─────────────────────────────────────────────────────────────
  const applyFilters = useCallback(() => {
    const next = { search, sector, minPrice, maxPrice, sortBy, selectedStates, listingTypes, verifiedOnly };
    setApplied(next);
    setPage(1);
    setListings([]);
    setHasMore(true);
    setShowFilters(false);

    // Update URL
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    router.replace(`/listings${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });

    fetchListings(1, next, false);
  }, [search, sector, minPrice, maxPrice, sortBy, selectedStates, listingTypes, verifiedOnly, router, fetchListings]);

  // ── Clear all filters ─────────────────────────────────────────────────────────
  function clearFilters() {
    const empty = {
      search: '', sector: '', minPrice: '', maxPrice: '', sortBy: '',
      selectedStates: [], listingTypes: [], verifiedOnly: false,
    };
    setSearch(''); setSector(''); setMinPrice(''); setMaxPrice('');
    setSortBy(''); setSelectedStates([]); setListingTypes([]); setVerifiedOnly(false);
    setApplied(empty);
    setPage(1);
    setListings([]);
    setHasMore(true);
    router.replace('/listings', { scroll: false });
    fetchListings(1, empty, false);
  }

  // ── Load more ─────────────────────────────────────────────────────────────────
  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings(nextPage, applied, true);
  }

  // ── State filter toggle ───────────────────────────────────────────────────────
  function toggleState(s: string) {
    setSelectedStates((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // ── Listing type toggle ───────────────────────────────────────────────────────
  function toggleListingType(t: string) {
    setListingTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  // ── Save search ───────────────────────────────────────────────────────────────
  function handleSaveSearch() {
    const name = window.prompt('Name this search:');
    if (!name || !name.trim()) return;
    const current: SavedSearch = {
      name: name.trim(),
      filters: { search, sector, minPrice, maxPrice, sortBy, selectedStates, listingTypes, verifiedOnly },
    };
    const existing = loadSavedSearches();
    const updated = [current, ...existing.filter((s) => s.name !== current.name)].slice(0, 5);
    persistSavedSearches(updated);
    setSavedSearches(updated);
  }

  // ── Restore saved search ──────────────────────────────────────────────────────
  function restoreSavedSearch(saved: SavedSearch) {
    const f = saved.filters;
    setSearch(f.search);
    setSector(f.sector);
    setMinPrice(f.minPrice);
    setMaxPrice(f.maxPrice);
    setSortBy(f.sortBy);
    setSelectedStates(f.selectedStates);
    setListingTypes(f.listingTypes);
    setVerifiedOnly(f.verifiedOnly);
    setShowSavedDropdown(false);

    const next = { ...f };
    setApplied(next);
    setPage(1);
    setListings([]);
    setHasMore(true);
    fetchListings(1, next, false);
  }

  // ── Delete saved search ───────────────────────────────────────────────────────
  function deleteSavedSearch(name: string) {
    const updated = savedSearches.filter((s) => s.name !== name);
    persistSavedSearches(updated);
    setSavedSearches(updated);
  }

  // ── Compare state ─────────────────────────────────────────────────────────────
  const [compareList, setCompareList] = useState<Listing[]>([]);

  function handleCompareToggle(listing: Listing) {
    setCompareList((prev) => {
      const exists = prev.find((l) => l.id === listing.id);
      if (exists) return prev.filter((l) => l.id !== listing.id);
      if (prev.length >= 3) { toast.error('Max 3 listings can be compared at once'); return prev; }
      return [...prev, listing];
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const hasActiveFilters = !!(
    applied.search || applied.sector || applied.minPrice || applied.maxPrice ||
    applied.selectedStates.length > 0 || applied.listingTypes.length > 0 || applied.verifiedOnly
  );

  const hasAnyDraftFilter = !!(
    search || sector || minPrice || maxPrice ||
    selectedStates.length > 0 || listingTypes.length > 0 || verifiedOnly
  );

  const startCount = listings.length > 0 ? 1 : 0;
  const endCount = listings.length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Browse Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0
              ? `Showing ${startCount}–${endCount} of ${total.toLocaleString('en-IN')} listings`
              : 'Browse all available inventory'}
          </p>
        </div>

        {/* Search + filter row */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <form
            onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
            className="flex-1 min-w-[200px] relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings..."
              className="input-field pl-9 pr-12"
            />
            {/* Voice search mic */}
            <button
              type="button"
              title="Voice search"
              onClick={() => {
                if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                  toast.error('Voice search not supported in this browser');
                  return;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as (new () => any) | undefined;
                if (!SR) return;
                const recognition = new SR();
                recognition.lang = 'hi-IN';
                recognition.interimResults = false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recognition.onresult = (e: any) => {
                  const transcript = e.results[0][0].transcript;
                  setSearch(transcript);
                  applyFilters();
                };
                recognition.start();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-primary-600 transition-colors"
            >
              🎙️
            </button>
          </form>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'ring-2 ring-primary-600' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary-600 inline-block" />
            )}
          </button>
          <button onClick={applyFilters} className="btn-primary px-4">
            Search
          </button>

          {/* Save search button */}
          {hasAnyDraftFilter && (
            <button
              onClick={handleSaveSearch}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              title="Save this search"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">Save Search</span>
            </button>
          )}

          {/* Saved searches dropdown */}
          {savedSearches.length > 0 && (
            <div className="relative" ref={savedDropdownRef}>
              <button
                onClick={() => setShowSavedDropdown((v) => !v)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <Bookmark className="w-4 h-4 text-primary-600" />
                <span className="hidden sm:inline">Saved</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSavedDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
                  {savedSearches.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 group">
                      <button
                        onClick={() => restoreSavedSearch(s)}
                        className="flex-1 text-left text-sm text-gray-700 truncate"
                      >
                        {s.name}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.name); }}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                        title="Delete"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card p-4 mb-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Sector */}
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

              {/* Min Price */}
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

              {/* Max Price */}
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

              {/* Sort By */}
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

            {/* State filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">State</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {INDIA_STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleState(s)}
                    className={[
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      selectedStates.includes(s)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-700',
                    ].join(' ')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Listing type + Verified only row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Listing type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Listing Type</label>
                <div className="flex flex-wrap gap-2">
                  {LISTING_TYPES.map((t) => (
                    <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={listingTypes.includes(t.value)}
                        onChange={() => toggleListingType(t.value)}
                        className="rounded text-primary-600 focus:ring-primary-600 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-700">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Verified only */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setVerifiedOnly((v) => !v)}
                    className={[
                      'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                      verifiedOnly ? 'bg-primary-600' : 'bg-gray-300',
                    ].join(' ')}
                    role="switch"
                    aria-checked={verifiedOnly}
                  >
                    <span
                      className={[
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
                        verifiedOnly ? 'translate-x-4' : 'translate-x-0',
                      ].join(' ')}
                    />
                  </div>
                  <span className="text-sm text-gray-700">Verified Sellers Only</span>
                </label>
              </div>
            </div>

            {/* Filter action buttons */}
            <div className="flex gap-3 pt-1 border-t border-gray-100">
              <button onClick={applyFilters} className="btn-primary px-6">
                Apply Filters
              </button>
              <button onClick={clearFilters} className="btn-secondary px-4 text-sm">
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 font-medium">Active filters:</span>

            {applied.search && (
              <span className="badge bg-primary-50 text-primary-700 gap-1">
                Search: {applied.search}
                <button
                  onClick={() => { setSearch(''); setApplied((a) => ({ ...a, search: '' })); }}
                  className="ml-1 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {applied.sector && (
              <span className="badge bg-primary-50 text-primary-700 gap-1">
                Sector: {applied.sector}
                <button
                  onClick={() => { setSector(''); setApplied((a) => ({ ...a, sector: '' })); }}
                  className="ml-1 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(applied.minPrice || applied.maxPrice) && (
              <span className="badge bg-primary-50 text-primary-700 gap-1">
                Price: ₹{applied.minPrice || '0'} – {applied.maxPrice ? '₹' + applied.maxPrice : 'Any'}
                <button
                  onClick={() => { setMinPrice(''); setMaxPrice(''); setApplied((a) => ({ ...a, minPrice: '', maxPrice: '' })); }}
                  className="ml-1 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {applied.selectedStates.map((s) => (
              <span key={s} className="badge bg-primary-50 text-primary-700 gap-1">
                {s}
                <button
                  onClick={() => {
                    const next = applied.selectedStates.filter((x) => x !== s);
                    setSelectedStates(next);
                    setApplied((a) => ({ ...a, selectedStates: next }));
                  }}
                  className="ml-1 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {applied.listingTypes.map((t) => {
              const label = LISTING_TYPES.find((x) => x.value === t)?.label ?? t;
              return (
                <span key={t} className="badge bg-primary-50 text-primary-700 gap-1">
                  {label}
                  <button
                    onClick={() => {
                      const next = applied.listingTypes.filter((x) => x !== t);
                      setListingTypes(next);
                      setApplied((a) => ({ ...a, listingTypes: next }));
                    }}
                    className="ml-1 hover:text-primary-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {applied.verifiedOnly && (
              <span className="badge bg-primary-50 text-primary-700 gap-1">
                Verified Only
                <button
                  onClick={() => { setVerifiedOnly(false); setApplied((a) => ({ ...a, verifiedOnly: false })); }}
                  className="ml-1 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium ml-1"
            >
              <X className="w-3 h-3" /> Clear All
            </button>
          </div>
        )}

        {/* Grid */}
        {initialLoading ? (
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  compareSelected={compareList.some((l) => l.id === listing.id)}
                  onCompareToggle={handleCompareToggle}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 border-2 border-primary-600 text-primary-600 hover:bg-primary-50 font-semibold px-8 py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Load More Deals'
                  )}
                </button>
              </div>
            )}

            {!hasMore && listings.length > 0 && (
              <p className="text-center text-sm text-gray-400 mt-6">
                All {total.toLocaleString('en-IN')} listings shown.
              </p>
            )}
          </>
        )}
      </main>

      <CompareDrawer
        listings={compareList}
        onRemove={(id) => setCompareList((prev) => prev.filter((l) => l.id !== id))}
        onClear={() => setCompareList([])}
      />
    </div>
  );
}
