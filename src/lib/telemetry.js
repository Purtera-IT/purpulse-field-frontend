/**
 * Telemetry — Lightweight event tracking with privacy-first design
 * 
 * Features:
 * - Opt-in consent (default: disabled until user agrees)
 * - Automatic PII scrubbing
 * - Uses Base44 analytics + Sentry (if configured)
 * - Events: job_check_in, evidence_upload_*, time_clock_*, runbook_step_complete
 * 
 * Privacy:
 * - No location data, no device identifiers, no IP logging
 * - User consent stored in localStorage (can be revoked)
 * - PII fields automatically scrubbed from all events
 */

import { base44 } from '@/api/base44Client';
import { addBreadcrumb, captureMessage } from './sentry';

// ── Config ────────────────────────────────────────────────────────────
const TELEMETRY_ENABLED_KEY = 'purpulse_telemetry_enabled';
const TELEMETRY_VERSION = '1.0';

// PII fields that should NEVER be sent
const PII_FIELDS = ['email', 'phone', 'address', 'lat', 'lon', 'location', 'name', 'user_id', 'technician_email'];

// Critical events that are always logged (no opt-in needed)
const CRITICAL_EVENTS = ['error', 'crash'];

// ── Consent Management ────────────────────────────────────────────────
/**
 * Check if user has opted into telemetry
 */
export function isTelemetryEnabled() {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(TELEMETRY_ENABLED_KEY);
  return stored === 'true';
}

/**
 * Set telemetry consent (user-initiated)
 */
export function setTelemetryConsent(enabled) {
  localStorage.setItem(TELEMETRY_ENABLED_KEY, String(enabled));
  console.info('[Telemetry]', enabled ? 'enabled' : 'disabled');
  
  if (enabled) {
    // Log that user opted in (this event is always sent)
    trackEvent('telemetry_opt_in', { version: TELEMETRY_VERSION });
  }
}

// ── PII Scrubbing ────────────────────────────────────────────────────
/**
 * Recursively scrub PII from event payload
 */
function scrubPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => scrubPII(item));
  }

  const scrubbed = { ...obj };
  for (const key of Object.keys(scrubbed)) {
    if (PII_FIELDS.some(piiField => key.toLowerCase().includes(piiField.toLowerCase()))) {
      scrubbed[key] = '[SCRUBBED]';
    } else if (typeof scrubbed[key] === 'object') {
      scrubbed[key] = scrubPII(scrubbed[key]);
    }
  }
  return scrubbed;
}

// ── Event Tracking ────────────────────────────────────────────────────
/**
 * Track a telemetry event
 * @param {string} eventName - Event identifier (e.g., 'job_check_in')
 * @param {object} properties - Event properties (will be PII-scrubbed)
 * @param {object} options - { critical: false, context: 'app' }
 */
export async function trackEvent(eventName, properties = {}, options = {}) {
  const isCritical = options.critical || CRITICAL_EVENTS.includes(eventName);
  const isEnabled = isTelemetryEnabled() || isCritical;

  if (!isEnabled) return;

  // Scrub PII
  const scrubbed = scrubPII(properties);

  try {
    // Send to Base44 analytics
    base44.analytics.track({
      eventName,
      properties: {
        ...scrubbed,
        telemetry_version: TELEMETRY_VERSION,
        timestamp: new Date().toISOString(),
      },
    });

    // Add breadcrumb to Sentry if available
    addBreadcrumb(eventName, 'analytics', scrubbed);

    if (process.env.NODE_ENV === 'development') {
      console.info(`[Telemetry] ${eventName}`, scrubbed);
    }
  } catch (error) {
    console.warn('[Telemetry] Failed to track event:', error);
  }
}

// ── Field Operations ────────────────────────────────────────────────
/**
 * Job check-in started
 */
export function telemetryJobCheckIn(jobId, checkInMethod = 'gps') {
  trackEvent('job_check_in', {
    job_id: jobId,
    check_in_method: checkInMethod, // 'gps', 'manual'
  });
}

/**
 * Evidence upload started
 */
export function telemetryEvidenceUploadStart(jobId, evidenceType, fileSizeKB) {
  trackEvent('evidence_upload_start', {
    job_id: jobId,
    evidence_type: evidenceType,
    file_size_kb: fileSizeKB,
  });
}

/**
 * Evidence upload completed
 */
export function telemetryEvidenceUploadComplete(jobId, evidenceType, fileSizeKB, durationMs, success = true) {
  trackEvent('evidence_upload_complete', {
    job_id: jobId,
    evidence_type: evidenceType,
    file_size_kb: fileSizeKB,
    duration_ms: durationMs,
    success,
  });
}

/**
 * Evidence upload failed
 */
export function telemetryEvidenceUploadError(jobId, evidenceType, error) {
  trackEvent('evidence_upload_error', {
    job_id: jobId,
    evidence_type: evidenceType,
    error_type: error?.name || 'unknown',
    error_message: error?.message?.slice(0, 100) || '',
  }, { critical: true });
}

/**
 * Time clock started (work/break/travel)
 */
export function telemetryTimeClockStart(jobId, entryType) {
  trackEvent('time_clock_start', {
    job_id: jobId,
    entry_type: entryType, // 'work_start', 'break_start', 'travel_start'
  });
}

/**
 * Time clock stopped
 */
export function telemetryTimeClockStop(jobId, entryType, durationSeconds) {
  trackEvent('time_clock_stop', {
    job_id: jobId,
    entry_type: entryType,
    duration_seconds: durationSeconds,
  });
}

/**
 * Runbook step completed
 */
export function telemetryRunbookStepComplete(jobId, stepName, durationSeconds) {
  trackEvent('runbook_step_complete', {
    job_id: jobId,
    step_name: stepName,
    duration_seconds: durationSeconds,
  });
}

/**
 * Job closeout submitted
 */
export function telemetryJobCloseout(jobId, status = 'submitted') {
  trackEvent('job_closeout', {
    job_id: jobId,
    status,
  });
}

/**
 * Blocker created
 */
export function telemetryBlockerCreated(jobId, blockerType, severity) {
  trackEvent('blocker_created', {
    job_id: jobId,
    blocker_type: blockerType,
    severity,
  });
}

/**
 * App crash (always sent, opt-out only)
 */
export function telemetryCrash(errorInfo) {
  trackEvent('crash', {
    error_message: errorInfo?.message?.slice(0, 200) || 'unknown',
    error_type: errorInfo?.name || 'Error',
  }, { critical: true });
}

/**
 * Session start (on app init)
 */
export function telemetrySessionStart(appVersion) {
  trackEvent('session_start', {
    app_version: appVersion,
    session_id: generateSessionId(),
  });
}

/**
 * Session end (on logout or unload)
 */
export function telemetrySessionEnd(durationSeconds) {
  trackEvent('session_end', {
    duration_seconds: durationSeconds,
  });
}

// ── Utilities ─────────────────────────────────────────────────────────
/**
 * Generate a random session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export telemetry consent for diagnostics
 */
export function getTelemetryDiagnostics() {
  return {
    enabled: isTelemetryEnabled(),
    version: TELEMETRY_VERSION,
    consent_timestamp: localStorage.getItem('purpulse_telemetry_consent_ts'),
  };
}