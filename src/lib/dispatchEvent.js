/**
 * Canonical dispatch_event for core.fact_dispatch_event (Iteration 3).
 * Schema: Azure Analysis/dispatch_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import {
  isPreciseLocationAllowedForCanonicalIngest,
} from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';
import { normalizeConnectivityState } from '@/lib/connectivityState';

/** Must match properties in Azure Analysis/dispatch_event.json (incl. Iteration 2 extensions) */
export const DISPATCH_EVENT_PROPERTY_KEYS = [
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
  'dispatch_id',
  'technician_id',
  'site_id',
  'connectivity_state',
  'telemetry_consent',
  'location',
  'status',
  'assignment_id',
  'accept_flag',
  'decline_flag',
  'offer_timestamp',
  'response_timestamp',
  'cancel_timestamp',
  'planned_eta_timestamp',
  'eta_ack_timestamp',
  'eta_update_timestamp',
  'route_departure_timestamp',
  'scheduled_start_timestamp',
  'location_consent_state',
  'location_precise_allowed',
];

const DISPATCH_SCHEMA_VERSION = '1.0.0';

const REQUIRED_DISPATCH = [
  'event_id',
  'schema_version',
  'event_name',
  'event_ts_utc',
  'client_ts',
  'source_system',
  'job_id',
  'technician_id',
  'status',
];

/**
 * Map app Job.status to dispatch_event.json status enum.
 */
export function mapAppJobStatusToDispatchStatus(appStatus) {
  const s = appStatus == null ? '' : String(appStatus);
  const map = {
    assigned: 'assigned',
    en_route: 'enroute',
    checked_in: 'arrived',
    in_progress: 'in_progress',
    paused: 'in_progress',
    pending_closeout: 'in_progress',
    submitted: 'completed',
    approved: 'completed',
    rejected: 'cancelled',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    declined: 'declined',
    rescheduled: 'rescheduled',
  };
  return map[s] || 'in_progress';
}

function scheduledStartIso(job) {
  if (!job?.scheduled_date) return null;
  const date = job.scheduled_date;
  const time = job.scheduled_time || '09:00';
  try {
    const d = new Date(`${date}T${time}:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Keep only keys allowed by dispatch_event schema (additionalProperties: false).
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
export function pickDispatchSchemaFields(obj) {
  const allow = new Set(DISPATCH_EVENT_PROPERTY_KEYS);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (allow.has(k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {void}
 */
export function assertDispatchEventRequired(payload) {
  const missing = REQUIRED_DISPATCH.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `dispatch_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) {
      console.error('[dispatchEvent]', msg, payload);
    }
    throw new Error(msg);
  }
  if (payload.event_name !== 'dispatch_event') {
    throw new Error('dispatch_event: event_name must be dispatch_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('dispatch_event: source_system must be field_app');
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {string} opts.targetAppStatus - Status after this transition (app model)
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {Record<string, unknown> | null} [opts.location] - Precise coords only if consent granted (caller may pass)
 * @param {Partial<Record<string, unknown>>} [opts.overrides] - Optional flags/timestamps from schema
 */
export function buildDispatchEventPayload({
  job,
  targetAppStatus,
  user = null,
  location = null,
  overrides = {},
}) {
  const now = new Date();
  const nowIso = now.toISOString();
  const dispatchStatus = mapAppJobStatusToDispatchStatus(targetAppStatus);

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: DISPATCH_SCHEMA_VERSION,
    event_name: 'dispatch_event',
    event_ts_utc: nowIso,
    client_ts: nowIso,
    source_system: 'field_app',
    job_id: job?.id != null ? String(job.id) : '',
    technician_id: getTechnicianIdForCanonicalEvents(user),
    status: dispatchStatus,
    connectivity_state: normalizeConnectivityState(),
    telemetry_consent: {
      location: isPreciseLocationAllowedForCanonicalIngest(),
      device: isTelemetryEnabled(),
    },
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }
  const deviceId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_device_id') : null;
  if (deviceId) {
    payload.device_id = deviceId;
  }

  const sched = scheduledStartIso(job);
  if (sched) {
    payload.scheduled_start_timestamp = sched;
  }

  if (
    location &&
    typeof location === 'object' &&
    isPreciseLocationAllowedForCanonicalIngest()
  ) {
    const lat = location.lat ?? location.latitude;
    const lon = location.lon ?? location.longitude;
    if (lat != null && lon != null) {
      payload.location = {
        lat: Number(lat),
        lon: Number(lon),
        ...(location.accuracy_m != null ? { accuracy_m: Number(location.accuracy_m) } : {}),
      };
    }
  }

  if (overrides && typeof overrides === 'object') {
    Object.assign(payload, overrides);
  }

  return pickDispatchSchemaFields(payload);
}

/**
 * Finalize (consent strip + snapshot), allowlist to schema, validate, enqueue.
 */
export async function emitDispatchEventForJobStatusChange({
  job,
  targetAppStatus,
  user = null,
  location = null,
  overrides = {},
}) {
  const built = buildDispatchEventPayload({
    job,
    targetAppStatus,
    user,
    location,
    overrides,
  });
  assertDispatchEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: DISPATCH_EVENT_PROPERTY_KEYS });
}
