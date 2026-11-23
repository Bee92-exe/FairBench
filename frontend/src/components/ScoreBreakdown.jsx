/**
 * ScoreBreakdown component
 * Displays transparent scheduling priority formula (AF-07, FR-38)
 * Score = 0.40 * deadline + 0.25 * tightness + 0.15 * waiting + 0.20 * fairness
 * @param {object} breakdown - { deadline, tightness, waiting, fairness }
 * @param {number} totalScore
 */
import React from 'react';

export function ScoreBreakdown({ breakdown = {}, totalScore = 0 }) {
  const {
    deadline = 0,
    tightness = 0,
    waiting = 0,
    fairness = 0
  } = breakdown;

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Priority Score
        </span>
        <span className="text-lg font-bold text-indigo-600 font-mono">
          {totalScore.toFixed(1)} / 100
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {/* Deadline Pressure */}
        <div>
          <div className="flex justify-between text-slate-600 mb-1">
            <span>Deadline Pressure (40%)</span>
            <span className="font-mono">{deadline} pts</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, deadline * 2.5)}%` }} />
          </div>
        </div>

        {/* Window Tightness */}
        <div>
          <div className="flex justify-between text-slate-600 mb-1">
            <span>Window Tightness (25%)</span>
            <span className="font-mono">{tightness} pts</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, tightness * 4)}%` }} />
          </div>
        </div>

        {/* Waiting Time */}
        <div>
          <div className="flex justify-between text-slate-600 mb-1">
            <span>Queue Waiting Time (15%)</span>
            <span className="font-mono">{waiting} pts</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, waiting * 6.6)}%` }} />
          </div>
        </div>

        {/* Fairness Credit */}
        <div>
          <div className="flex justify-between text-slate-600 mb-1">
            <span>Lab Fairness Balance (20%)</span>
            <span className="font-mono">{fairness} pts</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, fairness * 5)}%` }} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
        💡 To improve score: widen your window flexibility or request during off-peak lab hours.
      </p>
    </div>
  );
}
