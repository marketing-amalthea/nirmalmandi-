'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Package,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SellerAppShell, Badge, Toggle, inr } from '@/components/ui';
import api, { inventoryApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SellerListing {
  id: string;
  title: string;
  asking_price: number;
  status: string;
  images: string[];
  view_count: number;
  watchlist_count: number;
  created_at: string;
}

interface ListingsResponse {
  data: SellerListing[];
  total: number;
}

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'sold', label: 'Sold' },
  { value: 'expired', label: 'Expired' },
  { value: 'flagged', label: 'Flagged' },
];

const SORT_OPTIONS = [
  { value: 'views_desc', label: 'Most views' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_desc', label: 'Price high-low' },
  { value: 'aging', label: 'Oldest' },
];

const STATUS_LABEL: Record<string, string> = {
  live: 'Live', paused: 'Paused', sold: 'Sold',
  expired: 'Expired', flagged: 'Flagged', delisted: 'Cancelled',
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="nm-card" style={{ padding: '14px 18px' }}>
      <p className="num disp" style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--nm-ink)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: '2px 0 0' }}>{label}</p>
    </div>
  );
}

export default function SellerListingsPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState('');
  const [sortBy, setSortBy] = useState('views_desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 300);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-listings', debouncedSearch, statusTab, sortBy, page],
    queryFn: () =>
      api.get<ListingsResponse>('/seller/listings', {
        params: {
          search: debouncedSearch || undefined,
          status: statusTab || undefined,
          sort: sortBy,
          page,
          limit: PAGE_SIZE,
        },
      }),
    select: (res) => (res.data as unknown as { data: ListingsResponse })?.data ?? res.data,
    enabled: isAuthenticated(),
    placeholderData: (prev) => prev,
  });

  const listings: SellerListing[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Stats computed from the loaded listings (current view)
  const liveCount = listings.filter((l) => l.status === 'live' || l.status === 'active').length;
  const pausedCount = listings.filter((l) => l.status === 'paused').length;
  const totalViews = listings.reduce((sum, l) => sum + (Number(l.view_count) || 0), 0);

  // Toggle pause/resume via inventoryApi.updateListing
  async function togglePause(l: SellerListing) {
    const paused = l.status === 'paused';
    setStatusLoading(l.id);
    try {
      await inventoryApi.updateListing(l.id, { status: paused ? 'live' : 'paused' });
      toast.success(paused ? 'Listing resumed' : 'Listing paused');
      qc.invalidateQueries({ queryKey: ['seller-listings'] });
    } catch {
      toast.error('Failed to update listing status');
    } finally {
      setStatusLoading(null);
    }
  }

  async function removeListing(l: SellerListing) {
    if (!confirm(`Delete "${l.title}"? This removes it from the marketplace.`)) return;
    setDeleteLoading(l.id);
    try {
      await inventoryApi.deleteListing(l.id);
      toast.success('Listing deleted');
      qc.invalidateQueries({ queryKey: ['seller-listings'] });
    } catch {
      toast.error('Failed to delete listing');
    } finally {
      setDeleteLoading(null);
    }
  }

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort';

  return (
    <SellerAppShell
      title="My Listings"
      subtitle={`${total.toLocaleString('en-IN')} total listings`}
      actions={
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nm-faint)' }} />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search listings…"
              className="nm-input"
              style={{ paddingLeft: 34, width: 220, borderRadius: 999, padding: '9px 14px 9px 34px', fontSize: 13.5 }}
            />
          </div>
          <Link href="/seller/listings/new" className="nm-btn-primary no-underline" style={{ fontSize: 13.5, padding: '9px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> New listing
          </Link>
        </div>
      }
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total listings" value={total.toLocaleString('en-IN')} />
        <StatCard label="Live" value={liveCount.toLocaleString('en-IN')} accent="var(--nm-green)" />
        <StatCard label="Paused" value={pausedCount.toLocaleString('en-IN')} accent="var(--nm-gold)" />
        <StatCard label="Views (this page)" value={totalViews.toLocaleString('en-IN')} />
      </div>

      {/* Status tabs + sort */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="nm-tabbar">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatusTab(t.value); setPage(1); }}
              className={`nm-tab${statusTab === t.value ? ' active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortOpen((o) => !o)}
            onBlur={() => setTimeout(() => setSortOpen(false), 150)}
            className="nm-btn-secondary"
            style={{ fontSize: 13, padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {currentSort} <ChevronDown size={15} />
          </button>
          {sortOpen && (
            <div
              className="nm-card"
              style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, width: 180, padding: 6 }}
            >
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onMouseDown={() => { setSortBy(o.value); setPage(1); setSortOpen(false); }}
                  className="w-full text-left"
                  style={{
                    padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: o.value === sortBy ? 700 : 500,
                    color: o.value === sortBy ? 'var(--nm-green)' : 'var(--nm-ink)',
                    background: o.value === sortBy ? 'var(--nm-green-soft)' : 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="nm-card" style={{ padding: '8px 12px 4px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <Package size={44} style={{ color: 'var(--nm-faint)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--nm-muted)', marginBottom: 4 }}>
              No {statusTab ? STATUS_LABEL[statusTab]?.toLowerCase() : ''} listings found
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--nm-faint)', marginBottom: 16 }}>
              {statusTab || debouncedSearch ? 'Try changing your filters.' : 'Add your first listing to get started.'}
            </p>
            <Link href="/seller/listings/new" className="nm-btn-primary no-underline" style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> New listing
            </Link>
          </div>
        ) : (
          <table className="nm-table">
            <thead><tr>
              <th>Listing</th>
              <th style={{ textAlign: 'right' }}>Asking</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Views</th>
              <th style={{ textAlign: 'right' }}>Watching</th>
              <th style={{ textAlign: 'right' }}>Age</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {listings.map((l) => {
                const age = daysSince(l.created_at);
                const ageOld = age >= 30;
                const isPaused = l.status === 'paused';
                const canToggle = l.status === 'live' || l.status === 'paused';
                return (
                  <tr key={l.id}>
                    {/* Thumbnail + title */}
                    <td>
                      <div className="flex items-center gap-3" style={{ maxWidth: 280 }}>
                        <div className="flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--nm-panel)' }}>
                          {l.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} style={{ color: 'var(--nm-faint)' }} />
                          )}
                        </div>
                        <span className="disp" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nm-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.title}
                        </span>
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-ink)' }}>{inr(Number(l.asking_price) || 0)}</td>
                    <td><Badge status={STATUS_LABEL[l.status] ?? l.status} /></td>
                    <td className="num" style={{ textAlign: 'right', color: 'var(--nm-muted)' }}>{(Number(l.view_count) || 0).toLocaleString('en-IN')}</td>
                    <td className="num" style={{ textAlign: 'right', color: 'var(--nm-muted)' }}>{(Number(l.watchlist_count) || 0).toLocaleString('en-IN')}</td>
                    <td className="num" style={{ textAlign: 'right', color: ageOld ? 'var(--nm-red)' : 'var(--nm-muted)', fontWeight: ageOld ? 700 : 500 }}>{age}d</td>
                    <td>
                      <div className="flex items-center justify-end gap-2.5">
                        <Link
                          href={`/seller/listings/${l.id}/edit`}
                          className="flex items-center gap-1 no-underline"
                          style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nm-muted)' }}
                        >
                          <Edit size={14} /> Edit
                        </Link>
                        {canToggle ? (
                          statusLoading === l.id ? (
                            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--nm-green)' }} />
                          ) : (
                            <Toggle on={!isPaused} onChange={() => togglePause(l)} />
                          )
                        ) : (
                          <span style={{ width: 40 }} />
                        )}
                        <button
                          onClick={() => removeListing(l)}
                          disabled={deleteLoading === l.id}
                          title="Delete listing"
                          className="flex items-center justify-center"
                          style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--nm-red)', cursor: 'pointer' }}
                        >
                          {deleteLoading === l.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="nm-btn-secondary" style={{ padding: '8px 12px' }}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const pageNum = start + i;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className="num flex items-center justify-center"
                style={{ width: 38, height: 38, borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: page === pageNum ? 'var(--nm-green)' : 'var(--nm-card)', color: page === pageNum ? '#fff' : 'var(--nm-ink)', border: `1px solid ${page === pageNum ? 'var(--nm-green)' : 'var(--nm-line)'}`, cursor: 'pointer' }}
              >
                {pageNum}
              </button>
            );
          })}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="nm-btn-secondary" style={{ padding: '8px 12px' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </SellerAppShell>
  );
}
