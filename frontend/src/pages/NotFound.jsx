import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Home } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="text-6xl font-extrabold text-indigo-600 font-mono mb-2">404</div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The requested lab page or resource does not exist or has been moved.
      </p>
      <Link to="/my">
        <Button icon={Home}>Return to My Bookings</Button>
      </Link>
    </div>
  );
}
