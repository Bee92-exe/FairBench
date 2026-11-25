/**
 * Admin Audit History
 * Owner: Aranno (A-FE-5, FR-25, NFR-09)
 * Append-only immutable audit trail of all administrative actions and re-plans.
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminClient';
import { History as HistoryIcon, Clock, ShieldCheck } from 'lucide-react';
import { formatLabDateTime } from '../../lib/time';

export function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getAuditLog(100)
      .then(res => setLogs(res.auditLogs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail & System History</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Append-only tamper-proof log of every override, outage, and administrative intervention. (FR-25, NFR-09)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Note / Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatLabDateTime(row.created_at)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {row.actor_name || 'Dr. Haque'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {row.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                      {row.entity_type} {row.entity_id ? `(${row.entity_id.slice(0, 8)})` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {row.note ? `"${row.note}"` : <span className="text-slate-400 italic">No note provided</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
