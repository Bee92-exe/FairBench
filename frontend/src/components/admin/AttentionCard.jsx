/**
 * AttentionCard Component
 * Owner: Aranno (A-FE-4, FR-19, FR-30, FR-43)
 * Displays unplaced requests needing Dr. Haque's review with reasons,
 * suggestions, deadline risk flags and one-click pin action.
 */

import React from 'react';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { ShieldAlert, Lightbulb, Clock, Pin, Mail } from 'lucide-react';
import { formatLabDateTime } from '../../lib/time';

export function AttentionCard({ request, onPinSlot }) {
  const isUrgent = request.is_fixed || request.isFixed || (request.urgency || 3) >= 4;

  return (
    <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 text-base">
              {request.student_name || request.studentName || 'Student'}
            </h4>
            {isUrgent && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                <ShieldAlert className="w-3.5 h-3.5" /> Deadline Risk
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Machine: <span className="font-semibold text-slate-700">{request.machine_name || request.machine_id || request.machineId}</span> · Duration: {request.duration_min || request.durationMin} min
          </div>
        </div>
        <Badge status={request.status || 'unplaced'} />
      </div>

      {/* Requested Window */}
      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" /> Requested Window
        </div>
        <div className="text-slate-700">
          {formatLabDateTime(request.window_start || request.windowStart)} – {formatLabDateTime(request.window_end || request.windowEnd)}
        </div>
      </div>

      {/* Explanations */}
      {(request.unplaced_reason || request.unplacedReason) && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 p-3 rounded-xl space-y-1">
          <div className="font-semibold">Why it could not be placed (FR-19):</div>
          <div>{request.unplaced_reason || request.unplacedReason}</div>
        </div>
      )}

      {(request.suggestion) && (
        <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-100 p-3 rounded-xl flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">System Suggestion (FR-43): </span>
            {request.suggestion}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`mailto:${request.email || 'student@lab.test'}?subject=FairBench Booking Window Clarification`)}
          icon={Mail}
        >
          Contact Student
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => onPinSlot(request)}
          icon={Pin}
        >
          Pin a Slot for Student
        </Button>
      </div>
    </div>
  );
}
