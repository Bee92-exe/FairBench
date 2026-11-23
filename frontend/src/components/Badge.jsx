/**
 * StatusChip / Badge component
 * @param {'scheduled' | 'unplaced' | 'waiting' | 'cancelled' | 'completed' | 'moved' | 'risk'} status
 * @param {string} [label] - Optional custom label
 * @param {string} [className]
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { STATUS_CONFIG } from '../lib/constants';

export function StatusChip({ status, label, className }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting;
  const displayLabel = label || config.label;

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border',
          config.badgeClass,
          className
        )
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', config.dotClass)} />
      {displayLabel}
    </span>
  );
}

export const Badge = StatusChip;
