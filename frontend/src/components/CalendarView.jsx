/**
 * CalendarView Component
 * Shared component built by Sirat for both student & admin interfaces
 * 
 * Props:
 * @param {string} machineId - Target machine identifier
 * @param {string} [from] - Start ISO date
 * @param {string} [to] - End ISO date
 * @param {Array<{ id: string, kind: string, label: string, start: string, end: string, occupiedUntil?: string, isMine?: boolean, reason?: string }>} blocks
 * @param {Array<{ id: string, start: string, end: string, note?: string }>} outages
 * @param {(item: any) => void} [onSelect] - Callback when clicking a block or outage
 * @param {boolean} [readOnly=false] - When true, disables interactive selection
 * @param {string} [highlightUserId] - Optional user id to highlight
 */
import React, { useState } from 'react';
import { formatLabTime, formatLabDate } from '../lib/time';
import { ChevronLeft, ChevronRight, AlertTriangle, User, Calendar as CalendarIcon } from 'lucide-react';
import { clsx } from 'clsx';

export function CalendarView({
  machineId,
  blocks = [],
  outages = [],
  onSelect,
  readOnly = false,
  highlightUserId
}) {
  const [currentDayOffset, setCurrentDayOffset] = useState(1); // Default to tomorrow where bookings are

  const activeDate = new Date();
  activeDate.setDate(activeDate.getDate() + currentDayOffset);

  // Hours: 08:00 to 20:00 (12 hours)
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);

  // Filter blocks for active day
  const isSameDay = (isoDate, targetDate) => {
    const d = new Date(isoDate);
    return (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate()
    );
  };

  const dayBlocks = blocks.filter(b => isSameDay(b.start, activeDate));
  const dayOutages = outages.filter(o => isSameDay(o.start, activeDate) || isSameDay(o.end, activeDate));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Calendar Bar & Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-slate-800 text-sm tracking-tight">
            {formatLabDate(activeDate)}
          </span>
          <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">
            Asia/Dhaka
          </span>
        </div>

        {/* Day switch controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentDayOffset(prev => prev - 1)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDayOffset(0)}
            className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCurrentDayOffset(prev => prev + 1)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Color Legend (Mobile friendly) */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-slate-50/40 border-b border-slate-100 text-xs text-slate-600">
        <span className="font-medium text-slate-500">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
          <span>Student Booking</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-100 border-2 border-emerald-500" />
          <span className="font-medium text-emerald-800">Your Booking</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
          <span>PI Reserved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-outage-hatch border border-slate-300" />
          <span>Machine Outage</span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="relative divide-y divide-slate-100 min-h-[480px]">
        {hours.map(hour => {
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`;

          // Find items starting in this hour
          const slotBlocks = dayBlocks.filter(b => {
            const h = new Date(b.start).getHours();
            return h === hour;
          });

          const slotOutages = dayOutages.filter(o => {
            const h = new Date(o.start).getHours();
            return h === hour;
          });

          return (
            <div key={hour} className="flex min-h-[52px] group hover:bg-slate-50/50 transition-colors">
              {/* Hour Column */}
              <div className="w-20 shrink-0 px-3 py-2 text-right border-r border-slate-100 text-xs font-mono text-slate-400 select-none">
                {hourLabel}
              </div>

              {/* Slot Area */}
              <div className="flex-1 p-1.5 flex flex-wrap gap-2 items-center">
                {/* Outage banner */}
                {slotOutages.map(outage => (
                  <div
                    key={outage.id}
                    onClick={() => !readOnly && onSelect?.({ ...outage, type: 'outage' })}
                    className="flex-1 min-w-[200px] p-2 rounded-xl bg-outage-hatch border border-slate-300 text-slate-700 text-xs flex items-center justify-between cursor-pointer shadow-sm hover:border-slate-400 transition-all"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Out of Service: {outage.note || 'Maintenance'}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {formatLabTime(outage.start)} - {formatLabTime(outage.end)}
                    </span>
                  </div>
                ))}

                {/* Booking blocks */}
                {slotBlocks.map(block => {
                  const isMine = block.isMine;
                  const isPI = block.kind === 'pi_reserved';

                  let blockStyles = 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100';
                  if (isMine) {
                    blockStyles = 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-950 font-medium hover:bg-emerald-100/90';
                  } else if (isPI) {
                    blockStyles = 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100';
                  }

                  return (
                    <div
                      key={block.id}
                      onClick={() => !readOnly && onSelect?.({ ...block, type: 'booking' })}
                      className={clsx(
                        'flex-1 min-w-[200px] px-3 py-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all shadow-sm',
                        blockStyles
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">
                          {block.label}
                          {isMine && ' (You)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] opacity-80 shrink-0">
                        <span>{formatLabTime(block.start)} - {formatLabTime(block.end)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
