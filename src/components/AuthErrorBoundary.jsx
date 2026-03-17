/**
 * AuthErrorBoundary — Unified error screen for auth failures
 * 
 * Displays when:
 * - authError.type === 'auth_required'
 * - User is not authenticated
 * - Session has expired
 * 
 * Provides:
 * - Clear explanation of what happened
 * - Manual retry button to checkAppState
 * - Offline fallback option (if cached user exists)
 * - Diagnostics info for debugging
 */

import React, { useState } from 'react';
import { AlertCircle, RefreshCw, WifiOff, HelpCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getCachedUserForOffline, getOfflineModeDebugInfo } from '@/lib/offlineAuth';

export default function AuthErrorBoundary() {
  const { authError, checkAppState, navigateToLogin } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const cachedUser = getCachedUserForOffline();

  if (!authError) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await checkAppState();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleLogin = () => {
    navigateToLogin();
  };

  const errorConfig = {
    auth_required: {
      title: 'Session Expired',
      description: 'Your session has expired. Please log in again to continue.',
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    user_not_registered: {
      title: 'Access Denied',
      description: 'Your account is not registered for this app. Contact your administrator.',
      icon: AlertCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    unknown: {
      title: 'Authentication Error',
      description: 'An unexpected error occurred. Please try again.',
      icon: AlertCircle,
      color: 'text-slate-600',
      bg: 'bg-slate-50',
      borderColor: 'border-slate-200',
    },
  };

  const config = errorConfig[authError.type] || errorConfig.unknown;
  const Icon = config.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className={`${config.bg} border ${config.borderColor} rounded-2xl shadow-lg max-w-md w-full p-6 space-y-6`}>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center bg-white`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div>
            <h1 className={`text-lg font-bold ${config.color}`}>{config.title}</h1>
            <p className="text-sm text-slate-600">{authError.type}</p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <p className="text-slate-700 leading-relaxed">{config.description}</p>

          {/* Error details (if available) */}
          {authError.message && authError.message !== config.description && (
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 font-mono break-words">{authError.message}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Primary CTA: Login */}
          <button
            onClick={handleLogin}
            className="w-full h-12 rounded-lg bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2"
          >
            Log In
          </button>

          {/* Secondary CTA: Retry */}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full h-12 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry Connection'}
          </button>

          {/* Tertiary: Offline fallback (if available) */}
          {cachedUser && (
            <button
              onClick={() => window.location.href = '/'}
              className="w-full h-12 rounded-lg border-2 border-amber-300 text-amber-700 font-semibold flex items-center justify-center gap-2 hover:bg-amber-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
            >
              <WifiOff className="h-4 w-4" />
              Continue Offline (Read-Only)
            </button>
          )}
        </div>

        {/* Debug info toggle */}
        <div className="border-t border-slate-200 pt-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </button>

          {showDebug && (
            <div className="mt-3 p-3 bg-slate-800 rounded-lg text-slate-200 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
              <div>
                <span className="text-slate-400">Error Type:</span> {authError.type}
              </div>
              <div>
                <span className="text-slate-400">Timestamp:</span> {new Date().toISOString()}
              </div>
              <div>
                <span className="text-slate-400">Offline Mode:</span> {getOfflineModeDebugInfo().allowed ? 'Enabled' : 'Disabled'}
              </div>
              <div>
                <span className="text-slate-400">Cached User:</span> {cachedUser ? cachedUser.email : 'None'}
              </div>
              {authError.message && (
                <div>
                  <span className="text-slate-400">Message:</span> {authError.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 border-t border-slate-200 pt-4">
          <p>If problems persist, contact support or check your network connection.</p>
        </div>
      </div>
    </div>
  );
}