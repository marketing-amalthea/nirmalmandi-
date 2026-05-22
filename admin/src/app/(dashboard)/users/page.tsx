'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Column } from '@/components/ui/DataTable';

interface User extends Record<string, unknown> {
  id: string;
  phone: string;
  fullName: string;
  role: 'buyer' | 'seller';
  status: string;
  kycStatus: string;
  verificationTier: number;
  createdAt: string;
  totalOrders?: number;
  totalGmv?: number;
  gstin?: string;
  bankAccountVerified?: boolean;
}

interface UsersResponse {
  rows: User[];
  total: number;
  page: number;
  limit: number;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const queryParams: Record<string, string | number> = { page, limit: PAGE_SIZE };
  if (roleFilter) queryParams.role = roleFilter;
  if (kycFilter) queryParams.kycStatus = kycFilter;
  if (search) queryParams.search = search;

  const { data, isLoading, refetch } = useQuery<UsersResponse>({
    queryKey: ['users', page, roleFilter, kycFilter, search],
    queryFn: async () => {
      const res = await usersApi.getUsers(queryParams);
      return res.data?.data ?? { rows: [], total: 0 };
    },
    retry: 1,
  });

  const users = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pendingKycCount = users.filter((u) => u.kycStatus === 'pending').length;

  async function handleSuspend(userId: string, userName: string) {
    const reason = prompt(`Reason for suspending ${userName}:`);
    if (!reason) return;
    setActionLoading(userId);
    try {
      await usersApi.suspendUser(userId, reason);
      toast.success(`${userName} suspended`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      toast.error('Failed to suspend user');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBan(userId: string, userName: string) {
    const reason = prompt(`Reason for banning ${userName} (this is permanent):`);
    if (!reason) return;
    if (!confirm(`Are you sure you want to permanently ban ${userName}?`)) return;
    setActionLoading(userId);
    try {
      await usersApi.banUser(userId, reason);
      toast.success(`${userName} has been banned`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      toast.error('Failed to ban user');
    } finally {
      setActionLoading(null);
    }
  }

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      header: 'User',
      render: (u) => (
        <div>
          <div className="font-semibold text-sm text-nm-text dark:text-nm-text-dark">{u.fullName}</div>
          <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted font-mono">{u.phone}</div>
          {u.gstin && (
            <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">GSTIN: {u.gstin}</div>
          )}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            u.role === 'seller'
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
          }`}
        >
          {u.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'kycStatus',
      header: 'KYC',
      render: (u) => (
        <div>
          <StatusBadge status={u.kycStatus} />
          <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Tier {u.verificationTier ?? 0}
          </div>
          {u.bankAccountVerified !== undefined && (
            <div
              className={`text-xs ${u.bankAccountVerified ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}
            >
              {u.bankAccountVerified ? '✓ Bank verified' : '✗ Bank unverified'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'totalOrders',
      header: 'Activity',
      render: (u) => (
        <div className="text-sm text-nm-text dark:text-nm-text-dark">
          {u.totalOrders !== undefined && (
            <div>{u.totalOrders} orders</div>
          )}
          {u.totalGmv !== undefined && (
            <div className="text-nm-text-muted dark:text-nm-text-dark-muted text-xs">
              ₹{(u.totalGmv / 1000).toFixed(0)}K GMV
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
          {new Date(u.createdAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (u) => (
        <div className="flex gap-1.5 flex-wrap">
          {u.status !== 'suspended' && u.status !== 'banned' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSuspend(u.id, u.fullName); }}
              disabled={actionLoading === u.id}
              className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 disabled:opacity-50 transition-colors"
            >
              Suspend
            </button>
          )}
          {u.status !== 'banned' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleBan(u.id, u.fullName); }}
              disabled={actionLoading === u.id}
              className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50 transition-colors"
            >
              Ban
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
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark">Users</h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            Manage buyers and sellers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingKycCount > 0 && (
            <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-sm px-3 py-1 rounded-full font-semibold">
              {pendingKycCount} KYC pending
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name or phone..."
          className="border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg px-4 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark placeholder:text-nm-text-muted"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark"
        >
          <option value="">All Roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
        </select>
        <select
          value={kycFilter}
          onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
          className="border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark"
        >
          <option value="">All KYC</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {!isLoading && users.length === 0 ? (
        <div className="nm-card p-16 text-center">
          <Users size={40} className="mx-auto text-nm-text-muted dark:text-nm-text-dark-muted mb-3" />
          <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
            {search || roleFilter || kycFilter ? 'No users match your filters.' : 'No users found.'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          keyField="id"
          loading={isLoading}
          emptyMessage="No users found."
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
