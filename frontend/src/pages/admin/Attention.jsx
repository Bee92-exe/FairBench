/**
 * Needs Attention Page
 * Owner: Aranno (A-FE-4, FR-19, FR-30, FR-43)
 * Displays requests that could not be placed automatically,
 * along with plain explanations, suggestions, and deadline risk alerts.
 */

import React, { useState, useEffect } from 'react';
import { AttentionCard } from '../../components/admin/AttentionCard';
import { PreviewDiff } from '../../components/admin/PreviewDiff';
import { adminApi } from '../../api/adminClient';
import { AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

export function Attention() {
  const [unplacedRequests, setUnplacedRequests] = useState([]);
  const [deadlineRisks, setDeadlineRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [note, setNote] = useState('');

  const loadData = () => {
    setLoading(true);
    adminApi.getAttention()
      .then(res => {
        setUnplacedRequests(res.unplaced || []);
        setDeadlineRisks(res.deadlineRisk || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePinSlot = async (request) => {
    const slotStart = new Date(request.window_start || request.windowStart);
    const slotEnd = new Date(slotStart.getTime() + (request.duration_min || request.durationMin || 180) * 60 * 1000);

    const change = {
      type: 'pin',
      machineId: request.machine_id || request.machineId,
      requestId: request.id,
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      note: `Pinned for ${request.student_name || 'student'} by Dr. Haque`
    };

    try {
      const preview = await adminApi.previewChange(change);
      setPendingChange(change);
      setPreviewData(preview);
      setPreviewOpen(true);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to simulate pin override' });
    }
  };

  const handleConfirmPin = async () => {
    if (!pendingChange) return;
    try {
      await adminApi.applyChange(pendingChange, note, previewData?.previewHash);
      setPreviewOpen(false);
      setFeedback({ type: 'success', text: 'Slot successfully pinned! Student has been placed and notified.' });
      setPendingChange(null);
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to pin slot' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Needs Attention: Unplaced Requests</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review requests the scheduler could not place without human decision. (FR-19, FR-30, FR-43)
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
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Unplaced Requests List */}
      <div className="space-y-4">
        {unplacedRequests.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">All Requests Satisfied</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              There are currently no unplaced student runs or urgent deadline conflicts awaiting review.
            </p>
          </div>
        ) : (
          unplacedRequests.map((req) => (
            <AttentionCard
              key={req.id}
              request={req}
              onPinSlot={handlePinSlot}
            />
          ))
        )}
      </div>

      {/* Preview Diff Modal for Quick Pin */}
      <PreviewDiff
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleConfirmPin}
        previewData={previewData}
        note={note}
        onNoteChange={setNote}
      />
    </div>
  );
}
