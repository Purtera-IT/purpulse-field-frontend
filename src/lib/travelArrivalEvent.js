/**
 * Canonical travel_event / arrival_event → core.fact_travel_event / core.fact_arrival_event (Iteration 4).
 * Schemas: Azure Analysis/travel_event.json, arrival_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import {
  isPreciseLocationAllowedForCanonicalIngest,
} from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';
import { SCOPE_ACKNOWLEDGEMENT_KEYS } from '@/constants/scopeAcknowledgements';

/** @type {string[]} */
export const TRAVEL_EVENT_PROPERTY_KEYS = [
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
  'route_departure_timestamp',
  'geofence_arrival_timestamp',
  'travel_minutes',
  'planned_eta_timestamp',
  'eta_ack_timestamp',
  'eta_update_timestamp',
  'location_consent_state',
  'location_precise_allowed',
];

/** @type {string[]} */
export const ARRIVAL_EVENT_PROPERTY_KEYS = [
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
  'checkin_timestamp',
  'geofence_arrival_timestamp',
  'work_start_timestamp',
  'access_granted_timestamp',
  'location_consent_state',
  'location_precise_allowed',
  'required_docs_opened_flag',
  'risk_flag_ack_flag',
  'customer_notes_review_flag',
  'site_constraint_ack_flag',
  'step_sequence_preview_flag',
];

const SCHEMA_VERSION = '1.0.0';

const REQUIRED_BASE = [
  'event_id',
  'schema_version',
  'event_name',
  'event_ts_utc',
  'client_ts',
  'source_system',
  'job_id',
  'technician_id',
];

function pickKeys(obj, keys) {
  const allow = new Set(keys);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (allow.has(k)) out[k] = obj[k];
  }
  return out;
}

/**
 * @param {Record<string, unknown>} payload
 */
export function assertTravelEventRequired(payload) {
  const missing = REQUIRED_BASE.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `travel_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[travelArrivalEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'travel_event') {
    throw new Error('travel_event: event_name must be travel_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('travel_event: source_system must be field_app');
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
export function assertArrivalEventRequired(payload) {
  const missing = REQUIRED_BASE.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `arrival_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[travelArrivalEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'arrival_event') {
    throw new Error('arrival_event: event_name must be arrival_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('arrival_event: source_system must be field_app');
  }
  for (const k of SCOPE_ACKNOWLEDGEMENT_KEYS) {
    if (payload[k] != null && typeof payload[k] !== 'boolean') {
      throw new Error(`arrival_event: ${k} must be boolean or null/omitted`);
    }
  }
}

/**
 * Planned on-site ETA from job schedule (for travel_event.planned_eta_timestamp).
 * @param {Record<string, unknown>} job
 * @returns {string | null} ISO
 */
export function plannedEtaIsoFromJob(job) {
  if (!job?.scheduled_date) return null;
  const raw = String(job.scheduled_date);
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
  const time = job.scheduled_time || '09:00';
  try {
    const d = new Date(`${datePart}T${time}:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, boolean> | null | undefined} acks
 */
function attachScopeAcknowledgementsToArrivalPayload(base, acks) {
  if (!acks || typeof acks !== 'object') return;
  for (const k of SCOPE_ACKNOWLEDGEMENT_KEYS) {
    if (acks[k] === true) base[k] = true;
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {string} opts.timestampIso
 * @param {string} opts.eventName
 */
function buildSharedBase({ job, user, timestampIso, eventName }) {
  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: eventName,
    event_ts_utc: timestampIso,
    client_ts: timestampIso,
    source_system: 'field_app',
    job_id: job?.id != null ? String(job.id) : '',
    technician_id: getTechnicianIdForCanonicalEvents(user),
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
  if (deviceId) payload.device_id = deviceId;

  const sessionId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_session_id') : null;
  if (sessionId) payload.session_id = sessionId;

  return payload;
}

function attachLocation(payload, location) {
  if (
    !location ||
    typeof location !== 'object' ||
    !isPreciseLocationAllowedForCanonicalIngest()
  ) {
    return;
  }
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

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {string} opts.timestampIso
 * @param {string | null} [opts.routeDeparture]
 * @param {string | null} [opts.geofenceArrival] - Iteration 4: travel segment end (no geofence UX).
 * @param {number | null} [opts.travelMinutes]
 * @param {Record<string, unknown> | null} [opts.location]
 * @param {string | null} [opts.plannedEtaTimestamp] - defaults from job schedule when omitted
 * @param {string | null} [opts.etaAckTimestamp] - Iteration 11: technician acknowledged ETA / route
 */
export function buildTravelEventPayload({
  job,
  user = null,
  timestampIso,
  routeDeparture = null,
  geofenceArrival = null,
  travelMinutes = null,
  location = null,
  plannedEtaTimestamp = null,
  etaAckTimestamp = null,
}) {
  const base = buildSharedBase({ job, user, timestampIso, eventName: 'travel_event' });
  if (routeDeparture) base.route_departure_timestamp = routeDeparture;
  if (geofenceArrival) base.geofence_arrival_timestamp = geofenceArrival;
  if (travelMinutes != null && Number.isFinite(travelMinutes)) {
    base.travel_minutes = travelMinutes;
  }
  const planned = plannedEtaTimestamp ?? plannedEtaIsoFromJob(job);
  if (planned) base.planned_eta_timestamp = planned;
  if (etaAckTimestamp) base.eta_ack_timestamp = etaAckTimestamp;
  attachLocation(base, location);
  return pickKeys(base, TRAVEL_EVENT_PROPERTY_KEYS);
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {string} opts.timestampIso
 * @param {string | null} [opts.checkin]
 * @param {string | null} [opts.workStart]
 * @param {string | null} [opts.accessGranted]
 * @param {Record<string, unknown> | null} [opts.location]
 * @param {Record<string, boolean> | null} [opts.arrivalScopeAcknowledgements] - Iteration 11 flags (true only)
 */
export function buildArrivalEventPayload({
  job,
  user = null,
  timestampIso,
  checkin = null,
  workStart = null,
  accessGranted = null,
  location = null,
  arrivalScopeAcknowledgements = null,
}) {
  const base = buildSharedBase({ job, user, timestampIso, eventName: 'arrival_event' });
  if (checkin) base.checkin_timestamp = checkin;
  if (workStart) base.work_start_timestamp = workStart;
  if (accessGranted) base.access_granted_timestamp = accessGranted;
  attachScopeAcknowledgementsToArrivalPayload(base, arrivalScopeAcknowledgements);
  attachLocation(base, location);
  return pickKeys(base, ARRIVAL_EVENT_PROPERTY_KEYS);
}

/**
 * Emit canonical telemetry for TimeEntry-style types (TimeLog / TimerPanel).
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {string} opts.entryType - travel_start | travel_end | work_start
 * @param {string} opts.timestamp - ISO
 * @param {number | null} [opts.travelMinutes]
 * @param {Record<string, unknown> | null} [opts.location]
 * @param {string | null} [opts.etaAckTimestamp] - travel_start: recorded when user confirms ETA sheet
 * @param {Record<string, boolean> | null} [opts.arrivalScopeAcknowledgements] - travel_end arrival row
 * @returns {Promise<string | null>} last enqueued event_id or null if no emit
 */
export async function emitCanonicalEventsForTimeEntry({
  job,
  user = null,
  entryType,
  timestamp,
  travelMinutes = null,
  location = null,
  etaAckTimestamp = null,
  arrivalScopeAcknowledgements = null,
}) {
  const ts = timestamp || new Date().toISOString();

  if (entryType === 'travel_start') {
    const p = buildTravelEventPayload({
      job,
      user,
      timestampIso: ts,
      routeDeparture: ts,
      location,
      etaAckTimestamp: etaAckTimestamp ?? null,
    });
    assertTravelEventRequired(p);
    return enqueueCanonicalEvent(p, { allowlistKeys: TRAVEL_EVENT_PROPERTY_KEYS });
  }

  if (entryType === 'travel_end') {
    const t = buildTravelEventPayload({
      job,
      user,
      timestampIso: ts,
      geofenceArrival: ts,
      travelMinutes,
      location,
    });
    assertTravelEventRequired(t);
    await enqueueCanonicalEvent(t, { allowlistKeys: TRAVEL_EVENT_PROPERTY_KEYS });

    const a = buildArrivalEventPayload({
      job,
      user,
      timestampIso: ts,
      checkin: ts,
      location,
      arrivalScopeAcknowledgements,
    });
    assertArrivalEventRequired(a);
    return enqueueCanonicalEvent(a, { allowlistKeys: ARRIVAL_EVENT_PROPERTY_KEYS });
  }

  if (entryType === 'work_start') {
    const a = buildArrivalEventPayload({
      job,
      user,
      timestampIso: ts,
      workStart: ts,
      location,
      arrivalScopeAcknowledgements,
    });
    assertArrivalEventRequired(a);
    return enqueueCanonicalEvent(a, { allowlistKeys: ARRIVAL_EVENT_PROPERTY_KEYS });
  }

  return null;
}

/**
 * Field v2 activity: clock_in → site check-in (arrival).
 */
/**
 * Minutes from the latest open travel_start for this job to endIso (exclusive of entries at/after end).
 * @param {Array<{ entry_type?: string, timestamp?: string, job_id?: string }>} entries
 * @param {string} jobId
 * @param {string} endIso
 * @returns {number | null}
 */
export function computeOpenTravelMinutesForJob(entries, jobId, endIso) {
  const forJob = [...(entries || [])]
    .filter((e) => e.job_id === jobId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let lastStart = null;
  const endT = new Date(endIso).getTime();
  for (const e of forJob) {
    const t = new Date(e.timestamp).getTime();
    if (t >= endT) break;
    if (e.entry_type === 'travel_start') lastStart = t;
    if (e.entry_type === 'travel_end') lastStart = null;
  }
  if (lastStart == null) return null;
  return Math.round(((endT - lastStart) / 60000) * 100) / 100;
}

/**
 * @param {Object} opts
 * @param {Record<string, boolean> | null} [opts.arrivalScopeAcknowledgements]
 */
export async function emitArrivalForClockIn({
  job,
  user = null,
  timestamp,
  location = null,
  arrivalScopeAcknowledgements = null,
}) {
  const ts = timestamp || new Date().toISOString();
  const a = buildArrivalEventPayload({
    job,
    user,
    timestampIso: ts,
    checkin: ts,
    location,
    arrivalScopeAcknowledgements,
  });
  assertArrivalEventRequired(a);
  return enqueueCanonicalEvent(a, { allowlistKeys: ARRIVAL_EVENT_PROPERTY_KEYS });
}
