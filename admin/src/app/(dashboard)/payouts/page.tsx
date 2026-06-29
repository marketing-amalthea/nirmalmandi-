'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import AdminShell from '@/components/ui/AdminShell';
import Kpi from '@/components/ui/Kpi';
import Badge from '@/components/ui/Badge';
import { payoutsAdminApi } from '@/lib/api';

function inr(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const TABS = ['', 'pending', 'scheduled', 'on_hold', 'processed'];
const TAB_LABELS: Record<string, string> = { '': 'All', pending: 'Pending', scheduled: 'Scheduled', on_hold: 'On hold', processed: 'Processed' };

export default function PayoutsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: stats } = useQuery({
    queryKey: ['admin-payouts-stats'],
    queryFn: async () => {
      const res = await payoutsAdminApi.getStats();
      return (res.data as { data?: Record<string, unknown> })?.data ?? {};
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', tab, page],
    queryFn: async () => {
      const p: Record<string, string | number> = { page, limit: 20 };
      if (tab) p.status = tab;
      const res = await payoutsAdminApi.getPayouts(p);
      const d = (res.data as { data?: { rows?: unknown[]; total?: number } | unknown[] })?.data;
      if (Array.isArray(d)) return { rows: d, total: d.length };
      return { rows: (d as { rows?: unknown[] })?.rows ?? [], total: (d as { total?: number })?.total ?? 0 };
    },
  });

  const processMut = useMutation({
    mutationFn: (id: string) => payoutsAdminApi.process(id),
    onSuccess: () => { toast.success('Payout processed'); qc.invalidateQueries({ queryKey: ['admin-payouts'] }); },
    onError: () => toast.error('Failed to process'),
  });

  const bulkMut = useMutation({
    mutationFn: (ids: string[]) => payoutsAdminApi.bulkApprove(ids),
    onSuccess: () => { toast.success(`${selected.length} payouts approved`); setSelected([]); qc.invalidateQueries({ queryKey: ['admin-payouts'] }); },
    onError: () => toast.error('Bulk approve failed'),
  });

  const rows = (data?.rows ?? []) as Record<string, unknown>[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <AdminShell title="Payouts" actions={
      <div className="flex items-center gap-3">
        {selected.length > 0 && (
          <button onClick={() => bulkMut.mutate(selected)} disabled={bulkMut.isPending}
            className="nm-btn-primary flex items-center gap-2" style={{ fontSize: 13 }}>
            {bulkMut.isPending && <Loader2 size={14} className="animate-spin" />}
            Process all ready ({selected.length})
          </button>
        )}
        <button className="nm-btn-secondary flex items-center gap-2" style={{ fontSize: 13 }}>
          <Download size={14} /> Export
        </button>
      </div>
    }>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Kpi label="Total due" value={inr(Number((stats as Record<string,unknown>)?.totalDue ?? 0))} icon={Wallet} />
        <Kpi label="Total paid out" value={inr(Number((stats as Record<string,unknown>)?.totalPaid ?? 0))} icon={Wallet} positive />
        <Kpi label="On hold" value={inr(Number(((stats as Record<string,unknown>)?.byStatus as Record<string,{total?:number}>)?.held?.total ?? 0))} icon={Wallet} />
      </div>

      <div className="nm-tabbar mb-5">
        {TABS.map(s => (
          <button key={s} onClick={() => { setTab(s); setPage(1); setSelected([]); }}
            className={`nm-tab${tab === s ? ' active' : ''}`}>{TAB_LABELS[s]}</button>
        ))}
      </div>

      <div className="nm-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--nm-muted)' }}>No payouts found</p>
        ) : (
          <table className="nm-table">
            <thead><tr>
              <th><input type="checkbox" checked={selected.length === rows.length && rows.length > 0}
                onChange={() => setSelected(selected.length === rows.length ? [] : rows.map(r => String(r.id)))} /></th>
              <th>Seller</th><th style={{ textAlign: 'right' }}>Amount</th>
              <th>Account</th><th>Status</th><th>Date</th><th>Action</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={String(r.id)}>
                  <td><input type="checkbox" checked={selected.includes(String(r.id))}
                    onChange={() => setSelected(p => p.includes(String(r.id)) ? p.filter(x => x !== String(r.id)) : [...p, String(r.id)])} /></td>
                  <td className="disp" style={{ fontWeight: 700, fontSize: 13 }}>{String(r.seller_name ?? r.sellerName ?? '—')}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>{inr(Number(r.amount ?? 0))}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--nm-muted)', fontFamily: 'monospace' }}>
                    {r.bank_last4 ? `••${r.bank_last4}` : r.bankLast4 ? `••${r.bankLast4}` : '—'}
                  </td>
                  <td><Badge status={String(r.status ?? 'Pending')} /></td>
                  <td style={{ fontSize: 12.5, color: 'var(--nm-muted)' }}>{fmtDate(String(r.created_at ?? r.createdAt ?? ''))}</td>
                  <td>
                    {['pending','scheduled'].includes(String(r.status)) ? (
                      <button onClick={() => processMut.mutate(String(r.id))} disabled={processMut.isPending}
                        className="nm-btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}>Process</button>
                    ) : (
                      <span className="nm-pill" style={{ color: 'var(--nm-muted)', background: 'var(--nm-panel)', fontSize: 11 }}>On hold</span>
                    )}
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
