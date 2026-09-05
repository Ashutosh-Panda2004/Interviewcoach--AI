import React from 'react';
import { AlertTriangle } from 'lucide-react';

const showErrorDetails = import.meta.env.DEV;

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (showErrorDetails) console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md bg-red-950/20 border border-red-800 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h1 className="text-xl font-bold">Something went wrong</h1>
            </div>
            <p className="text-red-200 mb-4 text-sm">
              {showErrorDetails ? (this.state.error?.message || 'An unexpected error occurred') : 'The current view could not be displayed. Return home and try again.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold text-white"
            >
              Back to Home
            </button>
            {showErrorDetails && (
              <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer hover:text-slate-300">Error details</summary>
                <pre className="mt-2 bg-slate-900 p-3 rounded overflow-auto max-h-40 text-red-300">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
