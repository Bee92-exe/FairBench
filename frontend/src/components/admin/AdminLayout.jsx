/**
 * Admin Layout & Navigation Bar
 * Owner: Aranno (A-FE-1)
 * Standard layout wrapper for all admin portal screens.
 */

import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { RequireAdmin } from './RequireAdmin';
import { 
  LayoutDashboard, 
  Pin, 
  Wrench, 
  AlertOctagon, 
  History, 
  Users, 
  Sliders 
} from 'lucide-react';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/override', label: 'Overrides', icon: Pin },
  { to: '/admin/machines', label: 'Outages', icon: Wrench },
  { to: '/admin/attention', label: 'Attention', icon: AlertOctagon },
  { to: '/admin/history', label: 'Audit Log', icon: History },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Sliders }
];

export function AdminLayout() {
  return (
    <RequireAdmin>
      <div className="space-y-6">
        {/* Admin Navigation Pills */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-xs overflow-x-auto flex items-center gap-1">
          {ADMIN_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Admin Page Content */}
        <div>
          <Outlet />
        </div>
      </div>
    </RequireAdmin>
  );
}
