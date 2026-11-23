import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { MACHINES, LAB_TIMEZONE } from '../lib/constants';
import { utcToDhakaInput, localInputToUTC } from '../lib/time';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { ReasonText } from '../components/ReasonText';
import { Modal } from '../components/Modal';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Sparkles, 
  Info, 
  CheckCircle, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export function RequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Initial form values (tomorrow 09:00 to 18:00)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(18, 0, 0, 0);

  const [machineId, setMachineId] = useState(MACHINES[0].id);
  const [durationMin, setDurationMin] = useState(180); // 3 hours
  const [windowStart, setWindowStart] = useState(utcToDhakaInput(tomorrow.toISOString()));
  const [windowEnd, setWindowEnd] = useState(utcToDhakaInput(tomorrowEnd.toISOString()));
  const [isFixed, setIsFixed] = useState(true);
  const [reason, setReason] = useState('Fresh fluorescence tissue staining degrades after 24 hours.');
  const [urgency, setUrgency] = useState(4);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resultModal, setResultModal] = useState(null); // { placed: boolean, request: obj, booking: obj }

  const selectedMachine = MACHINES.find(m => m.id === machineId);

  // Available duration slots (15 min to 8 hours in slot steps)
  const durationOptions = [
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '1.5 hours', value: 90 },
    { label: '2 hours', value: 120 },
    { label: '3 hours', value: 180 },
    { label: '4 hours', value: 240 },
    { label: '6 hours', value: 360 },
    { label: '8 hours (Full Day)', value: 480 }
  ];

  // Live validation (FR-08)
  const validate = () => {
    const errs = {};
    const startUtc = localInputToUTC(windowStart);
    const endUtc = localInputToUTC(windowEnd);

    if (!startUtc || !endUtc) {
      errs.window = 'Both start and end dates are required.';
    } else {
      const s = new Date(startUtc).getTime();
      const e = new Date(endUtc).getTime();
      const buffer = selectedMachine?.bufferMin || 15;
      const requiredSpanMs = (durationMin + buffer) * 60 * 1000;

      if (e <= s) {
        errs.windowEnd = 'Window finish must be after window start.';
      } else if (e - s < requiredSpanMs) {
        errs.window = `Window span must be at least ${durationMin + buffer} minutes (duration ${durationMin}m + ${buffer}m cleaning buffer).`;
      }
    }

    if (isFixed && (!reason || reason.trim().length < 5)) {
      errs.reason = 'A clear scientific explanation (at least 5 characters) is required for fixed requests.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        machineId,
        durationMin,
        windowStart: localInputToUTC(windowStart),
        windowEnd: localInputToUTC(windowEnd),
        isFixed,
        reason,
        urgency
      };

      const res = await apiRequest('/api/requests', {
        method: 'POST',
        body: payload
      });

      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });

      setResultModal({
        placed: Boolean(res.booking),
        request: res.request,
        booking: res.booking
      });
    } catch (err) {
      setErrors({ form: err.message || 'Submission failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          New Equipment Request
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Specify your continuous run duration and flexible scheduling window.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Machine Picker */}
        <FormField label="Target Equipment" required>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MACHINES.map((machine) => {
              const isSelected = machine.id === machineId;
              return (
                <div
                  key={machine.id}
                  onClick={() => setMachineId(machine.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  <div className="font-semibold text-sm">{machine.name}</div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">{machine.code}</div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    +{machine.bufferMin}m buffer guaranteed
                  </div>
                </div>
              );
            })}
          </div>
        </FormField>

        {/* Spectrophotometer Slow Machine Warning (FR-15) */}
        {selectedMachine?.warning && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Special Calibration Notice: </span>
              {selectedMachine.warning}
            </div>
          </div>
        )}

        {/* Duration Picker */}
        <FormField
          label="Continuous Duration"
          hint="Job is scheduled in one continuous block and will never be split (FR-07)."
          required
        >
          <select
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {durationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>

        {/* Window Range Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Earliest Possible Start"
            hint={`Lab time (${LAB_TIMEZONE})`}
            error={errors.windowStart}
            required
          >
            <input
              type="datetime-local"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </FormField>

          <FormField
            label="Latest Acceptable Finish"
            hint={`Lab time (${LAB_TIMEZONE})`}
            error={errors.windowEnd}
            required
          >
            <input
              type="datetime-local"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </FormField>
        </div>

        {errors.window && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errors.window}
          </div>
        )}

        {/* Fixed / Flexible Toggle & Reason (FR-06) */}
        <div className="pt-2 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-800">Fixed Deadline Request</span>
              <p className="text-xs text-slate-500">
                Mark as fixed only if non-flexible biological or sample expiration limits exist.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFixed(!isFixed)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isFixed ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isFixed ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <FormField
            label="Scientific Reason & Experiment Description"
            error={errors.reason}
            hint={isFixed ? 'Mandatory for fixed requests (FR-06).' : 'Optional explanation for flexible runs.'}
            required={isFixed}
          >
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Fluorescence decay curve analysis: cell culture prepared at 08:00 must be analyzed within 4 hours."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </FormField>

          {/* Urgency Slider (1 to 5) */}
          <FormField label={`Urgency Level: ${urgency} / 5`}>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={urgency}
              onChange={(e) => setUrgency(Number(e.target.value))}
              className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 px-1 mt-1">
              <span>1 - Routine / Low</span>
              <span>3 - Standard</span>
              <span>5 - Critical Deadline</span>
            </div>
          </FormField>
        </div>

        {/* Summary Banner */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              This needs <strong>{durationMin} minutes</strong> in one continuous block inside this window.
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          loading={loading}
          size="lg"
          className="w-full"
        >
          Submit Request to Scheduler
        </Button>
      </form>

      {/* Immediate Scheduling Result Modal (FRONTEND_SPEC Page 4) */}
      <Modal
        open={Boolean(resultModal)}
        onClose={() => {
          setResultModal(null);
          navigate('/my');
        }}
        title={resultModal?.placed ? 'Booking Successfully Placed' : 'Request Received — Not Yet Placed'}
        footer={
          <Button onClick={() => navigate('/my')}>
            Go to My Bookings
          </Button>
        }
      >
        {resultModal && (
          <div className="space-y-4">
            {resultModal.placed ? (
              <>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span>Run Confirmed</span>
                  </div>
                  <p>Your continuous slot has been reserved on the lab calendar.</p>
                </div>
                {resultModal.booking?.reason && (
                  <ReasonText text={resultModal.booking.reason} tone="success" />
                )}
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>Slot Could Not Be Placed Automatically</span>
                  </div>
                  <p>{resultModal.request?.unplacedReason}</p>
                </div>
                {resultModal.request?.suggestion && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold">Suggestion: </span>
                    {resultModal.request.suggestion}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
