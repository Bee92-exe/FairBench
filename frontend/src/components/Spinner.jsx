import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export function Spinner({ size = 'md', label = 'Loading...', className }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 p-6 text-slate-500', className)}>
      <Loader2 className={clsx('animate-spin text-indigo-600', sizes[size])} />
      {label && <span className="text-xs font-medium text-slate-500">{label}</span>}
    </div>
  );
}
