'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { RefreshCw, ShoppingCart } from 'lucide-react';
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

interface OrdersResponse {
  rows: Order[];
  total: number;
  page: number;
  limit: number;
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const queryParams: Record<string, string | number> = { page, limit: PAGE_SIZE };
  if (statusFilter) queryParams.status = statusFilter;

  const { data, isLoading, refetch } = useQuery<OrdersResponse>({
    queryKey: ['orders', page, statusFilter],
    queryFn: async () => {
      const res = await transactionsApi.getOrders(queryParams);
      return res.data?.data ?? { rows: [], total: 0 };
    },
    retry: 1,
  });

  const orders = data?.rows ?? [];
  const total = data?.total ?? 0;

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (o) => (
        <div>
          <div className="font-mono text-sm font-semibold text-nm-primary">{o.orderNumber}</div>
          <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
            {new Date(o.createdAt).toLocaleDateString('en-IN')}
          </div>
        </div>
      ),
    },
    {
      key: 'listingTitle',
      header: 'Listing / Parties',
      render: (o) => (
        <div className="text-sm">
          <div className="font-medium text-nm-text dark:text-nm-text-dark">{o.listingTitle}</div>
          <div className="text-nm-text-muted dark:text-nm-text-dark-muted text-xs">
            {o.buyerName} → {o.sellerName}
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
            ₹{o.totalAmount.toLocaleString('en-IN')}
          </div>
          {o.commissionAmount > 0 && (
            <div className="text-xs text-green-600 dark:text-green-400">
              +₹{o.commissionAmount.toLocaleString('en-IN')} comm
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
      render: (o) => <StatusBadge status={o.escrowStatus || 'unknown'} />,
    },
    {
      key: 'actions',
      header: '',
      render: (o) => (
        <div className="flex gap-2 flex-wrap">
          {o.invoiceUrl && (
            <a
              href={o.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Invoice
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Transactions</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            All orders and escrow activity
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark"
        >
          <option value="">All Statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Paid</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="in_escrow">In Escrow</option>
          <option value="disputed">Disputed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Table */}
      {!isLoading && orders.length === 0 ? (
        <div className="nm-card p-16 text-center">
          <ShoppingCart size={40} className="mx-auto text-nm-text-muted dark:text-nm-text-dark-muted mb-3" />
          <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
            {statusFilter ? 'No orders match the selected status.' : 'No transactions found.'}
          </p>
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
