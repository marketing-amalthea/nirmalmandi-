'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAdminApi } from '@/lib/api';
import {
  Bell, Send, RefreshCw, Search, X, CheckCircle2, AlertCircle,
  Megaphone, MessageSquare, ChevronDown, Loader2,
} from 'lucide-react';

interface NotificationLog extends Record<string, unknown> {
  id: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  isRead: boolean;
  sentAt: string;
  userId: string;
  userName: string;
  userPhone: string;
}

interface LogsResponse {
  rows: NotificationLog[];
  total: number;
}

const CHANNEL_OPTIONS = [
  { value: '', label: 'All Channels' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'push', label: 'Push' },
  { value: 'sms', label: 'SMS' },
];

const TARGET_OPTIONS = [
  { value: '', label: 'All Users' },
  { value: 'buyer', label: 'Buyers Only' },
  { value: 'seller', label: 'Sellers Only' },
];

const PAGE_SIZE = 30;

function BroadcastPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    message: '',
    channel: 'push',
    targetRole: '',
  });
  const [sent, setSent] = useState<{ queued: number; targetRole: string } | null>(null);
  const [error, setError] = useState('');

  const broadcastMutation = useMutation({
    mutationFn: () => notificationsAdminApi.broadcast(form),
    onSuccess: (res) => {
      const d = res.data?.data as { queued: number; targetRole: string };
      setSent(d);
      qc.invalidateQueries({ queryKey: ['notification-logs'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to send broadcast');
    },
  });

  if (sent) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
        <p className="font-semibold text-nm-text dark:text-nm-text-dark">Broadcast queued!</p>
        <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-1">
          {sent.queued} notification{sent.queued !== 1 ? 's' : ''} queued for{' '}
          {sent.targetRole === 'all' ? 'all users' : sent.targetRole + 's'}
        </p>
        <button onClick={onClose} className="mt-4 nm-btn-secondary text-sm">Done</button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setError(''); broadcastMutation.mutate(); }}
      className="space-y-4"
    >
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">
          Notification Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          maxLength={100}
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="e.g. Weekend Flash Sale Alert"
          className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          maxLength={500}
          rows={4}
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          placeholder="Enter your broadcast message…"
          className="w-full border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary resize-none"
        />
        <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted mt-1 text-right">
          {form.message.length}/500
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">Channel</label>
          <div className="relative">
            <select
              value={form.channel}
              onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
              className="w-full appearance-none border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
            >
              <option value="push">Push Notification</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="all">All Channels</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nm-text-muted pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mb-1">Target Audience</label>
          <div className="relative">
            <select
              value={form.targetRole}
              onChange={(e) => setForm((p) => ({ ...p, targetRole: e.target.value }))}
              className="w-full appearance-none border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
            >
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nm-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2.5 text-xs text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        This will send to <strong>all active {form.targetRole || 'users'}</strong>. This action cannot be undone.
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="nm-btn-secondary text-sm">Cancel</button>
        <button
          type="submit"
          disabled={broadcastMutation.isPending}
          className="nm-btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {broadcastMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send Broadcast
        </button>
      </div>
    </form>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    push: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    sms: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    all: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[channel] ?? map.all}`}>
      {channel}
    </span>
  );
}

export default function NotificationsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const queryParams: Record<string, string | number> = { page, limit: PAGE_SIZE };
  if (channelFilter) queryParams.channel = channelFilter;
  if (appliedSearch) queryParams.search = appliedSearch;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notification-logs', page, channelFilter, appliedSearch],
    queryFn: async () => {
      const res = await notificationsAdminApi.getLogs(queryParams);
      return (res.data?.data ?? { rows: [], total: 0 }) as LogsResponse;
    },
    retry: 1,
  });

  const logs = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const applySearch = () => { setAppliedSearch(searchInput.trim()); setPage(1); };
  const clearSearch = () => { setSearchInput(''); setAppliedSearch(''); setPage(1); };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-nm-text dark:text-nm-text-dark flex items-center gap-2">
            <Bell size={22} />
            Notifications
          </h1>
          <p className="text-sm text-nm-text-muted dark:text-nm-text-dark-muted mt-0.5">
            {total > 0 ? `${total.toLocaleString('en-IN')} notifications sent` : 'System notification centre'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="nm-btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowBroadcast(true)}
            className="nm-btn-primary flex items-center gap-2 text-sm"
          >
            <Megaphone size={14} />
            Broadcast
          </button>
        </div>
      </div>

      {/* Broadcast Panel */}
      {showBroadcast && (
        <div className="nm-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-nm-primary" />
            <h2 className="font-semibold text-nm-text dark:text-nm-text-dark">Send Broadcast Message</h2>
          </div>
          <BroadcastPanel onClose={() => setShowBroadcast(false)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
              placeholder="Search by user name or phone…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-nm-primary text-nm-text dark:text-nm-text-dark placeholder:text-nm-text-muted dark:placeholder:text-nm-text-dark-muted"
            />
          </div>
          <button type="submit" className="nm-btn-primary text-sm px-4">Search</button>
          {appliedSearch && (
            <button type="button" onClick={clearSearch} className="nm-btn-secondary text-sm px-3 flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          )}
        </form>

        <div className="relative">
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="appearance-none border border-nm-border dark:border-nm-border-dark bg-white dark:bg-gray-800 rounded-lg pl-4 pr-8 py-2 text-sm text-nm-text dark:text-nm-text-dark focus:outline-none focus:ring-2 focus:ring-nm-primary"
          >
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nm-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Logs table */}
      <div className="nm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nm-border dark:border-nm-border-dark bg-gray-50 dark:bg-gray-800/50">
                {['Sent At', 'User', 'Title / Message', 'Channel', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-nm-text-muted dark:text-nm-text-dark-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nm-border dark:divide-nm-border-dark">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <Bell size={36} className="mx-auto text-nm-text-muted dark:text-nm-text-dark-muted mb-3 opacity-40" />
                    <p className="text-nm-text-muted dark:text-nm-text-dark-muted text-sm">
                      {channelFilter || appliedSearch ? 'No notifications match your filters.' : 'No notifications have been sent yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-nm-text-muted dark:text-nm-text-dark-muted whitespace-nowrap">
                      {log.sentAt
                        ? new Date(log.sentAt).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-nm-text dark:text-nm-text-dark text-sm">
                        {log.userName || 'Unknown'}
                      </div>
                      {log.userPhone && (
                        <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
                          {log.userPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-nm-text dark:text-nm-text-dark text-sm truncate">
                        {log.title || log.type || '—'}
                      </div>
                      {log.body && (
                        <div className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted truncate">
                          {log.body}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChannelBadge channel={log.channel} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.isRead
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {log.isRead ? 'Read' : 'Unread'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-nm-border dark:border-nm-border-dark">
            <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
              Showing{' '}
              <span className="font-semibold text-nm-text dark:text-nm-text-dark">
                {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)}
              </span>{' '}
              of <span className="font-semibold text-nm-text dark:text-nm-text-dark">{total}</span>
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded text-xs font-medium border border-nm-border dark:border-nm-border-dark hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 text-nm-text dark:text-nm-text-dark transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded text-xs font-medium border border-nm-border dark:border-nm-border-dark hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 text-nm-text dark:text-nm-text-dark transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
