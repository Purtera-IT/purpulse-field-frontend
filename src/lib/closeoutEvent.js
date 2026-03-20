/**
 * Canonical closeout_event → core.fact_closeout_event (Iteration 9).
 * Schema: Azure Analysis/closeout_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';

/** @type {string[]} */
export const CLOSEOUT_EVENT_PROPERTY_KEYS = [
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
  'closeout_submit_timestamp',
  'documentation_complete_flag',
  'customer_signature_flag',
  'runbook_complete_flag',
  'required_fields_complete_flag',
  'invoice_support_docs_flag',
  'portal_update_flag',
  'timecard_submitted_flag',
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
  'closeout_submit_timestamp',
  'documentation_complete_flag',
  'customer_signature_flag',
  'runbook_complete_flag',
  'required_fields_complete_flag',
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
 * @param {Record<string, unknown>} payload
 */
export function assertCloseoutEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `closeout_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[closeoutEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'closeout_event') {
    throw new Error('closeout_event: event_name must be closeout_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('closeout_event: source_system must be field_app');
  }
  for (const f of [
    'documentation_complete_flag',
    'customer_signature_flag',
    'runbook_complete_flag',
    'required_fields_complete_flag',
  ]) {
    if (typeof payload[f] !== 'boolean') {
      throw new Error(`closeout_event: ${f} must be boolean`);
    }
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {boolean} opts.documentationComplete
 * @param {boolean} opts.customerSignatureCaptured
 * @param {boolean} opts.runbookComplete
 * @param {boolean} opts.requiredFieldsComplete
 * @param {string} [opts.closeoutSubmitTimestampIso]
 * @param {boolean | null} [opts.invoiceSupportDocsFlag]
 * @param {boolean | null} [opts.portalUpdateFlag]
 * @param {boolean | null} [opts.timecardSubmittedFlag]
 */
export function buildCloseoutEventPayload({
  job,
  user = null,
  documentationComplete,
  customerSignatureCaptured,
  runbookComplete,
  requiredFieldsComplete,
  closeoutSubmitTimestampIso = null,
  invoiceSupportDocsFlag = null,
  portalUpdateFlag = null,
  timecardSubmittedFlag = null,
}) {
  const nowIso = new Date().toISOString();
  const submitTs = closeoutSubmitTimestampIso || nowIso;
  const techId = getTechnicianIdForCanonicalEvents(user);

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'closeout_event',
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
    closeout_submit_timestamp: submitTs,
    documentation_complete_flag: Boolean(documentationComplete),
    customer_signature_flag: Boolean(customerSignatureCaptured),
    runbook_complete_flag: Boolean(runbookComplete),
    required_fields_complete_flag: Boolean(requiredFieldsComplete),
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }
  if (invoiceSupportDocsFlag === true || invoiceSupportDocsFlag === false) {
    payload.invoice_support_docs_flag = invoiceSupportDocsFlag;
  }
  if (portalUpdateFlag === true || portalUpdateFlag === false) {
    payload.portal_update_flag = portalUpdateFlag;
  }
  if (timecardSubmittedFlag === true || timecardSubmittedFlag === false) {
    payload.timecard_submitted_flag = timecardSubmittedFlag;
  }

  appendDeviceSession(payload);
  return pickKeys(payload, CLOSEOUT_EVENT_PROPERTY_KEYS);
}

export async function emitCloseoutEvent(opts) {
  const built = buildCloseoutEventPayload(opts);
  assertCloseoutEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: CLOSEOUT_EVENT_PROPERTY_KEYS });
}
