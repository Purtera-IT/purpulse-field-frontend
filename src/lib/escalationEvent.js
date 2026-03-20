/**
 * Canonical escalation_event → core.fact_escalation_event (Iteration 9).
 * Schema: Azure Analysis/escalation_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';

/** @type {string[]} */
export const ESCALATION_EVENT_PROPERTY_KEYS = [
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
  'escalation_created_timestamp',
  'escalation_resolved_timestamp',
  'reason_category',
  'escalation_source',
  'severity',
  'escalation_record_id',
  'notes_preview',
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
  'escalation_created_timestamp',
  'reason_category',
  'escalation_source',
];

const SOURCES = new Set(['blocker_create', 'pm_chat', 'runbook_escalation']);

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
export function assertEscalationEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `escalation_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[escalationEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'escalation_event') {
    throw new Error('escalation_event: event_name must be escalation_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('escalation_event: source_system must be field_app');
  }
  if (!SOURCES.has(payload.escalation_source)) {
    throw new Error('escalation_event: escalation_source invalid');
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job - at least { id }
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {string} opts.reasonCategory
 * @param {'blocker_create'|'pm_chat'|'runbook_escalation'} opts.escalationSource
 * @param {string} [opts.createdTimestampIso]
 * @param {string | null} [opts.severity]
 * @param {string | null} [opts.escalationRecordId]
 * @param {string | null} [opts.notesPreview] - truncated by caller if needed
 * @param {string | null} [opts.resolvedTimestampIso]
 */
export function buildEscalationEventPayload({
  job,
  user = null,
  reasonCategory,
  escalationSource,
  createdTimestampIso = null,
  severity = null,
  escalationRecordId = null,
  notesPreview = null,
  resolvedTimestampIso = null,
}) {
  const nowIso = new Date().toISOString();
  const createdTs = createdTimestampIso || nowIso;
  const techId = getTechnicianIdForCanonicalEvents(user);
  const cat = reasonCategory != null ? String(reasonCategory).trim() : '';

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'escalation_event',
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
    escalation_created_timestamp: createdTs,
    reason_category: cat || 'unknown',
    escalation_source: escalationSource,
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }
  if (severity != null && String(severity).trim() !== '') {
    payload.severity = String(severity).trim();
  }
  if (escalationRecordId != null && String(escalationRecordId) !== '') {
    payload.escalation_record_id = String(escalationRecordId);
  }
  if (notesPreview != null && String(notesPreview).trim() !== '') {
    const s = String(notesPreview).trim();
    payload.notes_preview = s.length > 500 ? `${s.slice(0, 497)}...` : s;
  }
  if (resolvedTimestampIso != null && resolvedTimestampIso !== '') {
    payload.escalation_resolved_timestamp = String(resolvedTimestampIso);
  }

  appendDeviceSession(payload);
  return pickKeys(payload, ESCALATION_EVENT_PROPERTY_KEYS);
}

export async function emitEscalationEvent(opts) {
  const built = buildEscalationEventPayload(opts);
  assertEscalationEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: ESCALATION_EVENT_PROPERTY_KEYS });
}
