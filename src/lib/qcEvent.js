/**
 * Canonical qc_event → core.fact_qc_event (Iteration 8).
 * Schema: Azure Analysis/qc_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';
import { fetchJobContextForArtifactEvent } from '@/lib/artifactEvent';

/** @type {string[]} */
export const QC_EVENT_PROPERTY_KEYS = [
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
  'reviewer_id',
  'artifact_id',
  'qc_task_id',
  'review_timestamp',
  'validation_result',
  'defect_flag',
  'retest_flag',
  'confidence',
  'bbox',
  'approved_for_training',
  'review_notes',
  'step_instance_id',
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
  'reviewer_id',
  'artifact_id',
  'review_timestamp',
  'validation_result',
  'defect_flag',
  'retest_flag',
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
export function assertQcEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `qc_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[qcEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'qc_event') {
    throw new Error('qc_event: event_name must be qc_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('qc_event: source_system must be field_app');
  }
  const vr = payload.validation_result;
  if (!['passed', 'failed', 'needs_review'].includes(vr)) {
    throw new Error('qc_event: validation_result invalid');
  }
  if (typeof payload.defect_flag !== 'boolean' || typeof payload.retest_flag !== 'boolean') {
    throw new Error('qc_event: defect_flag and retest_flag must be boolean');
  }
}

/**
 * Map LabelRecord.label_type → validation_result enum.
 * @param {string} labelType
 * @returns {'passed'|'failed'|'needs_review'}
 */
export function mapLabelTypeToValidationResult(labelType) {
  const t = String(labelType || '').toLowerCase();
  if (['pass', 'qc_pass', 'training_approved'].includes(t)) return 'passed';
  if (['fail', 'qc_fail', 'defect'].includes(t)) return 'failed';
  if (['flag', 'skip'].includes(t)) return 'needs_review';
  return 'needs_review';
}

/**
 * Defect semantics for labels: structural / QC-fail categories.
 * @param {string} labelType
 * @param {'passed'|'failed'|'needs_review'} validationResult
 */
export function defectFlagForLabelType(labelType, validationResult) {
  const t = String(labelType || '').toLowerCase();
  if (['defect', 'qc_fail'].includes(t)) return true;
  if (validationResult === 'failed') return true;
  return false;
}

/**
 * Normalize bbox from LabelRecord (string JSON or object).
 * @param {unknown} raw
 * @returns {Record<string, unknown>|null}
 */
export function parseBboxForQcEvent(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return /** @type {Record<string, unknown>} */ (raw);
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job - at least { id }; optional project_id, site_id
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {Record<string, unknown>} opts.evidence - row with id, job_id; optional runbook_step_id, quality_score
 * @param {'passed'|'failed'|'needs_review'} opts.validationResult
 * @param {string | null} [opts.reviewNotes]
 * @param {string | null} [opts.qcTaskId]
 * @param {number | null} [opts.confidence] - 0..1 preferred; scores 0..100 scaled
 * @param {Record<string, unknown> | null} [opts.bbox]
 * @param {boolean | null} [opts.approvedForTraining]
 * @param {boolean} [opts.defectFlag]
 * @param {boolean} [opts.retestFlag]
 * @param {string | null} [opts.stepInstanceId] - overrides evidence.runbook_step_id
 * @param {string} [opts.reviewTimestampIso] - defaults to now
 */
export function buildQcEventPayload({
  job,
  user = null,
  evidence,
  validationResult,
  reviewNotes = null,
  qcTaskId = null,
  confidence = null,
  bbox = null,
  approvedForTraining = null,
  defectFlag,
  retestFlag = false,
  stepInstanceId = null,
  reviewTimestampIso = null,
}) {
  const nowIso = new Date().toISOString();
  const reviewTs = reviewTimestampIso || nowIso;
  const reviewerId = getTechnicianIdForCanonicalEvents(user);
  const artifactId = evidence?.id != null ? String(evidence.id) : '';
  const jobId = job?.id != null ? String(job.id) : (evidence?.job_id != null ? String(evidence.job_id) : '');

  let conf = confidence;
  if (typeof conf === 'number' && conf > 1 && conf <= 100) {
    conf = conf / 100;
  }
  if (typeof conf === 'number' && (Number.isNaN(conf) || conf < 0 || conf > 1)) {
    conf = null;
  }

  const stepId =
    stepInstanceId != null && String(stepInstanceId) !== ''
      ? String(stepInstanceId)
      : evidence?.runbook_step_id != null
        ? String(evidence.runbook_step_id)
        : null;

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'qc_event',
    event_ts_utc: nowIso,
    client_ts: nowIso,
    source_system: 'field_app',
    job_id: jobId,
    technician_id: reviewerId,
    reviewer_id: reviewerId,
    connectivity_state: normalizeConnectivityState(),
    telemetry_consent: {
      location: isPreciseLocationAllowedForCanonicalIngest(),
      device: isTelemetryEnabled(),
    },
    artifact_id: artifactId,
    review_timestamp: reviewTs,
    validation_result: validationResult,
    defect_flag: Boolean(defectFlag),
    retest_flag: Boolean(retestFlag),
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }

  if (qcTaskId != null && String(qcTaskId) !== '') {
    payload.qc_task_id = String(qcTaskId);
  }
  if (reviewNotes != null && String(reviewNotes).trim() !== '') {
    payload.review_notes = String(reviewNotes).trim();
  }
  if (typeof conf === 'number') {
    payload.confidence = conf;
  }
  if (bbox && typeof bbox === 'object') {
    payload.bbox = bbox;
  }
  if (approvedForTraining === true || approvedForTraining === false) {
    payload.approved_for_training = approvedForTraining;
  }
  if (stepId) {
    payload.step_instance_id = stepId;
  }

  const deviceId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_device_id') : null;
  if (deviceId) payload.device_id = deviceId;
  const sessionId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('purpulse_session_id') : null;
  if (sessionId) payload.session_id = sessionId;

  return pickKeys(payload, QC_EVENT_PROPERTY_KEYS);
}

/**
 * Enqueue canonical qc_event (allowlisted).
 */
export async function emitQcEvent(opts) {
  const built = buildQcEventPayload(opts);
  assertQcEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: QC_EVENT_PROPERTY_KEYS });
}

export { fetchJobContextForArtifactEvent as fetchJobContextForQcEvent };
