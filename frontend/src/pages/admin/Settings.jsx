/**
 * Admin Settings & Algorithm Weights Page
 * Owner: Aranno (A-FE-7, FR-16, AF-06)
 * Configures lab opening hours, slot increments, student quotas, and scheduling score weights.
 */

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Button } from '../../components/Button';
import { Sliders, Save, CheckCircle2, RotateCcw } from 'lucide-react';

export function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    apiRequest('/api/settings')
      .then(res => setSettings(res.settings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiRequest('/api/settings', {
        method: 'PUT',
        body: settings
      });
      setSettings(res.settings);
      setFeedback({ type: 'success', text: 'Lab settings and scheduler weights saved successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lab Rules & Algorithm Configuration</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Admin-configurable opening hours, quota limits, and priority score weights. (FR-16, AF-06)
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Operating Hours & Policy */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Operating Hours & Booking Grid</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Lab Opening Time
              </label>
              <input
                type="time"
                value={settings.opening_time || '08:00'}
                onChange={(e) => setSettings({ ...settings, opening_time: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Lab Closing Time
              </label>
              <input
                type="time"
                value={settings.closing_time || '20:00'}
                onChange={(e) => setSettings({ ...settings, closing_time: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Slot Grid Increment (Minutes)
              </label>
              <input
                type="number"
                value={settings.slot_minutes || 15}
                onChange={(e) => setSettings({ ...settings, slot_minutes: parseInt(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Student Quota Limits (FR-10) */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Student Booking Quotas (FR-10)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Weekly Machine Hours Quota
              </label>
              <input
                type="number"
                value={settings.weekly_quota_hours || 12}
                onChange={(e) => setSettings({ ...settings, weekly_quota_hours: parseFloat(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400 mt-1 block">Maximum total booked machine hours allowed per student per week</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Maximum Open Requests Limit
              </label>
              <input
                type="number"
                value={settings.open_requests_limit || 5}
                onChange={(e) => setSettings({ ...settings, open_requests_limit: parseInt(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400 mt-1 block">Maximum active and waiting requests per student at any one time</span>
            </div>
          </div>
        </div>

        {/* Priority Score Weights (AF-05, AF-06) */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Scheduling Priority Score Weights (AF-06)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Score = w₁ × Deadline + w₂ × Tightness + w₃ × Waiting + w₄ × Fairness. Total normalizes to 1.0.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Deadline Weight ({((settings.score_weights?.deadline || 0.40) * 100).toFixed(0)}%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.score_weights?.deadline || 0.40}
                onChange={(e) => setSettings({
                  ...settings,
                  score_weights: { ...settings.score_weights, deadline: parseFloat(e.target.value) }
                })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tightness Weight ({((settings.score_weights?.tightness || 0.25) * 100).toFixed(0)}%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.score_weights?.tightness || 0.25}
                onChange={(e) => setSettings({
                  ...settings,
                  score_weights: { ...settings.score_weights, tightness: parseFloat(e.target.value) }
                })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Waiting Time Weight ({((settings.score_weights?.waiting || 0.15) * 100).toFixed(0)}%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.score_weights?.waiting || 0.15}
                onChange={(e) => setSettings({
                  ...settings,
                  score_weights: { ...settings.score_weights, waiting: parseFloat(e.target.value) }
                })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Fairness Tie-break ({((settings.score_weights?.fairness || 0.20) * 100).toFixed(0)}%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.score_weights?.fairness || 0.20}
                onChange={(e) => setSettings({
                  ...settings,
                  score_weights: { ...settings.score_weights, fairness: parseFloat(e.target.value) }
                })}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="submit" variant="primary" loading={saving} icon={Save}>
            Save Lab Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
