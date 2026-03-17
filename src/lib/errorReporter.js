/**
 * errorReporter — Centralized error reporting and logging
 * Sends errors to Sentry for production monitoring
 */

import { captureError, captureMessage, addBreadcrumb } from './sentry';

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export async function reportError({
  error,
  context = 'unknown',
  errorInfo = null,
  severity = 'error',
  userInitiated = false,
  extra = {},
}) {
  const errorPayload = {
    timestamp: new Date().toISOString(),
    context,
    message: error?.message || String(error),
    stack: error?.stack || '',
    errorInfo,
    severity,
    userInitiated,
    extra,
    // Add device/user info if available
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
  };

  // Log in development
  if (isDev) {
    console.group(`[${severity.toUpperCase()}] ${context}`);
    console.error(errorPayload);
    console.groupEnd();
  }

  // Send to Sentry
  if (!isTest) {
    try {
      captureError(error, {
        context,
        severity,
        extra: { ...extra, errorInfo, userInitiated },
      });
    } catch (e) {
      console.error('[Sentry] Failed to report error:', e);
    }
  }

  return errorPayload;
}

/**
 * reportNetworkError — Helper for API/network errors
 */
export async function reportNetworkError({
  error,
  method = 'UNKNOWN',
  url = '',
  status = null,
  context = 'network_request',
  retryCount = 0,
  shouldRetry = false,
}) {
  const message = `${method} ${url} - ${status || error?.message || 'Unknown error'}`;

  return reportError({
    error: new Error(message),
    context,
    severity: status >= 500 ? 'error' : 'warn',
    extra: {
      method,
      url,
      status,
      retryCount,
      shouldRetry,
      response: error?.response?.data,
    },
  });
}