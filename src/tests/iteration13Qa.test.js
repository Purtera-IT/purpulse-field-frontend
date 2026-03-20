/**
 * Iteration 13 — QA / validation (FIELD_APP_TECHPULSE_AZURE_README.md §10).
 * HTTP client + consent. Queue + IndexedDB: see iteration13TelemetryQueue.test.js.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440001';
const INGEST_URL = 'https://ingest.test/v1/events';

function minimalEnvelope(overrides = {}) {
  const now = new Date().toISOString();
  return {
    event_id: TEST_UUID,
    schema_version: '1.0.0',
    event_name: 'dispatch_event',
    event_ts_utc: now,
    client_ts: now,
    source_system: 'field_app',
    job_id: 'job_test',
    technician_id: 'tech_test',
    ...overrides,
  };
}

describe('Iteration 13 — sendCanonicalEnvelope', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_TELEMETRY_INGESTION_URL', INGEST_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('treats 200 and 202 as success', async () => {
    for (const status of [200, 202]) {
      vi.resetModules();
      vi.stubEnv('VITE_TELEMETRY_INGESTION_URL', INGEST_URL);
      globalThis.fetch = vi.fn().mockResolvedValue({
        status,
        statusText: 'OK',
        text: async () => '',
      });
      const { sendCanonicalEnvelope } = await import('@/api/telemetryIngestion');
      const r = await sendCanonicalEnvelope(minimalEnvelope(), {
        getAccessToken: async () => 'test-token',
      });
      expect(r.ok, `status ${status}`).toBe(true);
      expect(r.retryable ?? false, `status ${status}`).toBe(false);
    }
  });

  it('400 / 401 / 403 are not retryable (no infinite retry of same body)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'schema' }),
    });
    const { sendCanonicalEnvelope } = await import('@/api/telemetryIngestion');
    const r = await sendCanonicalEnvelope(minimalEnvelope(), {
      getAccessToken: async () => 'test-token',
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.status).toBe(400);
  });

  it('429 and 5xx are retryable', async () => {
    for (const status of [429, 500, 503]) {
      vi.resetModules();
      vi.stubEnv('VITE_TELEMETRY_INGESTION_URL', INGEST_URL);
      globalThis.fetch = vi.fn().mockResolvedValue({
        status,
        statusText: 'Retry',
        text: async () => '',
      });
      const { sendCanonicalEnvelope } = await import('@/api/telemetryIngestion');
      const r = await sendCanonicalEnvelope(minimalEnvelope(), {
        getAccessToken: async () => 'test-token',
      });
      expect(r.ok, `status ${status}`).toBe(false);
      expect(r.retryable, `status ${status}`).toBe(true);
    }
  });

  it('network errors are retryable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const { sendCanonicalEnvelope } = await import('@/api/telemetryIngestion');
    const r = await sendCanonicalEnvelope(minimalEnvelope(), {
      getAccessToken: async () => 'test-token',
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });
});

describe('Iteration 13 — finalizeCanonicalEnvelopeForIngest (consent)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('strips precise location keys when consent is not granted', async () => {
    const { finalizeCanonicalEnvelopeForIngest, PURPULSE_PERM_LOCATION_KEY } = await import(
      '@/lib/locationConsent'
    );
    localStorage.removeItem(PURPULSE_PERM_LOCATION_KEY);
    const out = finalizeCanonicalEnvelopeForIngest(
      minimalEnvelope({
        location: { lat: 1, lon: 2, accuracy_m: 3 },
      })
    );
    expect(out.location).toBeUndefined();
    expect(out.location_precise_allowed).toBe(false);
  });
});
