/**
 * Canonical ingest location policy (Iteration 2, CURSOR_FIELD_APP_ITERATIONS.md).
 * Aligns with LocationConsentStep localStorage and Azure Analysis audit_report (consent-aware GPS).
 */

/** Must match LocationConsentStep.jsx */
export const PURPULSE_PERM_LOCATION_KEY = 'purpulse_perm_location';

/** ISO timestamp when consent state was last written (audit). */
export const PURPULSE_LOCATION_CONSENT_TS_KEY = 'purpulse_location_consent_ts';

const GRANTED = 'granted';

/** Top-level envelope keys that may carry precise coordinates or GPS-derived fields */
const LOCATION_RELATED_TOP_KEYS = new Set([
  'location',
  'lat',
  'lon',
  'latitude',
  'longitude',
  'lng',
  'long',
  'coordinates',
  'coords',
  'geo',
  'position',
  'gps',
  'altitude',
  'accuracy',
  'heading',
  'speed',
]);

/**
 * @returns {'granted'|'limited'|'denied'|'unavailable'|'unknown'}
 */
export function getLocationConsentState() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'unknown';
  }
  const raw = localStorage.getItem(PURPULSE_PERM_LOCATION_KEY);
  if (!raw) return 'unknown';
  if (['granted', 'limited', 'denied', 'unavailable'].includes(raw)) {
    return /** @type {'granted'|'limited'|'denied'|'unavailable'} */ (raw);
  }
  return 'unknown';
}

/**
 * Precise lat/lon allowed on canonical envelopes only when OS flow recorded `granted`.
 */
export function isPreciseLocationAllowedForCanonicalIngest() {
  return getLocationConsentState() === GRANTED;
}

/**
 * Non-PII snapshot for every canonical event (downstream audit / filtering).
 */
export function getLocationConsentSnapshot() {
  const location_consent_state = getLocationConsentState();
  return {
    location_consent_state,
    location_precise_allowed: location_consent_state === GRANTED,
  };
}

function cloneEnvelope(envelope) {
  if (typeof structuredClone === 'function') {
    return structuredClone(envelope);
  }
  return JSON.parse(JSON.stringify(envelope));
}

/**
 * Remove precise / GPS fields when policy disallows them.
 * @param {Record<string, unknown>} envelope - mutated in place
 */
export function sanitizeEnvelopeForLocationPolicy(envelope) {
  if (!envelope || typeof envelope !== 'object') return envelope;
  if (isPreciseLocationAllowedForCanonicalIngest()) {
    return envelope;
  }
  for (const key of Object.keys(envelope)) {
    if (LOCATION_RELATED_TOP_KEYS.has(key)) {
      delete envelope[key];
    }
  }
  return envelope;
}

/**
 * Set consent snapshot fields (call after sanitize).
 * @param {Record<string, unknown>} envelope - mutated in place
 */
export function applyLocationConsentToEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return envelope;
  const snap = getLocationConsentSnapshot();
  envelope.location_consent_state = snap.location_consent_state;
  envelope.location_precise_allowed = snap.location_precise_allowed;
  return envelope;
}

/**
 * Final line of defense before queue or send: clone, strip if needed, attach snapshot.
 * @param {Record<string, unknown>} envelope
 * @returns {Record<string, unknown>}
 */
export function finalizeCanonicalEnvelopeForIngest(envelope) {
  const out = cloneEnvelope(envelope);
  sanitizeEnvelopeForLocationPolicy(out);
  applyLocationConsentToEnvelope(out);
  return out;
}
