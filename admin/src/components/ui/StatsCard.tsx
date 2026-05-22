'use client';

import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  iconBg?: string;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  onClick?: () => void;
}

export default function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  iconBg = 'bg-nm-primary/10',
  prefix,
  suffix,
  loading = false,
  onClick,
}: StatsCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change !== undefined && change === 0;

  return (
    <div
      className={clsx(
        'nm-card p-5 flex flex-col gap-3',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow duration-150'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-nm-text-muted dark:text-nm-text-dark-muted">{title}</p>
        {icon && (
          <div className={clsx('p-2 rounded-lg', iconBg)}>
            {icon}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-nm-text dark:text-nm-text-dark tracking-tight">
            {prefix && <span className="text-base font-semibold text-nm-text-muted dark:text-nm-text-dark-muted mr-0.5">{prefix}</span>}
            {value}
            {suffix && <span className="text-base font-semibold text-nm-text-muted dark:text-nm-text-dark-muted ml-0.5">{suffix}</span>}
          </p>

          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive && (
                <span className="flex items-center gap-0.5 text-nm-accent text-xs font-semibold">
                  <TrendingUp size={13} />
                  +{change.toFixed(1)}%
                </span>
              )}
              {isNegative && (
                <span className="flex items-center gap-0.5 text-nm-danger text-xs font-semibold">
                  <TrendingDown size={13} />
                  {change.toFixed(1)}%
                </span>
              )}
              {isNeutral && (
                <span className="flex items-center gap-0.5 text-nm-text-muted text-xs font-semibold">
                  <Minus size={13} />
                  0%
                </span>
              )}
              {changeLabel && (
                <span className="text-xs text-nm-text-muted dark:text-nm-text-dark-muted">{changeLabel}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
