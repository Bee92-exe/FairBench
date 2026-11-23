import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { formatLabDateTime } from '../lib/time';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { Bell, Check, CheckCheck, Calendar, AlertTriangle, Info } from 'lucide-react';

export function Notifications() {
  const {
    notifications = [],
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead
  } = useNotifications();

  if (isLoading) {
    return <Spinner label="Loading notifications..." />;
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'scheduled':
        return <Calendar className="w-5 h-5 text-emerald-600" />;
      case 'unplaced':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'cancelled':
        return <AlertTriangle className="w-5 h-5 text-rose-600" />;
      default:
        return <Info className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Notification Inbox
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Updates on your lab requests, re-plans, and maintenance alerts (FR-32).
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            icon={CheckCheck}
            onClick={() => markAllAsRead()}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          description="You don't have any notifications at the moment."
          icon={Bell}
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                notif.read
                  ? 'bg-white border-slate-200/80 text-slate-600'
                  : 'bg-indigo-50/40 border-indigo-200/90 shadow-2xs text-slate-900'
              }`}
            >
              <div className="p-2 rounded-xl bg-white border border-slate-200 shrink-0 shadow-2xs">
                {getTypeIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-slate-900">
                    {notif.title}
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                    {formatLabDateTime(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {notif.message}
                </p>
              </div>

              {!notif.read && (
                <button
                  type="button"
                  onClick={() => markAsRead(notif.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
