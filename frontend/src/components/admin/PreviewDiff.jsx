/**
 * PreviewDiff Modal Component
 * Owner: Aranno (A-FE-2, AF-01 to AF-03)
 * Displays before/after diff of schedule re-plans with summary chips,
 * risk badges, running-booking warnings, and confirmation note input.
 */

import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { AlertTriangle, Clock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatLabDateTime } from '../../lib/time';

export function PreviewDiff({
  open,
  onClose,
  onConfirm,
  previewData,
  loading = false,
  note,
  onNoteChange
}) {
  if (!previewData) return null;

  const { summary, changes = [], warnings = [] } = previewData;

  const footer = (
    <div className="flex items-center justify-between w-full">
      <Button variant="ghost" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={loading}
          icon={CheckCircle2}
        >
          Confirm & Apply Change
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="What-If Impact Preview"
      size="xl"
      footer={footer}
    >
      <div className="space-y-6">
        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Affected</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{summary?.affected || 0}</div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wider">Moved</div>
            <div className="text-xl font-bold text-amber-800 mt-1">{summary?.moved || 0}</div>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <div className="text-xs font-medium text-rose-700 uppercase tracking-wider">Unplaced</div>
            <div className="text-xl font-bold text-rose-800 mt-1">{summary?.unplaced || 0}</div>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="text-xs font-medium text-red-700 uppercase tracking-wider">Deadline Risk</div>
            <div className="text-xl font-bold text-red-800 mt-1">{summary?.atRisk || 0}</div>
          </div>
        </div>

        {/* Warnings Banner */}
        {warnings.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Warnings Detected</span>
            </div>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              {warnings.map((w, idx) => (
                <li key={idx}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Changes Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
            Re-plan Details by Student
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {changes.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No active bookings will be moved or affected by this change.
              </div>
            ) : (
              changes.map((item, index) => (
                <div key={index} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{item.studentName}</span>
                      <span className="text-xs text-slate-400">· {item.machine}</span>
                      {item.risk && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                          <ShieldAlert className="w-3 h-3" /> Deadline Risk
                        </span>
                      )}
                    </div>
                    <Badge status={item.outcome === 'unplaced' ? 'unplaced' : 'moved'} />
                  </div>

                  {/* Slot shift display */}
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="bg-slate-100 px-2.5 py-1 rounded-lg">
                      <span className="text-slate-400 mr-1">Before:</span>
                      {formatLabDateTime(item.before.start)}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className={item.after ? "bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-medium" : "bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg font-medium"}>
                      <span className="opacity-60 mr-1">After:</span>
                      {item.after ? formatLabDateTime(item.after.start) : 'No valid slot inside window'}
                    </div>
                  </div>

                  {/* Reason explanation */}
                  {item.reason && (
                    <div className="text-xs text-slate-500 italic pl-1 border-l-2 border-slate-200">
                      "{item.reason}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Optional note to affected students */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Explanation Note to Affected Students (Optional, AF-03)
          </label>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g., Confocal laser calibration moved ahead to prepare for university demo..."
            rows={2}
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}
