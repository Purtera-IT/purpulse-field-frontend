/**
 * Canonical tool_check_event → core.fact_tool_check_event (Iteration 10).
 * Schema: Azure Analysis/tool_check_event.json
 */

import { uuidv4 } from '@/lib/uuid';
import { enqueueCanonicalEvent } from '@/lib/telemetryQueue';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { normalizeConnectivityState } from '@/lib/connectivityState';
import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';
import { isTelemetryEnabled } from '@/lib/telemetry';
import { SCOPE_ACKNOWLEDGEMENT_KEYS } from '@/constants/scopeAcknowledgements';

/** @type {string[]} */
export const TOOL_CHECK_EVENT_PROPERTY_KEYS = [
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
  'tool_check_timestamp',
  'all_items_passed_flag',
  'ppe_compliant_flag',
  'essential_tools_ready_flag',
  'bom_docs_reviewed_flag',
  'site_safety_ack_flag',
  'required_docs_opened_flag',
  'risk_flag_ack_flag',
  'customer_notes_review_flag',
  'site_constraint_ack_flag',
  'step_sequence_preview_flag',
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
  'tool_check_timestamp',
  'all_items_passed_flag',
  'ppe_compliant_flag',
  'essential_tools_ready_flag',
  'bom_docs_reviewed_flag',
  'site_safety_ack_flag',
];

const BOOL_FIELDS = [
  'all_items_passed_flag',
  'ppe_compliant_flag',
  'essential_tools_ready_flag',
  'bom_docs_reviewed_flag',
  'site_safety_ack_flag',
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
export function assertToolCheckEventRequired(payload) {
  const missing = REQUIRED.filter((k) => payload[k] == null || payload[k] === '');
  if (missing.length) {
    const msg = `tool_check_event missing required: ${missing.join(', ')}`;
    if (import.meta.env.DEV) console.error('[toolCheckEvent]', msg, payload);
    throw new Error(msg);
  }
  if (payload.event_name !== 'tool_check_event') {
    throw new Error('tool_check_event: event_name must be tool_check_event');
  }
  if (payload.source_system !== 'field_app') {
    throw new Error('tool_check_event: source_system must be field_app');
  }
  for (const f of BOOL_FIELDS) {
    if (typeof payload[f] !== 'boolean') {
      throw new Error(`tool_check_event: ${f} must be boolean`);
    }
  }
  const allPass =
    payload.ppe_compliant_flag === true &&
    payload.essential_tools_ready_flag === true &&
    payload.bom_docs_reviewed_flag === true &&
    payload.site_safety_ack_flag === true;
  if (payload.all_items_passed_flag !== allPass) {
    throw new Error('tool_check_event: all_items_passed_flag must match AND of checklist flags');
  }
  for (const k of SCOPE_ACKNOWLEDGEMENT_KEYS) {
    if (payload[k] != null && typeof payload[k] !== 'boolean') {
      throw new Error(`tool_check_event: ${k} must be boolean or null/omitted`);
    }
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, boolean> | null | undefined} acks
 */
function attachScopeAcknowledgementsToToolPayload(payload, acks) {
  if (!acks || typeof acks !== 'object') return;
  for (const k of SCOPE_ACKNOWLEDGEMENT_KEYS) {
    if (acks[k] === true) payload[k] = true;
  }
}

/**
 * @param {Object} opts
 * @param {Record<string, unknown>} opts.job
 * @param {Record<string, unknown> | null} [opts.user]
 * @param {boolean} opts.ppeCompliant
 * @param {boolean} opts.essentialToolsReady
 * @param {boolean} opts.bomDocsReviewed
 * @param {boolean} opts.siteSafetyAck
 * @param {string} [opts.toolCheckTimestampIso]
 * @param {Record<string, boolean> | null} [opts.scopeAcknowledgements] - Iteration 11 (true only on payload)
 */
export function buildToolCheckEventPayload({
  job,
  user = null,
  ppeCompliant,
  essentialToolsReady,
  bomDocsReviewed,
  siteSafetyAck,
  toolCheckTimestampIso = null,
  scopeAcknowledgements = null,
}) {
  const nowIso = new Date().toISOString();
  const ts = toolCheckTimestampIso || nowIso;
  const techId = getTechnicianIdForCanonicalEvents(user);

  const ppe = Boolean(ppeCompliant);
  const tools = Boolean(essentialToolsReady);
  const bom = Boolean(bomDocsReviewed);
  const safety = Boolean(siteSafetyAck);
  const allPass = ppe && tools && bom && safety;

  /** @type {Record<string, unknown>} */
  const payload = {
    event_id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    event_name: 'tool_check_event',
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
    tool_check_timestamp: ts,
    all_items_passed_flag: allPass,
    ppe_compliant_flag: ppe,
    essential_tools_ready_flag: tools,
    bom_docs_reviewed_flag: bom,
    site_safety_ack_flag: safety,
  };

  if (job?.project_id != null && job.project_id !== '') {
    payload.project_id = String(job.project_id);
  }
  if (job?.site_id != null && job.site_id !== '') {
    payload.site_id = String(job.site_id);
  }

  attachScopeAcknowledgementsToToolPayload(payload, scopeAcknowledgements);

  appendDeviceSession(payload);
  return pickKeys(payload, TOOL_CHECK_EVENT_PROPERTY_KEYS);
}

export async function emitToolCheckEvent(opts) {
  const built = buildToolCheckEventPayload(opts);
  assertToolCheckEventRequired(built);
  return enqueueCanonicalEvent(built, { allowlistKeys: TOOL_CHECK_EVENT_PROPERTY_KEYS });
}
