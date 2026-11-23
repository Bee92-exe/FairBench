/**
 * Table component
 * @param {Array<{ key: string, label: string, render?: (val: any, row: any) => React.ReactNode, className?: string }>} columns
 * @param {Array<any>} rows
 * @param {string} [emptyText='No records found']
 * @param {string} [className]
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Table({
  columns = [],
  rows = [],
  emptyText = 'No data available',
  className
}) {
  return (
    <div className={twMerge('w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <table className="w-full text-left text-sm text-slate-600 divide-y divide-slate-200">
        <thead className="bg-slate-50/80 text-xs font-semibold text-slate-700 uppercase tracking-wider">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx('px-4 py-3.5 whitespace-nowrap', col.className)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-slate-400"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id || idx}
                className="hover:bg-slate-50/70 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx('px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap', col.className)}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
