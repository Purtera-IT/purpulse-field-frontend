/**
 * Canonical job_context_field snapshot → core.fact_job_context_field (Iteration 10).
 * Schema: Azure Analysis/job_context_field.json
 *
 * Dedupe: same `context_fingerprint` for a job_id is not re-emitted (localStorage).
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';

/** @type {string} */
export const JOB_CONTEXT_FINGERPRINT_STORAGE_PREFIX = 'purpulse_jcf_fp_v1_';

/** Logical context schema baked into payload (bump when fingerprint inputs change). */
export const JOB_CONTEXT_SCHEMA_VERSION = '1.1.0';

/** @type {string[]} */
export const JOB_CONTEXT_FIELD_PROPERTY_KEYS = [
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
  'context_snapshot_timestamp',
  'context_fingerprint',
  'context_schema_version',
  'runbook_version',
  'job_status',
  'evidence_requirement_count',
  'runbook_step_count',
  'required_field_count',
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
  'context_snapshot_timestamp',
  'context_fingerprint',
  'context_schema_version',
  'job_status',
  'evidence_requirement_count',
  'runbook_step_count',
  'required_field_count',
];

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
 * Stable string for hashing — keys sorted conceptually via fixed object literal order.
 * @param {Record<string, unknown>} job
 * @param {string} [technicianKey] - stable technician id for dedupe (same job + tech + context → one emit)
 */
export function buildCanonicalJobContextString(job, technicianKey = '') {
  const rv = job?.runbook_version != null ? String(job.runbook_version) : '';
  const st = job?.status != null ? String(job.status) : '';
  const erc = Array.isArray(job?.evidence_requirements) ? job.evidence_requirements.length : 0;
  const phases = Array.isArray(job?.runbook_phases) ? job.runbook_phases : [];
  let rsc = 0;
  for (const p of phases) {
    rsc += Array.isArray(p?.steps) ? p.steps.length : 0;
  }
  const rfc = Array.isArray(job?.fields_schema)
    ? job.fields_schema.filter((f) => f && f.required).length
    : 0;
  const ud = job?.updated_date != null ? String(job.updated_date) : '';
  const tk = technicianKey != null ? String(technicianKey) : '';
  return JSON.stringify({ context_schema_version: JOB_CONTEXT_SCHEMA_VERSION, erc, rfc, rsc, rv, st, ud, tk });
}

/**
 * SHA-256 hex of canonical context string (Web Crypto in browser; Node crypto in tests).
 * @param {Record<string, unknown>} job
 * @param {string} [technicianKey]
 */
export async function computeJobContextFingerprint(job, technicianKey = '') {
  const canonical = buildCanonicalJobContextString(job, technicianKey);
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = new TextEncoder().encode(canonical);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through */
  }
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = Math.imul(h, 33) ^ canonical.charCodeAt(i);
  }
  return `fb_${(h >>> 0).toString(16)}_${canonical.length}`;
}

/**
 * @param {string} jobId
 * @param {string} fingerprint
 */
export function shouldEmitJobContextSnapshot(jobId, fingerprint) {
  if (!jobId || !fingerprint) return false;
  try {
    if (typeof localStorage === 'undefined') return true;
    const k = `${JOB_CONTEXT_FINGERPRINT_STORAGE_PREFIX}${jobId}`;
    return localStorage.getItem(k) !== fingerprint;
  } catch {
    return true;
  }
}

/**
 * @param {string} jobId
 * @param {string} fingerprint
 */
export function markJobContextSnapshotEmitted(jobId, fingerprint) {
  if (!jobId || !fingerprint) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const k = `${JOB_CONTEXT_FINGERPRINT_STORAGE_PREFIX}${jobId}`;
    localStorage.setItem(k, fingerprint);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
export function assertJobContextFieldRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `job_context_field missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[jobContextField]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'job_context_field') {
    throw new Error('job_context_field: event_name must be job_context_field');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('job_context_field: source_system must be field_app');
  }
  for (const n of ['evidence_requirement_count', 'runbook_step_count', 'required_field_count']) {
    const v = payload[n];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw new Error(`job_context_field: ${n} must be non-negative integer`);
    }
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {string} opts.contextFingerprint - from computeJobContextFingerprint
 * @param {string} [opts.contextSnapshotTimestampIso]
 */
export function buildJobContextFieldPayload({
  job,
  user = null,
  contextFingerprint,
  contextSnapshotTimestampIso = null,
}) {
  const nowIso = new Date().toISOString();
  const snapTs = contextSnapshotTimestampIso || nowIso;
  const techId = getTechnicianIdForCanonicalEvents(user);

  const phases = Array.isArray(job?.runbook_phases) ? job.runbook_phases : [];
  let runbookStepCount = 0;
  for (const p of phases) {
    runbookStepCount += Array.isArray(p?.steps) ? p.steps.length : 0;
  }
  const evidenceRequirementCount = Array.isArray(job?.evidence_requirements)
    ? job.evidence_requirements.length
    : 0;
  const requiredFieldCount = Array.isArray(job?.fields_schema)
    ? job.fields_schema.filter((f) => f && f.required).length
    : 0;

  const runbookVersion =
    job?.runbook_version != null && String(job.runbook_version).trim() !== ''
      ? String(job.runbook_version)
      : null;

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'job_context_field',
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
    context_snapshot_timestamp: snapTs,
    context_fingerprint: String(contextFingerprint),
    context_schema_version: JOB_CONTEXT_SCHEMA_VERSION,
    job_status: job?.status != null ? String(job.status) : 'unknown',
    evidence_requirement_count: evidenceRequirementCount,
    runbook_step_count: runbookStepCount,
    required_field_count: requiredFieldCount,
  };

  if (runbookVersion != null) {
    payload.runbook_version = runbookVersion;
  }

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }

  appendDeviceSession(payload);
  return pickKeys(payload, JOB_CONTEXT_FIELD_PROPERTY_KEYS);
}

export async function emitJobContextField(opts) {
  const built = buildJobContextFieldPayload(opts);
  assertJobContextFieldRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: JOB_CONTEXT_FIELD_PROPERTY_KEYS });
}

/**
 * If fingerprint changed since last emit for this job, build + enqueue and mark storage.
 * @param {Object} o
 * @param {Record<string, unknown>} o.job
 * @param {Record<string, unknown> | null} [o.user]
 */
export async function emitJobContextFieldIfChanged({ job, user = null }) {
  const jobId = job?.id != null ? String(job.id) : '';
  if (!jobId) return { emitted: false, reason: 'no_job_id' };

  const technicianKey = getTechnicianIdForCanonicalEvents(user);
  const fingerprint = await computeJobContextFingerprint(job, technicianKey);
  if (!shouldEmitJobContextSnapshot(jobId, fingerprint)) {
    return { emitted: false, reason: 'duplicate_fingerprint', fingerprint };
  }

  await emitJobContextField({ job, user, contextFingerprint: fingerprint });
  markJobContextSnapshotEmitted(jobId, fingerprint);
  return { emitted: true, fingerprint };
}
