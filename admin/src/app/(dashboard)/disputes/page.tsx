'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { disputesApi } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import { RefreshCw, Scale } from 'lucide-react';
import { toast } from 'sonner';

interface Dispute {
  id: string;
  orderNumber: string;
  reason: string;
  status: string;
  slaDeadline: string;
  buyerName: string;
  sellerName: string;
  totalAmount: number;
  description: string;
  createdAt: string;
  assignedTo?: string;
  evidence?: { fileUrl: string; fileName: string; uploadedBy: string }[];
}

interface DisputesResponse {
  rows: Dispute[];
  total: number;
}

function slaColor(deadline: string): string {
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0) return 'text-red-600 font-semibold';
  if (hrs < 12) return 'text-orange-500 font-semibold';
  return 'text-nm-text-muted dark:text-nm-text-dark-muted';
}

function formatSla(deadline: string): string {
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0) return `OVERDUE ${Math.abs(Math.round(hrs))}h`;
  return `${Math.round(hrs)}h remaining`;
}

export default function DisputesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [winningSide, setWinningSide] = useState<'seller' | 'buyer'>('seller');
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const { data, isLoading, refetch } = useQuery<DisputesResponse>({
    queryKey: ['disputes', statusFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await disputesApi.getDisputes(params);
      return res.data?.data ?? { rows: [], total: 0 };
    },
    retry: 1,
  });

  const disputes = data?.rows ?? [];
  const selected = disputes.find((d) => d.id === selectedId) ?? null;

  async function resolveDispute() {
    if (!selected || resolution.trim().length < 20) {
      toast.error('Resolution note must be at least 20 characters');
      return;
    }
    setResolving(true);
    try {
      await disputesApi.resolveDispute(selected.id, {
        resolution,
        notes,
        winningSide,
      });
      toast.success('Dispute resolved successfully');
      setSelectedId(null);
      setResolution('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    } catch {
      toast.error('Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Dispute Queue</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Review and resolve buyer–seller disputes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {disputes.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm px-3 py-1 rounded-full font-semibold">
              {disputes.length} open
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="nm-btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['open', 'in_review', 'resolved', ''] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setSelectedId(null); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              statusFilter === s
                ? 'bg-nm-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-text dark:hover:text-nm-text-dark'
            }`}
          >
            {s === '' ? 'All' : s === 'in_review' ? 'In Review' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Queue */}
        <div className="flex-1 space-y-3 min-w-0">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="nm-card p-4 animate-pulse h-20" />
              ))}
            </div>
          )}

          {!isLoading && disputes.length === 0 && (
            <div className="nm-card p-16 text-center">
              <Scale size={40} className="mx-auto text-nm-text-muted dark:text-nm-text-dark-muted mb-3" />
              <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
                No disputes found for this filter.
              </p>
            </div>
          )}

          {disputes.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
              className={`nm-card p-4 cursor-pointer hover:border-nm-primary transition-colors ${
                selectedId === d.id
                  ? 'border-nm-primary ring-1 ring-nm-primary'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-nm-text dark:text-nm-text-dark text-sm">{d.orderNumber}</div>
                  <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
                    {d.buyerName} vs {d.sellerName}
                  </div>
                  <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted capitalize mt-1">
                    {d.reason?.replace(/_/g, ' ')} · ₹{d.totalAmount?.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={d.status} />
                  {d.slaDeadline && (
                    <div className={`text-xs mt-1 ${slaColor(d.slaDeadline)}`}>
                      {formatSla(d.slaDeadline)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-96 shrink-0 nm-card p-6 space-y-4 self-start sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-nm-text dark:text-nm-text-dark text-base">Dispute Detail</h2>
              <button
                onClick={() => setSelectedId(null)}
                className="text-nm-text-muted dark:text-nm-text-dark-muted hover:text-nm-text dark:hover:text-nm-text-dark text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted space-y-1">
              <div><span className="font-medium">Order:</span> {selected.orderNumber}</div>
              <div><span className="font-medium">Buyer:</span> {selected.buyerName}</div>
              <div><span className="font-medium">Seller:</span> {selected.sellerName}</div>
              <div><span className="font-medium">Amount:</span> ₹{selected.totalAmount?.toLocaleString('en-IN')}</div>
            </div>

            {selected.description && (
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 text-sm text-nm-text dark:text-nm-text-dark">
                {selected.description}
              </div>
            )}

            {selected.evidence && selected.evidence.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-nm-text dark:text-nm-text-dark mb-2">
                  Evidence ({selected.evidence.length} files)
                </div>
                <div className="space-y-1.5">
                  {selected.evidence.map((e, i) => (
                    <a
                      key={i}
                      href={e.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-nm-primary hover:underline"
                    >
                      📎 {e.fileName}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selected.status !== 'resolved' && (
              <div className="border-t border-nm-border dark:border-nm-border-dark pt-4 space-y-3">
                <div className="text-xs font-semibold text-nm-text dark:text-nm-text-dark">Resolve Dispute</div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setWinningSide('seller')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                      winningSide === 'seller'
                        ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
                        : 'border-nm-border dark:border-nm-border-dark text-nm-text-muted dark:text-nm-text-dark-muted hover:border-gray-300'
                    }`}
                  >
                    Release to Seller
                  </button>
                  <button
                    onClick={() => setWinningSide('buyer')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                      winningSide === 'buyer'
                        ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                        : 'border-nm-border dark:border-nm-border-dark text-nm-text-muted dark:text-nm-text-dark-muted hover:border-gray-300'
                    }`}
                  >
                    Refund Buyer
                  </button>
                </div>

                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Resolution summary (min 20 chars)..."
                  rows={3}
                  className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg p-2.5 text-xs text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary resize-none"
                />

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes (optional)..."
                  rows={2}
                  className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg p-2.5 text-xs text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary resize-none"
                />

                <button
                  onClick={resolveDispute}
                  disabled={resolving || resolution.trim().length < 20}
                  className="w-full bg-nm-primary text-white rounded-lg py-2 text-sm font-semibold hover:bg-nm-primary/90 disabled:opacity-50 transition"
                >
                  {resolving ? 'Resolving...' : 'Submit Resolution'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
