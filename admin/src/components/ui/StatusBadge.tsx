'use client';

import clsx from 'clsx';

type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'banned'
  | 'open'
  | 'resolved'
  | 'escalated'
  | 'featured'
  | 'paused'
  | 'delisted'
  | 'draft'
  | 'in_escrow'
  | 'completed'
  | 'refunded'
  | 'frozen'
  | 'released'
  | 'kyc_pending'
  | 'kyc_verified'
  | 'kyc_rejected'
  | string;

const variantStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  released: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  holding: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  paid: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  shipped: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delivered: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  live: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  disputed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending_payment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  featured: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  kyc_verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  kyc_pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  in_escrow: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  frozen: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  open: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  escalated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  banned: 'bg-red-900 text-red-100 dark:bg-red-900 dark:text-red-200',
  delisted: 'bg-gray-800 text-gray-200 dark:bg-gray-900 dark:text-gray-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  kyc_rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const labelMap: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  banned: 'Banned',
  open: 'Open',
  resolved: 'Resolved',
  escalated: 'Escalated',
  featured: 'Featured',
  paused: 'Paused',
  delisted: 'Delisted',
  draft: 'Draft',
  in_escrow: 'In Escrow',
  completed: 'Completed',
  refunded: 'Refunded',
  frozen: 'Frozen',
  released: 'Released',
  kyc_pending: 'KYC Pending',
  kyc_verified: 'KYC Verified',
  kyc_rejected: 'KYC Rejected',
  holding: 'In Escrow',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  live: 'Live',
  disputed: 'Disputed',
  pending_payment: 'Pending Payment',
};

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const style = variantStyles[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  const label = labelMap[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
