'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Lock, Unlock, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminShell from '@/components/ui/AdminShell';
import Badge from '@/components/ui/Badge';
import { transactionsApi } from '@/lib/api';

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const STATUSES = ['', 'pending_payment', 'paid', 'confirmed', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled'];
const STATUS_LABELS: Record<string, string> = { '': 'All', pending_payment: 'Pending', paid: 'Paid', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', completed: 'Completed', disputed: 'Disputed', cancelled: 'Cancelled' };

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions', applied, statusFilter, page],
    queryFn: async () => {
      const p: Record<string, string | number> = { page, limit: 20 };
      if (applied) p.search = applied;
      if (statusFilter) p.status = statusFilter;
      const res = await transactionsApi.getOrders(p);
      const d = (res.data as { data?: { rows?: unknown[]; total?: number } | unknown[] })?.data;
      if (Array.isArray(d)) return { rows: d as Record<string, unknown>[], total: d.length };
      return { rows: (d as { rows?: Record<string, unknown>[] })?.rows ?? [], total: (d as { total?: number })?.total ?? 0 };
    },
  });

  const freeze = useMutation({
    mutationFn: (id: string) => transactionsApi.freezeEscrow(id),
    onSuccess: () => { toast.success('Escrow frozen'); qc.invalidateQueries({ queryKey: ['admin-transactions'] }); },
    onError: () => toast.error('Failed to freeze escrow'),
  });

  const release = useMutation({
    mutationFn: (id: string) => transactionsApi.releaseEscrow(id),
    onSuccess: () => { toast.success('Escrow released'); qc.invalidateQueries({ queryKey: ['admin-transactions'] }); },
    onError: () => toast.error('Failed to release escrow'),
  });

  const rows: Record<string, unknown>[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <AdminShell title="Transactions" actions={
      <div className="flex items-center gap-3">
        <form onSubmit={e => { e.preventDefault(); setApplied(search); setPage(1); }} className="relative">
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nm-faint)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Order ID, buyer, seller…"
            className="nm-input" style={{ paddingLeft: 32, width: 240, borderRadius: 999, padding: '9px 14px 9px 32px', fontSize: 13 }} />
        </form>
        <button className="nm-btn-secondary flex items-center gap-2" style={{ fontSize: 13, padding: '9px 14px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>
    }>
      <div className="nm-tabbar mb-5 overflow-x-auto pb-1">
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`nm-tab${statusFilter === s ? ' active' : ''}`}>{STATUS_LABELS[s]}</button>
        ))}
      </div>
      <div className="nm-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--nm-muted)', fontSize: 14 }}>No transactions found</p>
        ) : (
          <table className="nm-table">
            <thead><tr>
              <th>Order</th><th>Buyer</th><th>Seller</th>
              <th style={{ textAlign: 'right' }}>Amount</th><th>Escrow</th><th>Status</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(o => (
                <tr key={String(o.id)}>
                  <td className="disp" style={{ fontWeight: 700, fontSize: 13 }}>{String(o.orderNumber ?? o.order_number ?? o.id)}</td>
                  <td style={{ fontSize: 13 }}>{String(o.buyerName ?? o.buyer_name ?? '—')}</td>
                  <td style={{ fontSize: 13 }}>{String(o.sellerName ?? o.seller_name ?? '—')}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>{inr(Number(o.totalAmount ?? o.total_amount ?? 0))}</td>
                  <td>
                    {['paid','confirmed','shipped','in_transit'].includes(String(o.status)) && (
                      <span className="nm-pill" style={{ color: 'var(--nm-info)', background: 'var(--nm-info-soft)', fontSize: 11 }}>Holding</span>
                    )}
                    {['delivered','completed'].includes(String(o.status)) && (
                      <span className="nm-pill" style={{ color: 'var(--nm-green)', background: 'var(--nm-green-soft)', fontSize: 11 }}>Released</span>
                    )}
                  </td>
                  <td><Badge status={String(o.status ?? 'Pending').replace(/_/g, ' ')} /></td>
                  <td style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>{fmtDate(String(o.createdAt ?? o.created_at ?? ''))}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => freeze.mutate(String(o.id))} disabled={freeze.isPending}
                        className="nm-btn-secondary flex items-center gap-1" style={{ padding: '5px 10px', fontSize: 11.5 }}>
                        <Lock size={11} /> Freeze
                      </button>
                      <button onClick={() => release.mutate(String(o.id))} disabled={release.isPending}
                        className="nm-btn-soft flex items-center gap-1" style={{ padding: '5px 10px', fontSize: 11.5 }}>
                        <Unlock size={11} /> Release
                      </button>
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
    </AdminShell>
  );
}
