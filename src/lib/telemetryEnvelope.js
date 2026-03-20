/**
 * Canonical TechPulse / Azure ingestion envelope (FIELD_APP_TECHPULSE_AZURE_README §3, IMPLEMENTATION_PLAN §1.1).
 * Separate from src/lib/telemetry.js (Base44 analytics).
 */

import { uuidv4 } from '@/lib/uuid';
import {
  finalizeCanonicalEnvelopeForIngest,
  isPreciseLocationAllowedForCanonicalIngest,
} from '@/lib/locationConsent';

/** Semver for the envelope shape; bump MINOR for new optional fields, MAJOR for breaking changes */
export const CANONICAL_SCHEMA_VERSION = '1.0.0';

let _sequence = 0;

function nextSequence() {
  _sequence += 1;
  return _sequence;
}

/**
 * @typedef {Object} EnvelopeContext
 * @property {string} [technician_id] - Stable non-PII id (required in production; dev may use env)
 * @property {string} [job_id]
 * @property {string} [site_id]
 * @property {string} [domain_code]
 * @property {string} [subdomain_code]
 * @property {string} [device_id]
 * @property {Record<string, unknown>} [location] - Only attached when `purpulse_perm_location` is `granted` (Iteration 2)
 */

/**
 * Build a single JSON-serializable canonical event for Azure ingestion.
 *
 * @param {Object} opts
 * @param {string} opts.eventName - e.g. ping_event, dispatch_event
 * @param {Record<string, unknown>} [opts.payload] - Event-specific attributes (merged into top-level or nested; we use top-level merge for flat payloads)
 * @param {EnvelopeContext} [opts.context]
 * @returns {Record<string, unknown>}
 */
export function buildCanonicalEnvelope({ eventName, payload = {}, context = {} }) {
  const now = new Date();
  const event_id = uuidv4();
  const connectivity_state =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
        ? 'online'
        : 'offline'
      : 'unknown';

  const envelope = {
    ...payload,
    event_id,
    event_name: eventName,
    event_ts_utc: now.toISOString(),
    schema_version: CANONICAL_SCHEMA_VERSION,
    source_system: 'field_app',
    client_ts: now.toISOString(),
    device_ts_local: now.toISOString(),
    connectivity_state,
    event_sequence_no: nextSequence(),
  };

  if (context.technician_id != null && context.technician_id !== '') {
    envelope.technician_id = context.technician_id;
  }
  if (context.job_id != null && context.job_id !== '') {
    envelope.job_id = context.job_id;
  }
  if (context.site_id != null && context.site_id !== '') {
    envelope.site_id = context.site_id;
  }
  if (context.domain_code) {
    envelope.domain_code = context.domain_code;
  }
  if (context.subdomain_code) {
    envelope.subdomain_code = context.subdomain_code;
  }
  if (context.device_id) {
    envelope.device_id = context.device_id;
  }
  if (
    context.location &&
    typeof context.location === 'object' &&
    isPreciseLocationAllowedForCanonicalIngest()
  ) {
    envelope.location = context.location;
  }

  return finalizeCanonicalEnvelopeForIngest(envelope);
}

/**
 * Dev / connectivity test event (Iteration 1 spine).
 */
export function buildPingEnvelope(context = {}) {
  return buildCanonicalEnvelope({
    eventName: 'ping_event',
    payload: { note: 'canonical_ingest_test' },
    context,
  });
}
