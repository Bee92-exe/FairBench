import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { MyBookings } from './pages/MyBookings';
import { RequestForm } from './pages/RequestForm';
import { LabCalendar } from './pages/LabCalendar';
import { Notifications } from './pages/Notifications';
import { NotFound } from './pages/NotFound';
import { useAuth } from './hooks/useAuth';

// Admin Portal (Owned by Aranno)
import { AdminLayout } from './components/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Override } from './pages/admin/Override';
import { Machines } from './pages/admin/Machines';
import { Attention } from './pages/admin/Attention';
import { History } from './pages/admin/History';
import { Users } from './pages/admin/Users';
import { Settings } from './pages/admin/Settings';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Checking your session…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  const { isAdmin } = useAuth();

  return (
    <Routes>
      {/* Public Login */}
      <Route path="/login" element={<Login />} />

      {/* Main Layout */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {/* Default route redirect per FRONTEND_SPEC Section 3 */}
        <Route path="/" element={isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/my" replace />} />

        {/* Student and Shared Pages (Owned by Sirat) */}
        <Route path="/my" element={<MyBookings />} />
        <Route path="/request/new" element={<RequestForm />} />
        <Route path="/calendar" element={<LabCalendar />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* Admin Pages (Owned by Aranno) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="override" element={<Override />} />
          <Route path="machines" element={<Machines />} />
          <Route path="attention" element={<Attention />} />
          <Route path="history" element={<History />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* 404 Handler */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
