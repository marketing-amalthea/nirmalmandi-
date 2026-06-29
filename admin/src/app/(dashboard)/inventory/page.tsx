'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Loader2, Search, Star, Pause, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import AdminShell from '@/components/ui/AdminShell';
import Badge from '@/components/ui/Badge';
import Kpi from '@/components/ui/Kpi';
import { inventoryApi } from '@/lib/api';

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function AgeCell({ days }: { days: number }) {
  const color = days > 30 ? 'var(--nm-red)' : days >= 15 ? 'var(--nm-gold-ink)' : 'var(--nm-green)';
  return <span className="num" style={{ fontSize: 13, fontWeight: 700, color }}>{days}d</span>;
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [status, setStatus] = useState('live');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [showPriceModal, setShowPriceModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-inventory', applied, status, page],
    queryFn: async () => {
      const p: Record<string, string | number> = { page, limit: 20 };
      if (applied) p.search = applied;
      if (status) p.status = status;
      const res = await inventoryApi.getListings(p);
      const d = (res.data as { data?: { rows?: unknown[]; total?: number } | unknown[] })?.data;
      if (Array.isArray(d)) return { rows: d, total: d.length };
      return { rows: (d as { rows?: unknown[] })?.rows ?? [], total: (d as { total?: number })?.total ?? 0 };
    },
  });

  const rows = (data?.rows ?? []) as Record<string, unknown>[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  async function bulkAction(action: string, payload?: Record<string, unknown>) {
    if (!selected.length) { toast.error('Select listings first'); return; }
    setBulkLoading(true);
    try {
      await inventoryApi.bulkAction(selected, action, payload);
      toast.success(`${action} applied to ${selected.length} listings`);
      setSelected([]); refetch();
    } catch { toast.error(`Failed to ${action}`); } finally { setBulkLoading(false); }
  }

  const toggleSelect = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === rows.length ? [] : rows.map(r => String(r.id)));

  const STATUSES = ['', 'live', 'paused', 'sold', 'expired', 'flagged'];
  const STATUS_LABELS: Record<string, string> = { '': 'All', live: 'Live', paused: 'Paused', sold: 'Sold', expired: 'Expired', flagged: 'Flagged' };

  return (
    <AdminShell title="Inventory" actions={
      <div className="flex items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setApplied(search); setPage(1); }} className="relative">
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nm-faint)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings…"
            className="nm-input" style={{ paddingLeft: 32, width: 220, borderRadius: 999, padding: '9px 14px 9px 32px', fontSize: 13 }} />
        </form>
      </div>
    }>
      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Kpi label="Total inventory value" value={inr(12_10_00_000)} icon={Package} />
        <Kpi label="Ageing 30+ days" value="486 lots" positive={false} icon={Package} />
        <Kpi label="Stuck capital" value={inr(1_84_00_000)} icon={Tag} />
      </div>

      {/* Status tabs + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="nm-tabbar">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); setSelected([]); }}
              className={`nm-tab${status === s ? ' active' : ''}`}>{STATUS_LABELS[s]}</button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>{selected.length} selected</span>
            <button onClick={() => bulkAction('feature')} disabled={bulkLoading}
              className="nm-btn-soft flex items-center gap-1.5" style={{ padding: '7px 12px', fontSize: 12 }}>
              {bulkLoading ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />} Feature
            </button>
            <button onClick={() => bulkAction('pause')} disabled={bulkLoading}
              className="nm-btn-secondary flex items-center gap-1.5" style={{ padding: '7px 12px', fontSize: 12 }}>
              <Pause size={11} /> Pause
            </button>
            <button onClick={() => setShowPriceModal(true)} disabled={bulkLoading}
              className="nm-btn-secondary flex items-center gap-1.5" style={{ padding: '7px 12px', fontSize: 12 }}>
              <Tag size={11} /> Price
            </button>
            <button onClick={() => bulkAction('delist')} disabled={bulkLoading}
              className="nm-btn-danger flex items-center gap-1.5" style={{ padding: '7px 12px', fontSize: 12 }}>
              <Trash2 size={11} /> Delist
            </button>
          </div>
        )}
      </div>

      <div className="nm-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--nm-muted)' }}>No listings found</p>
        ) : (
          <table className="nm-table">
            <thead><tr>
              <th><input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={toggleAll} /></th>
              <th>Listing</th><th>Seller</th><th style={{ textAlign: 'right' }}>Price</th>
              <th>Status</th><th style={{ textAlign: 'right' }}>Views</th><th>Age</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={String(r.id)}>
                  <td><input type="checkbox" checked={selected.includes(String(r.id))} onChange={() => toggleSelect(String(r.id))} /></td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--nm-panel)', flexShrink: 0 }} />
                      <span className="disp" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nm-ink)' }}>{String(r.title ?? '').slice(0, 45)}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>{String(r.seller_name ?? r.sellerName ?? '—')}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>₹{Number(r.asking_price ?? r.askingPrice ?? 0).toLocaleString('en-IN')}</td>
                  <td><Badge status={String(r.status ?? 'Live')} /></td>
                  <td className="num" style={{ textAlign: 'right', fontSize: 13 }}>{String(r.views_count ?? r.viewsCount ?? 0)}</td>
                  <td><AgeCell days={Number(r.days_listed ?? r.daysListed ?? 0)} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => inventoryApi.featureListing(String(r.id)).then(() => refetch()).catch(() => toast.error('Failed'))}
                        className="nm-btn-soft" style={{ padding: '4px 8px', fontSize: 11 }}>Feature</button>
                      <button onClick={() => {
                        const isPaused = String(r.status) === 'paused';
                        const action = isPaused
                          ? () => inventoryApi.bulkAction([String(r.id)], 'activate')
                          : () => inventoryApi.pauseListing(String(r.id));
                        action().then(() => refetch()).catch(() => toast.error('Failed'));
                      }}
                        className="nm-btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                        {String(r.status) === 'paused' ? 'Unpause' : 'Pause'}
                      </button>
                      <button onClick={() => { if (confirm('Delist this listing?')) inventoryApi.delistListing(String(r.id)).then(() => refetch()).catch(() => toast.error('Failed')); }}
                        className="nm-btn-secondary" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--nm-red)', borderColor: 'var(--nm-red)' }}>Delist</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="nm-btn-secondary" style={{ padding: '7px 12px', fontSize: 13 }}>‹</button>
          <span style={{ fontSize: 13, color: 'var(--nm-muted)' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="nm-btn-secondary" style={{ padding: '7px 12px', fontSize: 13 }}>›</button>
        </div>
      )}

      {/* Price modal */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(20,12,4,.45)' }}>
          <div className="nm-card" style={{ padding: 28, maxWidth: 360, width: '100%' }}>
            <h3 className="disp" style={{ fontSize: 18, fontWeight: 800, color: 'var(--nm-ink)', marginBottom: 16 }}>
              Change price for {selected.length} listing{selected.length !== 1 ? 's' : ''}
            </h3>
            <div className="mb-4">
              <label className="nm-label">New asking price (₹)</label>
              <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="nm-input" placeholder="e.g. 5000" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPriceModal(false)} className="nm-btn-secondary flex-1">Cancel</button>
              <button onClick={() => { bulkAction('change_price', { new_price: Number(newPrice) }); setShowPriceModal(false); }}
                disabled={!newPrice || bulkLoading} className="nm-btn-primary flex-1">Apply</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
