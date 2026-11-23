import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { MyBookings } from './pages/MyBookings';
import { RequestForm } from './pages/RequestForm';
import { LabCalendar } from './pages/LabCalendar';
import { Notifications } from './pages/Notifications';
import { NotFound } from './pages/NotFound';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Login */}
      <Route path="/login" element={<Login />} />

      {/* Main Layout */}
      <Route element={<Layout />}>
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
