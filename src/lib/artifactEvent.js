/**
 * Canonical artifact_event → core.fact_artifact_event (Iteration 7).
 * Schema: Azure Analysis/artifact_event.json
 *
 * Emitted once after a successful Evidence entity create (upload pipeline complete).
 */

import { base44 } from '@/api/base44Client';
import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import {
  isPreciseLocationAllowedForCanonicalIngest,
} from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';

/** @type {string[]} */
export const ARTIFACT_EVENT_PROPERTY_KEYS = [
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
  'artifact_id',
  'documentation_artifact_id',
  'evidence_type',
  'captured_at',
  'content_type',
  'size_bytes',
  'runbook_step_id',
  'serial_value',
  'asset_tag_capture_flag',
  'customer_signature_flag',
  'photo_uploaded_count',
  'photo_required_count',
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
  'artifact_id',
  'evidence_type',
  'captured_at',
  'asset_tag_capture_flag',
  'customer_signature_flag',
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
 * Minimal job context for artifact payloads (project_id / site_id for joins).
 * @param {string} jobId
 * @returns {Promise<{ id: string, project_id?: string, site_id?: string }>}
 */
export async function fetchJobContextForArtifactEvent(jobId) {
  const id = jobId != null ? String(jobId) : '';
  if (!id) return { id: '' };
  try {
    const rows = await base44.entities.Job.filter({ id });
    const j = rows?.[0];
    if (j && typeof j === 'object') {
      return {
        id: String(j.id),
        ...(j.project_id != null && j.project_id !== ''
          ? { project_id: String(j.project_id) }
          : {}),
        ...(j.site_id != null && j.site_id !== '' ? { site_id: String(j.site_id) } : {}),
      };
    }
  } catch (_) {
    /* ignore — caller still emits with job_id only */
  }
  return { id };
}

/**
 * @param {Record<string, unknown>} payload
 */
export function assertArtifactEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `artifact_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[artifactEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'artifact_event') {
    throw new Error('artifact_event: event_name must be artifact_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('artifact_event: source_system must be field_app');
  }
  if (typeof payload.asset_tag_capture_flag !== 'boolean') {
    throw new Error('artifact_event: asset_tag_capture_flag must be boolean');
  }
  if (typeof payload.customer_signature_flag !== 'boolean') {
    throw new Error('artifact_event: customer_signature_flag must be boolean');
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job - at least { id }; optional project_id, site_id
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {Record<string, unknown>} opts.evidence - created Evidence row (id, evidence_type, …)
 * @param {Record<string, unknown>} [opts.metadata] - queue/capture metadata (serial_number, runbook_step_id, lat/lon, photo_required_count)
 * @param {number | null} [opts.photoUploadedCount] - e.g. 1 per file in this completion
 * @param {number | null} [opts.photoRequiredCount] - from job context when known
 */
export function buildArtifactEventPayload({
  job,
  user = null,
  evidence,
  metadata = {},
  photoUploadedCount = null,
  photoRequiredCount = null,
}) {
  const nowIso = new Date().toISOString();
  const artifactId = evidence?.id != null ? String(evidence.id) : '';
  const etRaw = evidence?.evidence_type ?? metadata?.tags?.[0] ?? 'general';
  const evidenceType = String(etRaw || 'general');
  const serialRaw = metadata?.serial_number ?? metadata?.serial ?? null;
  const serial =
    serialRaw != null && String(serialRaw).trim() !== '' ? String(serialRaw).trim() : null;
  const runbookStepRaw = metadata?.runbook_step_id ?? evidence?.runbook_step_id ?? null;
  const runbookStepId =
    runbookStepRaw != null && String(runbookStepRaw) !== '' ? String(runbookStepRaw) : null;

  const capturedAt =
    (evidence?.captured_at && String(evidence.captured_at)) ||
    (metadata?.capture_ts && String(metadata.capture_ts)) ||
    nowIso;

  const etLower = evidenceType.toLowerCase();
  const customerSignatureFlag =
    etLower === 'signature' ||
    etLower.includes('signature') ||
    etLower === 'signoff';

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'artifact_event',
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
    artifact_id: artifactId,
    documentation_artifact_id: artifactId,
    evidence_type: evidenceType,
    captured_at: capturedAt,
    asset_tag_capture_flag: Boolean(serial),
    customer_signature_flag: customerSignatureFlag,
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }

  if (evidence?.content_type != null && evidence.content_type !== '') {
    payload.content_type = String(evidence.content_type);
  }
  if (typeof evidence?.size_bytes === 'number' && !Number.isNaN(evidence.size_bytes)) {
    payload.size_bytes = evidence.size_bytes;
  }

  if (runbookStepId) payload.runbook_step_id = runbookStepId;
  if (serial) payload.serial_value = serial;

  if (typeof photoUploadedCount === 'number' && photoUploadedCount >= 0) {
    payload.photo_uploaded_count = photoUploadedCount;
  }
  const reqCount =
    photoRequiredCount != null
      ? photoRequiredCount
      : metadata?.photo_required_count != null
        ? Number(metadata.photo_required_count)
        : null;
  if (typeof reqCount === 'number' && !Number.isNaN(reqCount) && reqCount >= 0) {
    payload.photo_required_count = reqCount;
  }

  const lat = metadata?.lat ?? metadata?.geo_lat ?? evidence?.geo_lat;
  const lon = metadata?.lon ?? metadata?.geo_lon ?? evidence?.geo_lon;
  const acc = metadata?.gps_accuracy ?? metadata?.accuracy_m ?? evidence?.gps_accuracy;
  if (lat != null && lon != null && isPreciseLocationAllowedForCanonicalIngest()) {
    payload.location = {
      lat: Number(lat),
      lon: Number(lon),
      ...(acc != null && !Number.isNaN(Number(acc)) ? { accuracy_m: Number(acc) } : {}),
    };
  }

  const deviceId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_device_id') : null;
  if (deviceId) payload.device_id = deviceId;
  const sessionId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_session_id') : null;
  if (sessionId) payload.session_id = sessionId;

  return pickKeys(payload, ARTIFACT_EVENT_PROPERTY_KEYS);
}

/**
 * Queue a canonical artifact_event after evidence upload + Evidence.create succeeds.
 * Does not throw on enqueue failures — callers may log.
 */
export async function emitArtifactEventForCompletedUpload(opts) {
  const built = buildArtifactEventPayload(opts);
  assertArtifactEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: ARTIFACT_EVENT_PROPERTY_KEYS });
}
