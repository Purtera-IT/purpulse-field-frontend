/**
 * Azure / Purpulse telemetry ingestion HTTP client (IMPLEMENTATION_PLAN §1.4, ingestion_strategy §2).
 *
 * Set VITE_TELEMETRY_INGESTION_URL to the **full URL** of the single-event POST endpoint
 * (e.g. https://your-api.example.com/v1/telemetry/events).
 */

import { authManager } from '@/lib/auth';

/**
 * Full POST URL for one canonical envelope. Empty = no network sends (queue retains items).
 */
export function getIngestionPostUrl() {
  const url = import.meta.env.VITE_TELEMETRY_INGESTION_URL;
  return typeof url === 'string' ? url.trim() : '';
}

/**
 * @typedef {Object} IngestionResult
 * @property {boolean} ok
 * @property {boolean} retryable - true if caller should backoff and retry (5xx, 429, network, no token)
 * @property {boolean} [skipped] - true if URL not configured (no network call)
 * @property {number} [status] - HTTP status when applicable
 * @property {string} [message]
 */

/**
 * POST one canonical envelope to the ingestion API.
 *
 * @param {Record<string, unknown>} envelope - Must include event_id (UUID)
 * @param {{ getAccessToken?: () => Promise<string | null> }} [options]
 * @returns {Promise<IngestionResult>}
 */
export async function sendCanonicalEnvelope(envelope, options = {}) {
  const postUrl = getIngestionPostUrl();
  const eventId = typeof envelope?.event_id === 'string' ? envelope.event_id : '';

  if (!postUrl) {
    if (import.meta.env.DEV) {
      console.info('[telemetryIngestion] VITE_TELEMETRY_INGESTION_URL not set; skip send', { event_id: eventId });
    }
    return {
      ok: false,
      retryable: true,
      skipped: true,
      message: 'ingestion URL not configured',
    };
  }

  if (!eventId) {
    return { ok: false, retryable: false, message: 'envelope missing event_id' };
  }

  const getToken = options.getAccessToken ?? (() => authManager.getAccessToken());
  let token;
  try {
    token = await getToken();
  } catch (e) {
    return {
      ok: false,
      retryable: true,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  if (!token) {
    return { ok: false, retryable: true, message: 'no access token' };
  }

  try {
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Client-Request-ID': eventId,
      },
      body: JSON.stringify(envelope),
    });

    if (res.status === 202 || res.status === 200) {
      return { ok: true, status: res.status };
    }

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        retryable: false,
        status: res.status,
        message: text || res.statusText,
      };
    }

    if (res.status === 429 || res.status >= 500) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        retryable: true,
        status: res.status,
        message: text || res.statusText,
      };
    }

    const text = await res.text().catch(() => '');
    return {
      ok: false,
      retryable: res.status >= 500,
      status: res.status,
      message: text || res.statusText,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, retryable: true, message };
  }
}
