'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import TopNav from '@/components/ui/TopNav';
import ListingCard from '@/components/ui/ListingCard';
import CompareDrawer from '@/components/CompareDrawer';
import { inventoryApi, type Listing } from '@/lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const SECTORS = [
  'Electronics', 'Textiles', 'FMCG', 'Auto Parts',
  'Home & Kitchen', 'Footwear', 'Toys', 'Cosmetics',
];

const GRADES = ['A', 'B', 'C', 'Scrap'];

const STOCK_TYPES = ['Dead', 'Excess', 'Surplus', 'Returns'];

const LOT_TYPES = ['Full', 'Partial'];

const SORT_TABS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'price_asc',  label: 'Price Low→High' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'ageing',     label: 'Ageing first' },
];

const PAGE_SIZE = 12;

// ── Checkbox component ───────────────────────────────────────────────────────

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className="flex items-center gap-2.5 cursor-pointer select-none"
      style={{ fontSize: 13.5, color: 'var(--nm-ink)', padding: '4px 0' }}
    >
      <span
        onClick={onChange}
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: checked ? 'none' : '1.5px solid var(--nm-line)',
          background: checked ? 'var(--nm-green)' : 'var(--nm-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
          cursor: 'pointer',
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sectors, setSectors] = useState<string[]>(
    searchParams.get('sector') ? [searchParams.get('sector')!] : []
  );
  const [grades, setGrades] = useState<string[]>([]);
  const [stockTypes, setStockTypes] = useState<string[]>([]);
  const [lotTypes, setLotTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');

  // ── Results state ─────────────────────────────────────────────────────────
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // ── Compare state ─────────────────────────────────────────────────────────
  const [compareList, setCompareList] = useState<string[]>([]);
  const [showCompareDrawer, setShowCompareDrawer] = useState(false);

  // ── Debounce search ───────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchListings = useCallback(
    async (opts: {
      searchVal: string;
      sectorsVal: string[];
      gradesVal: string[];
      stockVal: string[];
      lotVal: string[];
      sortVal: string;
      pageVal: number;
    }) => {
      setLoading(true);
      try {
        const params: Parameters<typeof inventoryApi.getListings>[0] & Record<string, unknown> = {
          page: opts.pageVal,
          limit: PAGE_SIZE,
          search: opts.searchVal || undefined,
          sector: opts.sectorsVal.length === 1 ? opts.sectorsVal[0] : opts.sectorsVal.length > 1 ? opts.sectorsVal.join(',') : undefined,
          sort_by: opts.sortVal || undefined,
          // ── Sprint-4 filters now wired ────────────────────────────────────
          condition_grade: opts.gradesVal.length > 0 ? opts.gradesVal.join(',') : undefined,
          stock_type:      opts.stockVal.length > 0 ? opts.stockVal.join(',').toLowerCase() : undefined,
          lot_type:        opts.lotVal.length > 0   ? opts.lotVal.join(',').toLowerCase()   : undefined,
          min_price:       minPrice ? Number(minPrice) : undefined,
          max_price:       maxPrice ? Number(maxPrice) : undefined,
        };

        const res = await inventoryApi.getListings(params as Parameters<typeof inventoryApi.getListings>[0]);
        const raw = (res.data as unknown as { data: { rows: Listing[]; total?: number } })?.data;
        const rows: Listing[] = Array.isArray(raw?.rows) ? raw.rows : (Array.isArray(res.data) ? res.data as unknown as Listing[] : []);
        const fetchedTotal = raw?.total ?? (res.data as unknown as { total?: number })?.total ?? 0;

        setListings(rows);
        setTotal(fetchedTotal);
        setTotalPages(Math.max(1, Math.ceil(fetchedTotal / PAGE_SIZE)));
      } catch {
        setListings([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial + reactive fetch
  useEffect(() => {
    fetchListings({ searchVal: search, sectorsVal: sectors, gradesVal: grades, stockVal: stockTypes, lotVal: lotTypes, sortVal: sortBy, pageVal: page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, grades, stockTypes, lotTypes, sortBy, page]);

  // Debounced search fetch
  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchListings({ searchVal: val, sectorsVal: sectors, gradesVal: grades, stockVal: stockTypes, lotVal: lotTypes, sortVal: sortBy, pageVal: 1 });
    }, 400);
  }

  // ── Filter toggles ────────────────────────────────────────────────────────
  function toggle<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
    setSectors([]);
    setGrades([]);
    setStockTypes([]);
    setLotTypes([]);
    setSortBy('newest');
    setPage(1);
    router.replace('/listings', { scroll: false });
    fetchListings({ searchVal: '', sectorsVal: [], gradesVal: [], stockVal: [], lotVal: [], sortVal: 'newest', pageVal: 1 });
  }

  // ── Pagination helpers ────────────────────────────────────────────────────
  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildPageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  }

  // ── Compare toggle ────────────────────────────────────────────────────────
  function handleCompareToggle(id: string) {
    setCompareList((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) { toast.error('Max 3 listings for comparison'); return prev; }
      return [...prev, id];
    });
  }

  const hasActiveFilters = !!(search || sectors.length || grades.length || stockTypes.length || lotTypes.length || minPrice || maxPrice);

  // Listings selected for compare (full objects from current page)
  const compareListings = listings.filter(l => compareList.includes(l.id));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--nm-paper)' }}>
      <TopNav />

      {/* ── Compare drawer ── */}
      {showCompareDrawer && compareListings.length > 0 && (
        <CompareDrawer
          listings={compareListings}
          onRemove={id => { setCompareList(p => p.filter(x => x !== id)); if (compareListings.length <= 1) setShowCompareDrawer(false); }}
          onClear={() => { setCompareList([]); setShowCompareDrawer(false); }}
        />
      )}

      <main style={{ flex: 1, maxWidth: 1400, margin: '0 auto', width: '100%', padding: '32px 28px' }}>

        {/* ── Header row ── */}
        <div className="flex items-center gap-4 flex-wrap mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="disp" style={{ fontSize: 26, fontWeight: 800, color: 'var(--nm-ink)', lineHeight: 1.1 }}>
              All deals
            </h1>
            {!loading && (
              <span style={{ fontSize: 13.5, color: 'var(--nm-muted)', marginTop: 2, display: 'block' }}>
                {total.toLocaleString('en-IN')} lots
              </span>
            )}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2" style={{ flex: '0 1 380px' }}>
            <div className="relative" style={{ flex: 1 }}>
              <Search
                size={16}
                strokeWidth={1.8}
                className="absolute"
                style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--nm-faint)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search lots, brands, SKUs…"
                className="nm-input"
                style={{ paddingLeft: 40, paddingRight: 36, borderRadius: 999 }}
              />
              {search && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute"
                  style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nm-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 2-col layout ── */}
        <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>

          {/* ── Filter sidebar ── */}
          <aside
            className="nm-card flex-shrink-0"
            style={{ width: 248, padding: 20, position: 'sticky', top: 24 }}
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <span className="disp" style={{ fontSize: 14, fontWeight: 700, color: 'var(--nm-ink)' }}>
                Filters
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nm-green)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Price / unit range */}
            <div style={{ marginBottom: 22 }}>
              <div className="label" style={{ marginBottom: 10 }}>Price / unit (₹)</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="nm-input"
                  style={{ fontSize: 13, padding: '9px 11px' }}
                  min="0"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="nm-input"
                  style={{ fontSize: 13, padding: '9px 11px' }}
                  min="0"
                />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--nm-line)', marginBottom: 18 }} />

            {/* Sector */}
            <div style={{ marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 10 }}>Sector</div>
              <div className="flex flex-col">
                {SECTORS.map((s) => (
                  <FilterCheckbox
                    key={s}
                    label={s}
                    checked={sectors.includes(s)}
                    onChange={() => toggle(sectors, s, setSectors)}
                  />
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--nm-line)', marginBottom: 18 }} />

            {/* Condition grade */}
            <div style={{ marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 10 }}>Condition grade</div>
              <div className="flex flex-col">
                {GRADES.map((g) => (
                  <FilterCheckbox
                    key={g}
                    label={`Grade ${g}`}
                    checked={grades.includes(g)}
                    onChange={() => toggle(grades, g, setGrades)}
                  />
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--nm-line)', marginBottom: 18 }} />

            {/* Stock type */}
            <div style={{ marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 10 }}>Stock type</div>
              <div className="flex flex-col">
                {STOCK_TYPES.map((t) => (
                  <FilterCheckbox
                    key={t}
                    label={t}
                    checked={stockTypes.includes(t)}
                    onChange={() => toggle(stockTypes, t, setStockTypes)}
                  />
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--nm-line)', marginBottom: 18 }} />

            {/* Lot type */}
            <div>
              <div className="label" style={{ marginBottom: 10 }}>Lot type</div>
              <div className="flex flex-col">
                {LOT_TYPES.map((t) => (
                  <FilterCheckbox
                    key={t}
                    label={t}
                    checked={lotTypes.includes(t)}
                    onChange={() => toggle(lotTypes, t, setLotTypes)}
                  />
                ))}
              </div>
            </div>
          </aside>

          {/* ── Results pane ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Sort tabs + Compare tab */}
            <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 20 }}>
              <div className="nm-tabbar">
                {SORT_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    className={`nm-tab${sortBy === tab.value ? ' active' : ''}`}
                    onClick={() => { setSortBy(tab.value); setPage(1); }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {compareList.length > 0 && (
                <button
                  className="nm-tab active"
                  style={{ background: 'var(--nm-gold)', borderColor: 'var(--nm-gold)', color: 'var(--nm-deep)' }}
                  onClick={() => setShowCompareDrawer(true)}
                >
                  Compare ({compareList.length})
                </button>
              )}
            </div>

            {/* Loading skeletons */}
            {loading ? (
              <div
                className="grid"
                style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}
              >
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="nm-card animate-pulse" style={{ overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '1/1', background: 'var(--nm-line)' }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ height: 11, background: 'var(--nm-line)', borderRadius: 6, width: '40%', marginBottom: 10 }} />
                      <div style={{ height: 15, background: 'var(--nm-line)', borderRadius: 6, marginBottom: 6 }} />
                      <div style={{ height: 13, background: 'var(--nm-line)', borderRadius: 6, width: '70%', marginBottom: 14 }} />
                      <div style={{ height: 24, background: 'var(--nm-line)', borderRadius: 6, width: '45%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              /* Empty state */
              <div
                className="nm-card flex flex-col items-center justify-center"
                style={{ padding: '80px 40px', textAlign: 'center' }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--nm-green-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}
                >
                  <Search size={28} style={{ color: 'var(--nm-green)' }} strokeWidth={1.6} />
                </div>
                <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: 'var(--nm-ink)', marginBottom: 8 }}>
                  No deals found matching your filters
                </p>
                <p style={{ fontSize: 14, color: 'var(--nm-muted)', marginBottom: 24 }}>
                  Try adjusting your search terms or clearing some filters.
                </p>
                {hasActiveFilters && (
                  <button className="nm-btn-secondary" onClick={clearFilters} style={{ fontSize: 13 }}>
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Listing grid — 3 cols */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}
                >
                  {listings.map((listing) => (
                    <div key={listing.id} style={{ position: 'relative' }}>
                      <ListingCard listing={listing} />
                      {/* Compare checkbox overlay */}
                      <label
                        className="flex items-center gap-1.5"
                        style={{
                          position: 'absolute',
                          bottom: 14,
                          left: 16,
                          zIndex: 5,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: compareList.includes(listing.id) ? 'var(--nm-green)' : 'var(--nm-muted)',
                          background: 'rgba(255,253,248,0.92)',
                          borderRadius: 999,
                          padding: '3px 8px 3px 5px',
                          border: '1px solid var(--nm-line)',
                          backdropFilter: 'blur(4px)',
                        }}
                        onClick={(e) => { e.preventDefault(); handleCompareToggle(listing.id); }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            border: compareList.includes(listing.id) ? 'none' : '1.5px solid var(--nm-line)',
                            background: compareList.includes(listing.id) ? 'var(--nm-green)' : 'var(--nm-card)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {compareList.includes(listing.id) && (
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path d="M1 3L3 5.5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        Compare
                      </label>
                    </div>
                  ))}
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5" style={{ marginTop: 40, flexWrap: 'wrap' }}>
                    {/* Prev */}
                    <button
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 1}
                      className="nm-tab"
                      style={{
                        padding: '8px 12px',
                        opacity: page === 1 ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>

                    {buildPageNumbers().map((p, i) =>
                      p === '…' ? (
                        <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--nm-faint)', fontSize: 14 }}>
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goToPage(p as number)}
                          className={`nm-tab${page === p ? ' active' : ''}`}
                          style={{ padding: '8px 13px', minWidth: 38 }}
                        >
                          {p}
                        </button>
                      )
                    )}

                    {/* Next */}
                    <button
                      onClick={() => goToPage(page + 1)}
                      disabled={page === totalPages}
                      className="nm-tab"
                      style={{
                        padding: '8px 12px',
                        opacity: page === totalPages ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
