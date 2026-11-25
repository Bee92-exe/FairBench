import React from 'react';

/**
 * Catches a render error anywhere in the tree and shows it, instead of leaving
 * a blank white page. React unmounts the whole tree on an uncaught render error,
 * which is indistinguishable from "the app did nothing" to whoever is using it.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for debugging; the UI stays readable.
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-lg bg-white border border-rose-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Something broke while rendering this page</h1>
          <p className="text-sm text-slate-600">
            The error below was caught before it could blank the screen. Reloading usually
            clears it; if it keeps happening, the details are useful in a bug report.
          </p>
          <pre className="text-xs bg-slate-900 text-rose-200 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap">
            {error.name}: {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Back to start
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
