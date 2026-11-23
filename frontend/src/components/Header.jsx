import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { 
  Calendar, 
  Clock, 
  PlusCircle, 
  Bell, 
  FlaskConical, 
  LogOut, 
  UserCheck, 
  ShieldAlert,
  Menu,
  X
} from 'lucide-react';
import { clsx } from 'clsx';

export function Header() {
  const { user, role, isAdmin, switchUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/calendar', label: 'Lab Calendar', icon: Calendar },
    { to: '/my', label: 'My Bookings', icon: Clock },
    { to: '/request/new', label: 'New Request', icon: PlusCircle }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Lab Branding */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 tracking-tight leading-none text-base">
                FairBench
              </div>
              <div className="text-[10px] text-slate-500 font-medium tracking-wide uppercase mt-0.5">
                Dr. Haque Lab Scheduler
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  )}
                >
                  <Icon className={clsx('w-4 h-4', active ? 'text-indigo-600' : 'text-slate-400')} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications Bell */}
            <Link
              to="/notifications"
              className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* Quick Demo Switcher */}
            <div className="hidden sm:flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => switchUser('usr-sirat')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg font-medium transition-all',
                  user?.id === 'usr-sirat'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Switch to Sirat (Student)"
              >
                Sirat (Student)
              </button>
              <button
                type="button"
                onClick={() => switchUser('usr-haque')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg font-medium transition-all',
                  user?.id === 'usr-haque'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Switch to Dr. Haque (Admin)"
              >
                Dr. Haque (Admin)
              </button>
            </div>

            {/* User Indicator */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="hidden lg:block text-left text-xs leading-tight">
                <div className="font-semibold text-slate-900">{user?.name}</div>
                <div className="text-[10px] text-slate-500 capitalize">{role}</div>
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 md:hidden rounded-xl text-slate-500 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Role Switcher:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { switchUser('usr-sirat'); setMobileMenuOpen(false); }}
                className="px-2 py-1 bg-slate-100 rounded text-slate-700"
              >
                Sirat
              </button>
              <button
                type="button"
                onClick={() => { switchUser('usr-haque'); setMobileMenuOpen(false); }}
                className="px-2 py-1 bg-slate-100 rounded text-slate-700"
              >
                Dr. Haque
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
