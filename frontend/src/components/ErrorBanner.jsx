import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export function ErrorBanner({ message, details = [], onRetry, onClose }) {
  if (!message) return null;

  return (
    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{message}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-rose-400 hover:text-rose-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {details.length > 0 && (
        <ul className="list-disc list-inside text-xs text-rose-800 space-y-1 pl-6">
          {details.map((d, i) => (
            <li key={i}>{d.message || d}</li>
          ))}
        </ul>
      )}

      {onRetry && (
        <div className="pt-1">
          <button
            onClick={onRetry}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
