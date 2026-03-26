/**
 * Iteration 13 — durable queue behavior (IndexedDB + flush).
 * Mocks ingestion client so tests do not depend on Vite env injection in Vitest.
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/telemetryIngestion', () => ({
  getIngestionPostUrl: vi.fn(() => 'https://ingest.test/v1/events'),
  sendCanonicalEnvelope: vi.fn(),
}));

import {
  enqueueCanonicalEvent,
  flushTelemetryQueue,
  getQueueStats,
  getTelemetryQueueDepthForJob,
  registerTelemetryQueueListeners,
} from '@/lib/telemetryQueue';
import { sendCanonicalEnvelope } from '@/api/telemetryIngestion';

function minimalEnvelope(overrides = {}) {
  const now = new Date().toISOString();
  return {
    event_id: '550e8400-e29b-41d4-a716-446655440020',
    schema_version: '1.0.0',
    event_name: 'dispatch_event',
    event_ts_utc: now,
    client_ts: now,
    source_system: 'field_app',
    job_id: 'job_test',
    technician_id: 'tech_test',
    status: 'en_route',
    ...overrides,
  };
}

describe('Iteration 13 — telemetryQueue', () => {
  beforeEach(() => {
    vi.mocked(sendCanonicalEnvelope).mockReset();
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops row after non-retryable send result (e.g. schema 400)', async () => {
    vi.mocked(sendCanonicalEnvelope).mockResolvedValue({
      ok: false,
      retryable: false,
      status: 400,
      message: 'invalid',
    });
    await enqueueCanonicalEvent(minimalEnvelope({ event_id: '550e8400-e29b-41d4-a716-446655440030' }));
    expect((await getQueueStats()).depth).toBe(1);
    const r = await flushTelemetryQueue();
    expect(r.failedPermanent).toBe(1);
    expect((await getQueueStats()).depth).toBe(0);
  });

  it('removes row after ok send (server may return 200 for duplicate event_id)', async () => {
    vi.mocked(sendCanonicalEnvelope).mockResolvedValue({ ok: true, status: 200 });
    await enqueueCanonicalEvent(minimalEnvelope({ event_id: '550e8400-e29b-41d4-a716-446655440031' }));
    await flushTelemetryQueue();
    expect((await getQueueStats()).depth).toBe(0);
    expect(sendCanonicalEnvelope).toHaveBeenCalled();
  });

  it('same event_id re-enqueue overwrites one queue row (client-side dedup)', async () => {
    vi.mocked(sendCanonicalEnvelope).mockResolvedValue({ ok: true, status: 200 });
    const id = '550e8400-e29b-41d4-a716-446655440032';
    await enqueueCanonicalEvent(minimalEnvelope({ event_id: id, status: 'en_route' }));
    await enqueueCanonicalEvent(minimalEnvelope({ event_id: id, status: 'arrived' }));
    expect((await getQueueStats()).depth).toBe(1);
    await flushTelemetryQueue();
    expect((await getQueueStats()).depth).toBe(0);
  });

  it('registers window "online" and visibilitychange to flush after reconnect', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const docSpy = vi.spyOn(document, 'addEventListener');
    registerTelemetryQueueListeners();
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(docSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    addSpy.mockRestore();
    docSpy.mockRestore();
  });

  describe('getTelemetryQueueDepthForJob', () => {
    it('returns zero for empty job id', async () => {
      expect(await getTelemetryQueueDepthForJob('')).toEqual({
        depth: 0,
        hasPending: false,
        sample_errors: [],
      });
      expect(await getTelemetryQueueDepthForJob(null)).toEqual({
        depth: 0,
        hasPending: false,
        sample_errors: [],
      });
    });

    it('counts only rows matching envelope.job_id (string-coerced)', async () => {
      vi.mocked(sendCanonicalEnvelope).mockResolvedValue({ ok: false, retryable: true, status: 503 });
      await enqueueCanonicalEvent(
        minimalEnvelope({ event_id: '550e8400-e29b-41d4-a716-446655440040', job_id: 'job-a' })
      );
      await enqueueCanonicalEvent(
        minimalEnvelope({ event_id: '550e8400-e29b-41d4-a716-446655440041', job_id: 'job-b' })
      );
      const forA = await getTelemetryQueueDepthForJob('job-a');
      const forB = await getTelemetryQueueDepthForJob('job-b');
      expect(forA.depth).toBe(1);
      expect(forB.depth).toBe(1);
      expect((await getTelemetryQueueDepthForJob('job-c')).depth).toBe(0);
    });

    it('matches numeric job id to string envelope job_id', async () => {
      vi.mocked(sendCanonicalEnvelope).mockResolvedValue({ ok: false, retryable: true, status: 503 });
      await enqueueCanonicalEvent(
        minimalEnvelope({ event_id: '550e8400-e29b-41d4-a716-446655440042', job_id: '99' })
      );
      expect((await getTelemetryQueueDepthForJob(99)).depth).toBe(1);
    });
  });
});
