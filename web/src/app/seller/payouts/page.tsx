'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Hourglass,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { SellerAppShell, Badge, Kpi, SectionCard, inr } from '@/components/ui';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Payout {
  id: string;
  order_id: string;
  order_number: string;
  listing_title: string;
  gross_amount: number;
  commission: number;
  gst_on_commission: number;
  tcs_amount: number;
  net_amount: number;
  status: string;
  scheduled_for: string | null;
  processed_at: string | null;
  created_at: string;
}

interface PayoutsResponse {
  payouts: Payout[];
  total: number;
  page: number;
  limit: number;
}

interface EscrowBucket {
  count: number;
  total: number;
}

interface EscrowStatus {
  held?: EscrowBucket;
  released?: EscrowBucket;
  disputed?: EscrowBucket;
  [key: string]: EscrowBucket | undefined;
}

const PAGE_SIZE = 20;

// Filter tabs → backend status values
const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'held', label: 'Held' },
];

// Backend payout status → Badge label (mapped to Badge color map)
const PAYOUT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Pending',     // amber
  processing: 'Holding',    // blue
  completed: 'Completed',   // green
  failed: 'Disputed',       // red
  held: 'Awaiting ship',    // orange-ish amber
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SellerPayoutsPage() {
  const [statusTab, setStatusTab] = useState('');
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const { data: payoutsData, isLoading: payoutsLoading, error: payoutsError } = useQuery({
    queryKey: ['seller-payouts', page],
    queryFn: () => api.get<PayoutsResponse>('/seller/payouts', { params: { page, limit: PAGE_SIZE } }),
    select: (res) => (res.data as unknown as { data: PayoutsResponse })?.data ?? (res.data as unknown as PayoutsResponse),
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  const { data: escrowData, isLoading: escrowLoading } = useQuery({
    queryKey: ['seller-escrow'],
    queryFn: () => api.get<EscrowStatus>('/seller/escrow-status'),
    select: (res) => (res.data as unknown as { data: EscrowStatus })?.data ?? (res.data as unknown as EscrowStatus),
    enabled: ready && isAuthenticated(),
    retry: 1,
  });

  useEffect(() => { if (payoutsError) toast.error('Failed to load payout data'); }, [payoutsError]);

  const payouts: Payout[] = payoutsData?.payouts ?? [];
  const total = payoutsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const escrow = escrowData ?? {};
  const held = escrow.held ?? { count: 0, total: 0 };
  const released = escrow.released ?? { count: 0, total: 0 };
  const disputed = escrow.disputed ?? { count: 0, total: 0 };

  // KPIs computed from the payout list + escrow status
  const kpis = useMemo(() => {
    let totalEarned = 0;
    let processingCount = 0;
    let scheduledCount = 0;
    for (const p of payouts) {
      if (p.status === 'completed') totalEarned += Number(p.net_amount ?? 0);
      if (p.status === 'processing') processingCount += 1;
      if (p.status === 'scheduled') scheduledCount += 1;
    }
    return { totalEarned, processingCount, scheduledCount };
  }, [payouts]);

  const filtered = statusTab ? payouts.filter((p) => p.status === statusTab) : payouts;

  return (
    <SellerAppShell
      title="Payouts"
      subtitle="Track your earnings and payout schedule"
    >
      {payoutsLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={30} className="animate-spin" style={{ color: 'var(--nm-green)' }} /></div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <Kpi label="Total earned" value={inr(kpis.totalEarned)} icon={TrendingUp} />
            <Kpi label="In escrow" value={inr(held.total)} sub={`${held.count} order${held.count === 1 ? '' : 's'} held`} icon={ShieldCheck} />
            <Kpi label="Processing" value={kpis.processingCount.toLocaleString('en-IN')} icon={Hourglass} />
            <Kpi label="Pending" value={kpis.scheduledCount.toLocaleString('en-IN')} icon={Clock} />
          </div>

          {/* Escrow summary card */}
          <SectionCard title="Escrow summary" className="mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--nm-gold-soft)' }}>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', color: 'var(--nm-gold-ink)' }}>
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0, fontWeight: 600 }}>Held in escrow</p>
                  <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-ink)', margin: '2px 0 0' }}>{inr(held.total)}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', margin: 0 }}>{held.count} order{held.count === 1 ? '' : 's'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--nm-green-soft)' }}>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', color: 'var(--nm-green)' }}>
                  <CheckCircle2 size={18} />
                </span>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0, fontWeight: 600 }}>Released</p>
                  <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-ink)', margin: '2px 0 0' }}>{inr(released.total)}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', margin: 0 }}>{released.count} order{released.count === 1 ? '' : 's'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3" style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--nm-red-soft)' }}>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', color: 'var(--nm-red)' }}>
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--nm-muted)', margin: 0, fontWeight: 600 }}>In dispute</p>
                  <p className="num disp" style={{ fontSize: 20, fontWeight: 800, color: 'var(--nm-ink)', margin: '2px 0 0' }}>{inr(disputed.total)}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--nm-faint)', margin: 0 }}>{disputed.count} order{disputed.count === 1 ? '' : 's'}</p>
                </div>
              </div>
            </div>
            {escrowLoading && (
              <div className="flex items-center gap-2 mt-3" style={{ fontSize: 12, color: 'var(--nm-faint)' }}>
                <Loader2 size={13} className="animate-spin" /> Refreshing escrow status…
              </div>
            )}
          </SectionCard>

          {/* Status filter tabs */}
          <div className="nm-tabbar mb-5">
            {STATUS_TABS.map((t) => (
              <button key={t.value} onClick={() => setStatusTab(t.value)} className={`nm-tab${statusTab === t.value ? ' active' : ''}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Payout history */}
          <SectionCard title="Payout history">
            {payouts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet size={42} style={{ color: 'var(--nm-faint)', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, color: 'var(--nm-muted)', fontWeight: 600, margin: '0 0 4px' }}>No payouts yet</p>
                <p style={{ fontSize: 12.5, color: 'var(--nm-faint)', margin: '0 0 16px' }}>Complete your first order to start earning.</p>
                <Link href="/listings" className="nm-btn-primary" style={{ display: 'inline-flex', fontSize: 13 }}>
                  Browse listings
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <p style={{ fontSize: 13, color: 'var(--nm-faint)' }}>No payouts match this filter.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="nm-table">
                  <thead><tr>
                    <th>Order</th>
                    <th>Listing</th>
                    <th style={{ textAlign: 'right' }}>Gross</th>
                    <th style={{ textAlign: 'right' }}>Commission</th>
                    <th style={{ textAlign: 'right' }}>TCS</th>
                    <th style={{ textAlign: 'right' }}>Net payout</th>
                    <th>Status</th>
                    <th>Scheduled for</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/orders/${p.order_id}`} style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 12.5, color: 'var(--nm-green)' }}>
                            {p.order_number ?? p.order_id.slice(0, 8).toUpperCase()}
                          </Link>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--nm-muted)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.listing_title}
                        </td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--nm-ink)' }}>{inr(p.gross_amount)}</td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--nm-red)' }}>−{inr(Number(p.commission ?? 0) + Number(p.gst_on_commission ?? 0))}</td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--nm-red)' }}>−{inr(p.tcs_amount)}</td>
                        <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--nm-green)' }}>{inr(p.net_amount)}</td>
                        <td><Badge status={PAYOUT_STATUS_LABEL[p.status] ?? p.status} /></td>
                        <td style={{ fontSize: 12.5, color: 'var(--nm-muted)', whiteSpace: 'nowrap' }}>{fmtDate(p.scheduled_for)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="nm-btn-secondary" style={{ padding: '6px 10px' }}>
                  <ChevronLeft size={15} />
                </button>
                <span className="num" style={{ fontSize: 13, color: 'var(--nm-muted)' }}>{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="nm-btn-secondary" style={{ padding: '6px 10px' }}>
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </SellerAppShell>
  );
}
