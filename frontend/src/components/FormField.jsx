import React from 'react';
import { clsx } from 'clsx';

export function FormField({
  label,
  error,
  hint,
  required = false,
  children,
  className
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 tracking-wide">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-[11px] text-slate-500 leading-normal">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-rose-600 font-medium leading-normal animate-fadeIn">
          {error}
        </p>
      )}
    </div>
  );
}
