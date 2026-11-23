import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { LAB_TIMEZONE } from '../lib/constants';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70">
      <Header />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            FairBench System · Dr. Haque Laboratory Equipment Management
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Timezone: {LAB_TIMEZONE}</span>
            <span>·</span>
            <span>Version 1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
