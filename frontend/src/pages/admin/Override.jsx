/**
 * Admin Override Page
 * Owner: Aranno (A-FE-2, FR-21, FR-22, AF-01 to AF-03)
 * Lets Dr. Haque pin slots, bump bookings, or reserve PI time with a What-If preview before committing.
 */

import React, { useState, useEffect } from 'react';
import { PinForm } from '../../components/admin/PinForm';
import { PreviewDiff } from '../../components/admin/PreviewDiff';
import { adminApi } from '../../api/adminClient';
import { apiRequest } from '../../api/client';
import { Pin, AlertCircle, CheckCircle } from 'lucide-react';

export function Override() {
  const [bookings, setBookings] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // Load current bookings
  const loadSchedule = () => {
    apiRequest('/api/schedule')
      .then(res => setBookings(res.blocks || []))
      .catch(console.error);
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handlePreview = async (change) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const result = await adminApi.previewChange(change);
      setPendingChange(change);
      setPreviewData(result);
      setPreviewOpen(true);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate preview' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingChange) return;
    setConfirming(true);
    try {
      const res = await adminApi.applyChange(pendingChange, note, previewData?.previewHash);
      setPreviewOpen(false);
      setStatusMessage({ type: 'success', text: 'Override applied successfully! Affected students have been notified.' });
      setPendingChange(null);
      setNote('');
      loadSchedule();
    } catch (err) {
      if (err.code === 'PREVIEW_STALE') {
        setStatusMessage({ type: 'error', text: 'Schedule was updated by another change. Refreshing preview...' });
        handlePreview(pendingChange);
      } else {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to apply change' });
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
            <Pin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Overrides & Reservations</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pin critical runs, bump student slots, or reserve time for PI research. (FR-21 to FR-25)
            </p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Override Configuration Form */}
      <PinForm
        bookings={bookings}
        onPreview={handlePreview}
        loading={loading}
      />

      {/* What-If Diff Modal */}
      <PreviewDiff
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleConfirm}
        previewData={previewData}
        loading={confirming}
        note={note}
        onNoteChange={setNote}
      />
    </div>
  );
}
