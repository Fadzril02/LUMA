import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Global ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-200">
          <div className="max-w-lg w-full bg-slate-800 border border-red-500/40 rounded-2xl p-8 shadow-2xl text-center backdrop-blur-md">
            <div className="mx-auto inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 text-red-500 mb-5 border border-red-500/20">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2 tracking-tight">
              Application Error Encountered
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              An unexpected error occurred and has been caught by the global error boundary to prevent an unmounted screen.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-left text-xs font-mono text-red-300 break-words max-h-36 overflow-y-auto">
                <span className="font-semibold text-red-400 block mb-1">Error Message:</span>
                {this.state.error.message}
              </div>
            )}

            <button
              id="error-boundary-reload-btn"
              type="button"
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all duration-200 text-sm shadow-lg shadow-red-900/30 cursor-pointer active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
