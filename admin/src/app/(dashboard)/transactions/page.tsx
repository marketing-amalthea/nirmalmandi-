'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { RefreshCw, ShoppingCart, Search, Lock, Unlock, X, ChevronDown } from 'lucide-react';
import type { Column } from '@/components/ui/DataTable';

interface Order extends Record<string, unknown> {
  id: string;
  orderNumber: string;
  buyerName: string;
  sellerName: string;
  listingTitle: string;
  totalAmount: number;
  commissionAmount: number;
  status: string;
  escrowStatus: string;
  paymentId: string | null;
  createdAt: string;
  invoiceUrl: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'refunded', label: 'Refunded' },
];

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Action feedback
  const [actionMsg, setActionMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  const queryParams: Record<string, string | number> = { page, limit: PAGE_SIZE };
  if (statusFilter) queryParams.status = statusFilter;
  if (appliedSearch) queryParams.search = appliedSearch;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', page, statusFilter, appliedSearch],
    queryFn: async () => {
      const res = await transactionsApi.getOrders(queryParams);
      return (res.data?.data ?? { rows: [], total: 0 }) as { rows: Order[]; total: number };
    },
    retry: 1,
  });

  const orders = data?.rows ?? [];
  const total = data?.total ?? 0;

  const freezeMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.freezeEscrow(id),
    onSuccess: (_, id) => {
      setActionMsg({ id, type: 'success', text: 'Escrow frozen — order marked disputed' });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      setTimeout(() => setActionMsg(null), 4000);
    },
    onError: (_, id) => {
      setActionMsg({ id, type: 'error', text: 'Failed to freeze escrow' });
      setTimeout(() => setActionMsg(null), 4000);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.releaseEscrow(id),
    onSuccess: (_, id) => {
      setActionMsg({ id, type: 'success', text: 'Escrow released — order completed' });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      setTimeout(() => setActionMsg(null), 4000);
    },
    onError: (_, id) => {
      setActionMsg({ id, type: 'error', text: 'Failed to release escrow' });
      setTimeout(() => setActionMsg(null), 4000);
    },
  });

  const applySearch = useCallback(() => {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const clearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  };

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (o) => (
        <div>
          <div className="font-mono text-sm font-semibold text-nm-primary">{o.orderNumber || '—'}</div>
          <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'listingTitle',
      header: 'Listing / Parties',
      render: (o) => (
        <div className="text-sm max-w-xs">
          <div className="font-medium text-nm-text dark:text-nm-text-dark truncate">{o.listingTitle || '—'}</div>
          <div className="text-nm-text-muted dark:text-nm-text-dark-muted text-xs truncate">
            {o.buyerName} <span className="mx-1 opacity-50">→</span> {o.sellerName}
          </div>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      sortable: true,
      render: (o) => (
        <div>
          <div className="font-semibold text-nm-text dark:text-nm-text-dark">
            ₹{(o.totalAmount ?? 0).toLocaleString('en-IN')}
          </div>
          {o.commissionAmount > 0 && (
            <div className="text-xs text-green-600 dark:text-green-400">
              +₹{(o.commissionAmount).toLocaleString('en-IN')} comm
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Order Status',
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: 'escrowStatus',
      header: 'Escrow',
      render: (o) => (
        <div>
          {o.escrowStatus ? (
            <StatusBadge status={o.escrowStatus} />
          ) : (
            <span className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (o) => {
        const isWorking =
          (freezeMutation.isPending && freezeMutation.variables === o.id) ||
          (releaseMutation.isPending && releaseMutation.variables === o.id);

        return (
          <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {o.invoiceUrl && (
              <a
                href={o.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors whitespace-nowrap"
              >
                Invoice
              </a>
            )}
            {/* Freeze — only meaningful on paid/shipped/delivered orders */}
            {['paid', 'shipped', 'delivered'].includes(o.status) && (
              <button
                disabled={isWorking}
                onClick={() => {
                  if (confirm(`Freeze escrow for order ${o.orderNumber}? This marks it as disputed.`)) {
                    freezeMutation.mutate(o.id);
                  }
                }}
                className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 transition-colors flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
              >
                <Lock size={10} />
                Freeze
              </button>
            )}
            {/* Release — only meaningful on disputed/holding escrow */}
            {(o.status === 'disputed' || o.escrowStatus === 'holding') && (
              <button
                disabled={isWorking}
                onClick={() => {
                  if (confirm(`Release escrow for order ${o.orderNumber}? Funds will be sent to seller.`)) {
                    releaseMutation.mutate(o.id);
                  }
                }}
                className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
              >
                <Unlock size={10} />
                Release
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Transactions</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            {total > 0 ? `${total.toLocaleString('en-IN')} orders` : 'All orders and escrow activity'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="nm-btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Feedback toast */}
      {actionMsg && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
          actionMsg.type === 'success'
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); applySearch(); }}
          className="flex gap-2 flex-1 min-w-[200px]"
        >
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nm-text-muted dark:text-nm-text-dark-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search order #, buyer, seller, listing…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark placeholder:text-nm-text-muted dark:placeholder:text-nm-text-dark-muted"
            />
          </div>
          <button type="submit" className="nm-btn-primary text-sm px-4">Search</button>
          {appliedSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="nm-btn-secondary text-sm px-3 flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          )}
        </form>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg pl-4 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nm-text-muted dark:text-nm-text-dark-muted pointer-events-none" />
        </div>
      </div>

      {/* Summary chips */}
      {(appliedSearch || statusFilter) && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-nm-text-muted dark:text-nm-text-dark-muted">Active filters:</span>
          {appliedSearch && (
            <span className="bg-nm-primary/10 text-nm-primary px-2.5 py-0.5 rounded-full font-medium">
              Search: &ldquo;{appliedSearch}&rdquo;
            </span>
          )}
          {statusFilter && (
            <span className="bg-nm-primary/10 text-nm-primary px-2.5 py-0.5 rounded-full font-medium">
              Status: {statusFilter}
            </span>
          )}
          <button
            onClick={() => { clearSearch(); setStatusFilter(''); }}
            className="text-red-500 hover:text-red-700 font-medium ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && orders.length === 0 ? (
        <div className="nm-card p-16 text-center">
          <ShoppingCart size={40} className="mx-auto text-nm-text-muted dark:text-nm-text-dark-muted mb-3" />
          <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm font-medium">
            {statusFilter || appliedSearch ? 'No orders match your filters.' : 'No transactions yet.'}
          </p>
          {(statusFilter || appliedSearch) && (
            <button
              onClick={() => { clearSearch(); setStatusFilter(''); }}
              className="mt-3 nm-btn-secondary text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          keyField="id"
          loading={isLoading}
          emptyMessage="No transactions found."
          pagination={
            total > PAGE_SIZE
              ? { page, pageSize: PAGE_SIZE, total, onPageChange: setPage }
              : undefined
          }
        />
      )}
    </div>
  );
}
