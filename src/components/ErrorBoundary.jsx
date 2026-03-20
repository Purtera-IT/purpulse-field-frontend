/**
 * ErrorBoundary — Top-level error boundary with friendly UI
 * Captures unhandled React errors and provides recovery options
 */
import React from 'react';
import { AlertCircle, RotateCcw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { reportError } from '@/lib/errorReporter';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      reportSent: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in dev
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Update state
    this.setState({
      error,
      errorInfo,
    });

    // Report to error tracking service
    reportError({
      error,
      context: 'react_error_boundary',
      errorInfo: errorInfo.componentStack,
      severity: 'error',
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `${error?.toString()}\n\n${errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(errorText);
  };

  handleReport = async () => {
    const { error, errorInfo } = this.state;
    await reportError({
      error,
      context: 'error_boundary_manual_report',
      errorInfo: errorInfo?.componentStack,
      severity: 'error',
      userInitiated: true,
    });
    this.setState({ reportSent: true });
    setTimeout(() => this.setState({ reportSent: false }), 3000);
  };

  render() {
    const { hasError, error, errorInfo, showDetails, reportSent } = this.state;

    if (!hasError) {
      return this.props.children;
    }

    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-red-50 border-b border-red-100 px-6 py-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h1 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600">
              We've logged this issue and will look into it. Try refreshing or retrying your last action.
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="px-3 py-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Error details</p>
                <p className="text-sm font-mono text-slate-700 break-words whitespace-pre-wrap">
                  {error.toString().split('\n')[0]}
                </p>
              </div>
            )}

            {/* Details toggle (dev only) */}
            {isDev && errorInfo && (
              <button
                onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                className="w-full flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showDetails ? 'Hide' : 'Show'} full details
              </button>
            )}

            {/* Stack trace (dev only) */}
            {isDev && showDetails && errorInfo && (
              <div className="px-3 py-3 rounded-lg bg-slate-900 text-slate-100 border border-slate-700 max-h-[200px] overflow-y-auto">
                <p className="text-[10px] font-mono whitespace-pre-wrap break-words">
                  {errorInfo.componentStack}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleRetry}
                className="h-11 rounded-lg bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors active:scale-95"
              >
                <RotateCcw className="h-4 w-4" /> Try again
              </button>

              <button
                onClick={this.handleCopyError}
                className="h-11 rounded-lg border-2 border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors active:scale-95"
              >
                <Copy className="h-4 w-4" /> Copy error
              </button>
            </div>

            {/* Report status */}
            {reportSent && (
              <div className="text-center text-xs text-emerald-600 font-semibold">
                ✓ Error reported to support team
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 text-center">
            <p className="text-xs text-slate-500 mb-2">Need help? Contact support</p>
            <a
              href="mailto:support@example.com"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              support@example.com
            </a>
          </div>
        </div>
      </div>
    );
  }
}