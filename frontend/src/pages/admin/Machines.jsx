/**
 * Admin Machines & Outages Management
 * Owner: Aranno (A-FE-3, FR-26, FR-27, FR-31)
 * Mark machines out of service, preview downtime impact, and end outages early.
 */

import React, { useState, useEffect } from 'react';
import { OutageForm } from '../../components/admin/OutageForm';
import { PreviewDiff } from '../../components/admin/PreviewDiff';
import { Button } from '../../components/Button';
import { adminApi } from '../../api/adminClient';
import { apiRequest } from '../../api/client';
import { MACHINES } from '../../lib/constants';
import { Wrench, CheckCircle2, Clock, AlertTriangle, PlayCircle } from 'lucide-react';
import { formatLabDateTime } from '../../lib/time';

export function Machines() {
  const [machinesList, setMachinesList] = useState(MACHINES);
  const [outages, setOutages] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState(null);

  const loadData = () => {
    apiRequest('/api/machines')
      .then(res => {
        if (res.machines) setMachinesList(res.machines);
      })
      .catch(console.error);

    adminApi.getOutages()
      .then(res => {
        if (res.outages) setOutages(res.outages);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePreviewOutage = async (change) => {
    setLoading(true);
    setFeedback(null);
    try {
      const result = await adminApi.previewChange(change);
      setPendingChange(change);
      setPreviewData(result);
      setPreviewOpen(true);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to simulate outage impact' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOutage = async () => {
    if (!pendingChange) return;
    setConfirming(true);
    try {
      await adminApi.applyChange(pendingChange, note, previewData?.previewHash);
      setPreviewOpen(false);
      setFeedback({ type: 'success', text: 'Outage applied. Affected student bookings re-planned automatically.' });
      setPendingChange(null);
      setNote('');
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to apply outage' });
    } finally {
      setConfirming(false);
    }
  };

  const handleEndEarly = async (outageId) => {
    if (!confirm('End this outage early? Freed slots will be offered to waiting requests in score order (FR-31).')) return;
    try {
      await adminApi.applyChange({ type: 'end_outage', outageId }, 'Repaired ahead of schedule');
      setFeedback({ type: 'success', text: 'Outage marked ended early! Freed slots unlocked.' });
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to end outage' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Machine Status & Maintenance Outages</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Monitor machine health, log maintenance downtime, and preview affected runs. (FR-26 to FR-31)
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Machine Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {machinesList.map((m) => {
          const isDown = m.status === 'out_of_service';
          return (
            <div key={m.id} className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">{m.name}</h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isDown ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isDown ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {isDown ? 'Out of Service' : 'Operational'}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Buffer: <span className="font-semibold text-slate-700">{m.bufferMinutes ?? m.buffer_minutes ?? 10} minutes</span> between runs
              </div>
              {(m.reliabilityNote || m.reliability_note || m.warning) && (
                <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                  {m.reliabilityNote || m.reliability_note || m.warning}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Schedule Downtime Form */}
      <OutageForm
        onPreview={handlePreviewOutage}
        loading={loading}
      />

      {/* Active & Past Outages */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Recorded Maintenance Outages</h3>
        <div className="divide-y divide-slate-100">
          {outages.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No active or scheduled maintenance outages.
            </div>
          ) : (
            outages.map((o) => {
              const active = !o.ended_early_at && new Date(o.end_at) > new Date();
              return (
                <div key={o.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{o.machine_id}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        active ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {active ? 'Active Outage' : o.ended_early_at ? 'Ended Early' : 'Completed'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatLabDateTime(o.start_at)} – {formatLabDateTime(o.end_at)}
                    </div>
                    {o.note && (
                      <div className="text-xs text-slate-600">Note: "{o.note}"</div>
                    )}
                  </div>

                  {active && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEndEarly(o.id)}
                      icon={PlayCircle}
                    >
                      End Outage Early (FR-31)
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Preview Diff Modal */}
      <PreviewDiff
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleConfirmOutage}
        previewData={previewData}
        loading={confirming}
        note={note}
        onNoteChange={setNote}
      />
    </div>
  );
}
