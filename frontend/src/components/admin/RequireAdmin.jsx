/**
 * RequireAdmin Route Guard
 * Owner: Aranno (A-FE-1, FR-01, NFR-04)
 * Protects admin routes on the frontend, redirecting unauthorized users.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../Button';

export function RequireAdmin({ children }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-rose-200 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Admin Permissions Required</h2>
        <p className="text-xs text-slate-500">
          Only Dr. Haque and authorized lab administrators can access this view. Switch to Dr. Haque in the header demo bar to view.
        </p>
        <Navigate to="/my" replace />
      </div>
    );
  }

  return children;
}
