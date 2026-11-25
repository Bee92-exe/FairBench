/**
 * Admin Dashboard
 * Owner: Aranno (A-FE-5, FR-36)
 * High-level overview: pending, unplaced, active outages, recent overrides, quick actions.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminClient';
import { Button } from '../../components/Button';
import { 
  Clock, 
  AlertOctagon, 
  Wrench, 
  CalendarCheck, 
  Pin, 
  History, 
  Users, 
  Sliders, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { formatLabDateTime } from '../../lib/time';

export function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboard()
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {
    pendingCount: 0,
    unplacedCount: 0,
    activeOutagesCount: 0,
    totalBookings: 0
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dr. Haque's Lab Equipment & Scheduling Command Center
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/override">
            <Button variant="primary" icon={Pin} size="sm">
              New Override
            </Button>
          </Link>
          <Link to="/admin/machines">
            <Button variant="secondary" icon={Wrench} size="sm">
              Manage Outages
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Requests</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats.pendingCount}</div>
          <div className="text-xs text-slate-400 mt-1">Awaiting batch or waitlist slot</div>
        </div>

        {/* Unplaced (Needs Attention) */}
        <Link to="/admin/attention" className="group">
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs group-hover:border-rose-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Needs Attention</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-2">{stats.unplacedCount}</div>
            <div className="text-xs text-rose-500 mt-1 flex items-center gap-1">
              Unplaced requests <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>

        {/* Active Outages */}
        <Link to="/admin/machines" className="group">
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs group-hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Outages</span>
              <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <Wrench className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{stats.activeOutagesCount}</div>
            <div className="text-xs text-slate-400 mt-1">Downtime maintenance events</div>
          </div>
        </Link>

        {/* Total Active Bookings */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Bookings</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats.totalBookings}</div>
          <div className="text-xs text-slate-400 mt-1">Guaranteed conflict-free slots</div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/override" className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl hover:bg-indigo-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Pin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Override & Pinning</h3>
              <p className="text-xs text-slate-500 mt-0.5">Simulate and commit PI reservations or bumps with What-If diff.</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/attention" className="p-5 bg-rose-50/50 border border-rose-100 rounded-2xl hover:bg-rose-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Needs Attention</h3>
              <p className="text-xs text-slate-500 mt-0.5">Review unplaced requests and deadline risks needing intervention.</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/history" className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl hover:bg-slate-100/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 text-white rounded-xl shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Audit History</h3>
              <p className="text-xs text-slate-500 mt-0.5">View append-only audit log of all admin actions and re-plans.</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Override Log */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Overrides & System Changes</h3>
            <p className="text-xs text-slate-500">Latest administrative interventions (FR-25)</p>
          </div>
          <Link to="/admin/history" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            Full Audit Log <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {(!data?.recentOverrides || data.recentOverrides.length === 0) ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No recent override events recorded.
            </div>
          ) : (
            data.recentOverrides.map((row) => (
              <div key={row.id} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="capitalize">{row.action}</span>
                    <span className="text-xs text-slate-400 font-normal">by {row.actor_name}</span>
                  </div>
                  {row.note && (
                    <div className="text-xs text-slate-500">Note: "{row.note}"</div>
                  )}
                </div>
                <div className="text-xs text-slate-400 shrink-0">
                  {formatLabDateTime(row.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
