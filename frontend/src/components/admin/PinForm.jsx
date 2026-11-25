/**
 * PinForm Component
 * Owner: Aranno (A-FE-2, FR-21, FR-22, FR-23)
 * Admin form for Pinning a slot, Bumping a booking, or reserving PI time.
 */

import React, { useState } from 'react';
import { Button } from '../Button';
import { MACHINES } from '../../lib/constants';
import { Pin, ArrowDownCircle, ShieldAlert, Eye } from 'lucide-react';

export function PinForm({ bookings = [], onPreview, loading = false }) {
  const [overrideType, setOverrideType] = useState('reserve'); // 'pin' | 'bump' | 'reserve'
  const [machineId, setMachineId] = useState(MACHINES[0]?.id || 'm-microscope');
  const [bookingId, setBookingId] = useState('');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const endSlot = new Date(tomorrow);
  endSlot.setHours(13, 0, 0, 0);

  const [start, setStart] = useState(tomorrow.toISOString().slice(0, 16));
  const [end, setEnd] = useState(endSlot.toISOString().slice(0, 16));
  const [note, setNote] = useState('');

  const activeBookings = bookings.filter(b => b.status === 'active');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (overrideType === 'bump') {
      onPreview({
        type: 'bump',
        bookingId
      });
    } else if (overrideType === 'pin') {
      onPreview({
        type: 'pin',
        machineId,
        bookingId: bookingId || undefined,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        note
      });
    } else {
      // reserve
      onPreview({
        type: 'reserve',
        machineId,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        note
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
      {/* Tab selection */}
      <div className="flex border-b border-slate-200 pb-3 gap-2">
        <button
          type="button"
          onClick={() => setOverrideType('reserve')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            overrideType === 'reserve'
              ? 'bg-purple-100 text-purple-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Pin className="w-3.5 h-3.5" /> PI Research Reservation
        </button>
        <button
          type="button"
          onClick={() => setOverrideType('pin')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            overrideType === 'pin'
              ? 'bg-indigo-100 text-indigo-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Pin Specific Slot
        </button>
        <button
          type="button"
          onClick={() => setOverrideType('bump')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            overrideType === 'bump'
              ? 'bg-rose-100 text-rose-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowDownCircle className="w-3.5 h-3.5" /> Bump Booking
        </button>
      </div>

      {overrideType === 'bump' ? (
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Select Active Booking to Bump
          </label>
          <select
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            required
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
          >
            <option value="">-- Choose student booking --</option>
            {activeBookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.student_name || b.label} - {b.machine_id} ({new Date(b.start_at || b.start).toLocaleString()})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Bumped student requests are automatically re-planned in priority order (FR-24).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Machine
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              {MACHINES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason / Grant Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Laser spectroscopy paper revision run"
              required={overrideType === 'pin'}
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              End Time
            </label>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          icon={Eye}
        >
          Preview Impact (AF-01)
        </Button>
      </div>
    </form>
  );
}
