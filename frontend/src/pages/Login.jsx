import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { FlaskConical, Lock, Mail, ArrowRight, ShieldCheck, User } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const { login, switchUser } = useAuth();
  const [email, setEmail] = useState('sirat@university.edu');
  const [password, setPassword] = useState('demo-password');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/my');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userId) => {
    switchUser(userId);
    navigate('/my');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <FlaskConical className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            FairBench Lab Access
          </h1>
          <p className="text-sm text-slate-500">
            Dr. Haque's Equipment & Experiment Scheduler
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="University Email" required>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="name@university.edu"
                  required
                />
              </div>
            </FormField>

            <FormField label="Password" required>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </FormField>

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-2"
              size="lg"
            >
              Sign In to FairBench
            </Button>
          </form>

          {/* Quick Select for Reviewers / Evaluation */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
              Quick Role Switch for Testing
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('usr-sirat')}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-xs font-medium text-slate-700 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sirat (Student)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('usr-haque')}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-xs font-medium text-slate-700 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Dr. Haque (Admin)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
