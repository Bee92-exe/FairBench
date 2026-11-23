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
        {/* Default route redirect per FRONTEND_SPEC */}
        <Route path="/" element={<Navigate to="/my" replace />} />

        {/* Student and Shared Pages (Owned by Sirat) */}
        <Route path="/my" element={<MyBookings />} />
        <Route path="/request/new" element={<RequestForm />} />
        <Route path="/calendar" element={<LabCalendar />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* 404 Handler */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
