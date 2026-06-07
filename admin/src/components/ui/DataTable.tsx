'use client';

import { useState, ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  expandedRowId?: string | null;
  renderExpanded?: (row: T) => ReactNode;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  emptyMessage?: string;
  className?: string;
}

type SortDir = 'asc' | 'desc' | null;

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  loading = false,
  selectable = false,
  selectedIds = [],
  onSelectChange,
  onRowClick,
  expandedRowId,
  renderExpanded,
  pagination,
  emptyMessage = 'No records found.',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const aVal = (a as Record<string, unknown>)[sortKey];
    const bVal = (b as Record<string, unknown>)[sortKey];
    if (aVal === bVal) return 0;
    const cmp = (aVal as string | number) < (bVal as string | number) ? -1 : 1;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allIds = data.map((r) => String(r[keyField]));
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected = allIds.some((id) => selectedIds.includes(id)) && !allSelected;

  const handleSelectAll = () => {
    if (!onSelectChange) return;
    onSelectChange(allSelected ? [] : allIds);
  };

  const handleSelectRow = (id: string) => {
    if (!onSelectChange) return;
    onSelectChange(
      selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]
    );
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={clsx('nm-card overflow-hidden', className)}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nm-border dark:border-nm-border-dark bg-gray-50 dark:bg-gray-800/50">
              {selectable && (
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-nm-primary focus:ring-nm-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-left font-semibold text-nm-text-muted dark:text-nm-text-dark-muted text-xs uppercase tracking-wide',
                    col.width,
                    col.sortable && 'cursor-pointer select-none hover:text-nm-text dark:hover:text-nm-text-dark'
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="opacity-50">
                        {sortKey === col.key && sortDir === 'asc' ? (
                          <ChevronUp size={13} />
                        ) : sortKey === col.key && sortDir === 'desc' ? (
                          <ChevronDown size={13} />
                        ) : (
                          <ChevronsUpDown size={13} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-nm-border dark:divide-nm-border-dark">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="px-4 py-3"><div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-nm-text-muted dark:text-nm-text-dark-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const id = String(row[keyField]);
                const isSelected = selectedIds.includes(id);
                const isExpanded = expandedRowId === id;
                return (
                  <>
                    <tr
                      key={id}
                      className={clsx(
                        'transition-colors duration-100',
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                        onRowClick && 'cursor-pointer'
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(id)}
                            className="rounded border-gray-300 text-nm-primary focus:ring-nm-primary"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-nm-text dark:text-nm-text-dark">
                          {col.render ? col.render(row) : String(row[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr key={`${id}-expanded`} className="bg-blue-50/50 dark:bg-blue-900/5">
                        <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-6 py-4">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-nm-border dark:border-nm-border-dark">
          <p className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">
            Showing{' '}
            <span className="font-semibold text-nm-text dark:text-nm-text-dark">
              {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of <span className="font-semibold text-nm-text dark:text-nm-text-dark">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-nm-text-muted dark:text-nm-text-dark-muted transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (pagination.page <= 4) {
                page = i + 1;
              } else if (pagination.page >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = pagination.page - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => pagination.onPageChange(page)}
                  className={clsx(
                    'w-7 h-7 rounded text-xs font-medium transition-colors',
                    page === pagination.page
                      ? 'bg-nm-primary text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-nm-text-muted dark:text-nm-text-dark-muted'
                  )}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-nm-text-muted dark:text-nm-text-dark-muted transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
