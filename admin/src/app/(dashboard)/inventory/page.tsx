'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { RefreshCw, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Listing extends Record<string, unknown> {
  id: string;
  title: string;
  sellerName: string;
  sector: string;
  askingPrice: number;
  status: string;
  viewsCount: number;
  daysListed: number;
  createdAt: string;
}

interface ListingsResponse {
  rows: Listing[];
  total: number;
  page: number;
  limit: number;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const queryParams: Record<string, string | number> = { page, limit: PAGE_SIZE };
  if (search) queryParams.search = search;
  if (statusFilter) queryParams.status = statusFilter;

  const { data, isLoading, refetch } = useQuery<ListingsResponse>({
    queryKey: ['inventory-listings', page, search, statusFilter],
    queryFn: async () => {
      const res = await inventoryApi.getListings(queryParams);
      return res.data?.data ?? { rows: [], total: 0 };
    },
    retry: 1,
  });

  const listings = data?.rows ?? [];
  const total = data?.total ?? 0;

  async function handleFeature(id: string) {
    setActionLoading(id);
    try {
      await inventoryApi.featureListing(id);
      toast.success('Listing featured');
      queryClient.invalidateQueries({ queryKey: ['inventory-listings'] });
    } catch {
      toast.error('Failed to feature listing');
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePause(id: string) {
    setActionLoading(id);
    try {
      await inventoryApi.pauseListing(id);
      toast.success('Listing paused');
      queryClient.invalidateQueries({ queryKey: ['inventory-listings'] });
    } catch {
      toast.error('Failed to pause listing');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelist(id: string) {
    if (!confirm('Delist this listing? This action is significant.')) return;
    setActionLoading(id);
    try {
      await inventoryApi.delistListing(id);
      toast.success('Listing delisted');
      queryClient.invalidateQueries({ queryKey: ['inventory-listings'] });
    } catch {
      toast.error('Failed to delist listing');
    } finally {
      setActionLoading(null);
    }
  }

  const columns: import('@/components/ui/DataTable').Column<Listing>[] = [
    {
      key: 'title',
      header: 'Listing',
      render: (l) => (
        <div>
          <div className="font-medium text-nm-text dark:text-nm-text-dark text-sm">{l.title}</div>
          <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
            {l.sellerName} · {l.sector}
          </div>
        </div>
      ),
    },
    {
      key: 'askingPrice',
      header: 'Price',
      sortable: true,
      render: (l) => (
        <span className="font-semibold text-nm-primary">
          ₹{l.askingPrice.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <StatusBadge status={l.status} />,
    },
    {
      key: 'viewsCount',
      header: 'Views',
      sortable: true,
    },
    {
      key: 'daysListed',
      header: 'Days Listed',
      sortable: true,
    },
    {
      key: 'actions',
      header: '',
      render: (l) => (
        <div className="flex gap-2 flex-wrap">
          {l.status !== 'featured' && l.status !== 'delisted' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleFeature(l.id); }}
              disabled={actionLoading === l.id}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 disabled:opacity-50 transition-colors"
            >
              Feature
            </button>
          )}
          {l.status !== 'paused' && l.status !== 'delisted' && (
            <button
              onClick={(e) => { e.stopPropagation(); handlePause(l.id); }}
              disabled={actionLoading === l.id}
              className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 disabled:opacity-50 transition-colors"
            >
              Pause
            </button>
          )}
          {l.status !== 'delisted' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelist(l.id); }}
              disabled={actionLoading === l.id}
              className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50 transition-colors"
            >
              Delist
            </button>
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
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Inventory</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Manage listings — feature, pause, or delist
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
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search listings or seller..."
          className="border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark placeholder:text-nm-text-muted"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="featured">Featured</option>
          <option value="paused">Paused</option>
          <option value="pending">Pending</option>
          <option value="delisted">Delisted</option>
        </select>
      </div>

      {/* Table */}
      {!isLoading && listings.length === 0 ? (
        <div className="nm-card p-16 text-center">
          <Package size={40} className="mx-auto text-nm-text-muted dark:text-nm-text-dark-muted mb-3" />
          <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
            {search || statusFilter ? 'No listings match your filters.' : 'No listings found.'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={listings}
          keyField="id"
          loading={isLoading}
          emptyMessage="No listings found."
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
