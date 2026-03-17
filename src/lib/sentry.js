/**
 * Sentry Integration — Error tracking, performance monitoring, and crash reporting
 * 
 * Initialize Sentry early in app lifecycle for:
 * - Unhandled errors and exceptions
 * - Performance monitoring (web vitals, transactions)
 * - Session replay (crashes only, configurable)
 * - Release tracking
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN || process.env.VITE_SENTRY_DSN;
const ENV = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry if DSN is configured
 * Call this once at app startup (main.jsx or App.jsx)
 */
export function initSentry() {
  if (!SENTRY_DSN || ENV === 'test') {
    console.info('[Telemetry] Sentry disabled (no DSN or test env)');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENV,
      
      // Performance monitoring — sample 10% of transactions in prod
      tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
      
      // Session replay — only on errors/crashes (privacy-first)
      integrations: [
        new BrowserTracing({
          // Only track critical routes for performance
          tracePropagationTargets: ['api/', 'base44.'],
        }),
        new Sentry.Replay({
          maskAllText: true,        // Scrub all text
          blockAllMedia: true,      // No media recording
          maskAllInputs: true,      // Hide form inputs
        }),
      ],
      
      // Only replay on errors (not all sessions)
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0.0,
      
      // Release tracking
      release: process.env.REACT_APP_VERSION || 'unknown',
      
      // Ignore known non-critical errors
      ignoreErrors: [
        // Browser extensions
        /top\.GLOBALS/,
        // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        // Network-related (handled separately)
        /NetworkError/i,
      ],
    });

    console.info('[Telemetry] Sentry initialized', { env: ENV });
  } catch (error) {
    console.error('[Telemetry] Failed to initialize Sentry:', error);
  }
}

/**
 * Capture exception with context
 */
export function captureError(error, context = {}) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, {
    tags: {
      severity: context.severity || 'error',
      context: context.context || 'app',
    },
    extra: context.extra || {},
  });
}

/**
 * Capture message (info, warning, error)
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
}

/**
 * Set user context (call after login)
 */
export function setUserContext(user) {
  if (!SENTRY_DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  
  Sentry.setUser({
    id: user.email,
    email: user.email,
    username: user.full_name,
  });
}

/**
 * Set app context
 */
export function setAppContext(context) {
  if (!SENTRY_DSN) return;
  Sentry.setContext('app', context);
}

/**
 * Add breadcrumb for user actions
 */
export function addBreadcrumb(message, category, data = {}) {
  if (!SENTRY_DSN) return;
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}