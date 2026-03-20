/**
 * Canonical feedback_event → core.fact_feedback_event (Iteration 9).
 * Schema: Azure Analysis/feedback_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';

/** @type {string[]} */
export const FEEDBACK_EVENT_PROPERTY_KEYS = [
  'event_id',
  'schema_version',
  'event_name',
  'event_ts_utc',
  'client_ts',
  'source_system',
  'project_id',
  'device_id',
  'session_id',
  'job_id',
  'technician_id',
  'site_id',
  'connectivity_state',
  'telemetry_consent',
  'location',
  'location_consent_state',
  'location_precise_allowed',
  'feedback_timestamp',
  'feedback_source',
  'rating_value',
  'complaint_flag',
  'compliment_flag',
  'feedback_notes',
];

const SCHEMA_VERSION = '1.0.0';

const REQUIRED = [
  'event_id',
  'schema_version',
  'event_name',
  'event_ts_utc',
  'client_ts',
  'source_system',
  'job_id',
  'technician_id',
  'feedback_timestamp',
  'complaint_flag',
  'compliment_flag',
];

const FEEDBACK_SOURCES = new Set(['signoff', 'closeout', 'standalone']);

function pickKeys(obj, keys) {
  const allow = new Set(keys);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (allow.has(k)) out[k] = obj[k];
  }
  return out;
}

function appendDeviceSession(payload) {
  const deviceId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_device_id') : null;
  if (deviceId) payload.device_id = deviceId;
  const sessionId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_session_id') : null;
  if (sessionId) payload.session_id = sessionId;
}

/**
 * @param {Record<string, unknown>} payload
 */
export function assertFeedbackEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `feedback_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[feedbackEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'feedback_event') {
    throw new Error('feedback_event: event_name must be feedback_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('feedback_event: source_system must be field_app');
  }
  if (typeof payload.complaint_flag !== 'boolean' || typeof payload.compliment_flag !== 'boolean') {
    throw new Error('feedback_event: complaint_flag and compliment_flag must be boolean');
  }
  if (payload.rating_value != null) {
    const r = Number(payload.rating_value);
    if (Number.isNaN(r) || r < 1 || r > 5) {
      throw new Error('feedback_event: rating_value must be 1–5 or null');
    }
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {number | null} [opts.ratingValue] - 1–5
 * @param {boolean} [opts.complaintFlag]
 * @param {boolean} [opts.complimentFlag]
 * @param {string | null} [opts.feedbackNotes]
 * @param {'signoff'|'closeout'|'standalone'|null} [opts.feedbackSource]
 * @param {string} [opts.feedbackTimestampIso]
 */
export function buildFeedbackEventPayload({
  job,
  user = null,
  ratingValue = null,
  complaintFlag = false,
  complimentFlag = false,
  feedbackNotes = null,
  feedbackSource = null,
  feedbackTimestampIso = null,
}) {
  const nowIso = new Date().toISOString();
  const fbTs = feedbackTimestampIso || nowIso;
  const techId = getTechnicianIdForCanonicalEvents(user);

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'feedback_event',
    event_ts_utc: nowIso,
    client_ts: nowIso,
    source_system: 'field_app',
    job_id: job?.id != null ? String(job.id) : '',
    technician_id: techId,
    connectivity_state: normalizeConnectivityState(),
    telemetry_consent: {
      location: isPreciseLocationAllowedForCanonicalIngest(),
      device: isTelemetryEnabled(),
    },
    feedback_timestamp: fbTs,
    complaint_flag: Boolean(complaintFlag),
    compliment_flag: Boolean(complimentFlag),
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }

  if (ratingValue != null && !Number.isNaN(Number(ratingValue))) {
    const r = Math.round(Number(ratingValue));
    if (r >= 1 && r <= 5) payload.rating_value = r;
  }
  if (feedbackSource != null && FEEDBACK_SOURCES.has(String(feedbackSource))) {
    payload.feedback_source = feedbackSource;
  }
  if (feedbackNotes != null && String(feedbackNotes).trim() !== '') {
    const s = String(feedbackNotes).trim();
    payload.feedback_notes = s.length > 2000 ? `${s.slice(0, 1997)}...` : s;
  }

  appendDeviceSession(payload);
  return pickKeys(payload, FEEDBACK_EVENT_PROPERTY_KEYS);
}

export async function emitFeedbackEvent(opts) {
  const built = buildFeedbackEventPayload(opts);
  assertFeedbackEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: FEEDBACK_EVENT_PROPERTY_KEYS });
}
