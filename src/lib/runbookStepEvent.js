/**
 * Canonical runbook_step_event → core.fact_runbook_step_event (Iteration 6).
 * Schema: Azure Analysis/runbook_step_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import {
  isPreciseLocationAllowedForCanonicalIngest,
} from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';

/** @type {string[]} */
export const RUNBOOK_STEP_EVENT_PROPERTY_KEYS = [
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
  'step_instance_id',
  'runbook_version',
  'duration_minutes',
  'step_outcome',
  'step_family',
  'phase_id',
  'step_title',
  'rework_flag',
  'blocker_flag',
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
  'step_instance_id',
  'runbook_version',
  'duration_minutes',
  'step_outcome',
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
export function assertRunbookStepEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `runbook_step_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[runbookStepEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'runbook_step_event') {
    throw new Error('runbook_step_event: event_name must be runbook_step_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('runbook_step_event: source_system must be field_app');
  }
  if (typeof payload.duration_minutes !== 'number' || payload.duration_minutes < 0) {
    throw new Error('runbook_step_event: duration_minutes must be a non-negative number');
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {Record<string, unknown>} opts.step - must include id; name or title for step_title
 * @param {Record<string, unknown>} [opts.phaseMeta] - e.g. { sr_version, template_id }
 * @param {string} [opts.phaseId]
 * @param {'started'|'pass'|'fail'|'fail_remediated'|'overridden'|'escalated'} opts.stepOutcome
 * @param {number} opts.durationMinutes
 * @param {boolean | null} [opts.reworkFlag]
 * @param {boolean | null} [opts.blockerFlag]
 */
export function buildRunbookStepEventPayload({
  job,
  user = null,
  step,
  phaseMeta = {},
  phaseId = null,
  stepOutcome,
  durationMinutes,
  reworkFlag = null,
  blockerFlag = null,
}) {
  const nowIso = new Date().toISOString();
  const stepId = step?.id != null ? String(step.id) : '';
  const title = step?.name ?? step?.title ?? null;
  const family = step?.step_family ?? step?.family ?? step?.category ?? null;
  const rbVersion =
    (typeof phaseMeta.sr_version === 'string' && phaseMeta.sr_version) ||
    (typeof job?.runbook_version === 'string' && job.runbook_version) ||
    '0.0.0';

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'runbook_step_event',
    event_ts_utc: nowIso,
    client_ts: nowIso,
    source_system: 'field_app',
    job_id: job?.id != null ? String(job.id) : '',
    technician_id: getTechnicianIdForCanonicalEvents(user),
    connectivity_state: normalizeConnectivityState(),
    telemetry_consent: {
      location: isPreciseLocationAllowedForCanonicalIngest(),
      device: isTelemetryEnabled(),
    },
    step_instance_id: stepId,
    runbook_version: rbVersion,
    duration_minutes: Math.max(0, Number(durationMinutes) || 0),
    step_outcome: stepOutcome,
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

  if (title) payload.step_title = String(title);
  if (family) payload.step_family = String(family);
  if (phaseId) payload.phase_id = String(phaseId);

  if (reworkFlag === true || reworkFlag === false) payload.rework_flag = reworkFlag;
  if (blockerFlag === true || blockerFlag === false) payload.blocker_flag = blockerFlag;

  return pickKeys(payload, RUNBOOK_STEP_EVENT_PROPERTY_KEYS);
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {Record<string, unknown>} opts.step
 * @param {Record<string, unknown>} [opts.phaseMeta]
 * @param {string} [opts.phaseId]
 * @param {'started'|'pass'|'fail'|'fail_remediated'|'overridden'|'escalated'} opts.stepOutcome
 * @param {number} opts.durationMinutes
 * @param {boolean | null} [opts.reworkFlag]
 * @param {boolean | null} [opts.blockerFlag]
 */
export async function emitRunbookStepEvent(opts) {
  const built = buildRunbookStepEventPayload(opts);
  assertRunbookStepEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: RUNBOOK_STEP_EVENT_PROPERTY_KEYS });
}
