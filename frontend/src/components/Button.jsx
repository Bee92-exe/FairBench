/**
 * Button component
 * @param {'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'} [variant='primary']
 * @param {'sm' | 'md' | 'lg'} [size='md']
 * @param {boolean} [loading=false]
 * @param {boolean} [disabled=false]
 * @param {() => void} [onClick]
 * @param {React.ReactNode} children
 * @param {string} [className]
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
  className,
  type = 'button',
  icon: Icon,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer select-none';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[36px]',
    md: 'px-4 py-2.5 text-sm gap-2 min-h-[44px]', // 44px touch target (UX Rule 1)
    lg: 'px-5 py-3 text-base gap-2.5 min-h-[50px]'
  };

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 focus:ring-indigo-500 border border-transparent',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400 border border-slate-200/80',
    outline: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-sm focus:ring-indigo-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-200 focus:ring-rose-500 border border-transparent',
    ghost: 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 focus:ring-slate-400'
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={twMerge(clsx(baseStyles, sizes[size], variants[variant], className))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Please wait...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0 text-current" />}
          {children}
        </>
      )}
    </button>
  );
}
