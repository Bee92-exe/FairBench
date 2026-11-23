/**
 * ReasonText component
 * Explains algorithmic decisions in plain language (FR-18, FR-19, UX Rule 4)
 * @param {string} text - Unaltered reason text from the scheduler
 * @param {'neutral' | 'success' | 'warning' | 'error'} [tone='neutral']
 */
import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

export function ReasonText({ text, tone = 'neutral', className }) {
  if (!text) return null;

  const styles = {
    neutral: {
      wrapper: 'bg-slate-50 border-slate-200 text-slate-700',
      icon: <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
    },
    success: {
      wrapper: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
    },
    warning: {
      wrapper: 'bg-amber-50/80 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
    },
    error: {
      wrapper: 'bg-rose-50/80 border-rose-200 text-rose-900',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
    }
  };

  const current = styles[tone] || styles.neutral;

  return (
    <div className={clsx('flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed', current.wrapper, className)}>
      {current.icon}
      <div className="font-normal">{text}</div>
    </div>
  );
}
