/**
 * OutageForm Component
 * Owner: Aranno (A-FE-3, FR-26)
 * Allows admin to configure machine downtime and preview its impact.
 */

import React, { useState } from 'react';
import { Button } from '../Button';
import { MACHINES } from '../../lib/constants';
import { Wrench, Eye } from 'lucide-react';

export function OutageForm({ onPreview, loading = false }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(17, 0, 0, 0);

  const [machineId, setMachineId] = useState(MACHINES[0]?.id || 'm-microscope');
  const [start, setStart] = useState(tomorrow.toISOString().slice(0, 16));
  const [end, setEnd] = useState(dayAfter.toISOString().slice(0, 16));
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onPreview({
      type: 'outage',
      machineId,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      note
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Wrench className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-900 text-base">Mark Machine Out of Service</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Target Machine
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
            Maintenance Reason / Note
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Rotor replacement, annual recalibration"
            required
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Downtime Begins
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
            Estimated Repair Completion
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

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          icon={Eye}
        >
          Preview Outage Impact (AF-01)
        </Button>
      </div>
    </form>
  );
}
