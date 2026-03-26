/**
 * Durable canonical telemetry queue → ingestion API (IMPLEMENTATION_PLAN §1.3, ingestion_strategy §4–6).
 */

import { sendCanonicalEnvelope } from '@/api/telemetryIngestion';
import { finalizeCanonicalEnvelopeForIngest } from '@/lib/locationConsent';

const DB_NAME = 'purpulse_telemetry_queue';
const STORE = 'queue';
const DB_VERSION = 1;

/** Retain queued rows for 7 days (ingestion_strategy §4) */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Exponential backoff base (ms), cap 30s + jitter */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;
const JITTER_MS = 500;

/** After this many retryable failures, drop the row (avoid infinite growth) */
const MAX_RETRYABLE_ATTEMPTS = 40;

let _dbPromise = null;
let _listenersInstalled = false;
let _flushTimer = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'event_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked — close other tabs'));
  });
  return _dbPromise;
}

function jitterDelayMs(retryCount) {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.min(retryCount, 16));
  const jitter = Math.floor(Math.random() * JITTER_MS);
  return exp + jitter;
}

async function idbTx(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let out;
    try {
      out = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('tx aborted'));
  });
}

/**
 * Remove rows older than 7 days.
 */
export async function pruneTelemetryQueueExpired() {
  const cutoff = Date.now() - RETENTION_MS;
  const rows = await loadAllRows();
  const stale = rows.filter((r) => {
    const t = r.first_queued_utc ? Date.parse(r.first_queued_utc) : 0;
    return t && t < cutoff;
  });
  for (const r of stale) {
    await idbTx(STORE, 'readwrite', (store) => store.delete(r.event_id));
  }
  return stale.length;
}

/**
 * @returns {Promise<{ event_id: string, envelope: object, first_queued_utc: string, retry_count: number, last_attempt_utc?: string, last_error?: string, next_attempt_utc?: string|null }[]>}
 */
async function loadAllRows() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function pickAllowlistKeys(envelope, allowedKeys) {
  if (!allowedKeys?.length) return envelope;
  const allow = new Set(allowedKeys);
  const out = {};
  for (const k of Object.keys(envelope)) {
    if (allow.has(k)) out[k] = envelope[k];
  }
  return out;
}

/**
 * Persist one canonical envelope (already built; must include event_id).
 * @param {Record<string, unknown>} envelope
 * @param {{ allowlistKeys?: string[] }} [options] - After finalize, keep only these keys (dispatch_event schema)
 */
export async function enqueueCanonicalEvent(envelope, options = {}) {
  const event_id = envelope?.event_id;
  if (typeof event_id !== 'string' || !event_id) {
    throw new Error('enqueueCanonicalEvent: envelope.event_id required');
  }
  let finalized = finalizeCanonicalEnvelopeForIngest(envelope);
  if (options.allowlistKeys?.length) {
    finalized = pickAllowlistKeys(finalized, options.allowlistKeys);
  }
  const now = new Date().toISOString();
  const row = {
    event_id,
    envelope: finalized,
    first_queued_utc: now,
    retry_count: 0,
    next_attempt_utc: null,
    last_error: null,
    last_attempt_utc: null,
  };
  await idbTx(STORE, 'readwrite', (store) => store.put(row));
  await pruneTelemetryQueueExpired();
  scheduleFlushSoon();
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void flushTelemetryQueue();
  }
  return event_id;
}

/**
 * @param {import('@/api/telemetryIngestion').IngestionResult} result
 */
function isNoUrlSkip(result) {
  return Boolean(result.skipped && result.message === 'ingestion URL not configured');
}

/**
 * Flush pending rows to the ingestion API.
 * @returns {Promise<{ sent: number, failedRetryable: number, failedPermanent: number, skippedNoUrl: number }>}
 */
export async function flushTelemetryQueue() {
  await pruneTelemetryQueueExpired();
  const rows = await loadAllRows();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let sent = 0;
  let failedRetryable = 0;
  let failedPermanent = 0;
  let skippedNoUrl = 0;

  const due = rows.filter((r) => {
    if (!r || !r.event_id) return false;
    if (r.next_attempt_utc == null || r.next_attempt_utc === '') return true;
    return Date.parse(r.next_attempt_utc) <= now;
  });

  due.sort((a, b) => String(a.first_queued_utc).localeCompare(String(b.first_queued_utc)));

  for (const row of due) {
    const result = await sendCanonicalEnvelope(row.envelope);

    if (result.ok) {
      await idbTx(STORE, 'readwrite', (store) => store.delete(row.event_id));
      sent += 1;
      continue;
    }

    if (isNoUrlSkip(result)) {
      skippedNoUrl += 1;
      const next = new Date(now + 60_000).toISOString();
      await idbTx(STORE, 'readwrite', (store) =>
        store.put({
          ...row,
          last_attempt_utc: nowIso,
          last_error: result.message || 'no URL',
          next_attempt_utc: next,
          retry_count: row.retry_count,
        })
      );
      continue;
    }

    if (!result.retryable) {
      await idbTx(STORE, 'readwrite', (store) => store.delete(row.event_id));
      failedPermanent += 1;
      console.error('[telemetryQueue] permanent failure, dropped', row.event_id, result);
      continue;
    }

    const nextRetry = row.retry_count + 1;
    if (nextRetry >= MAX_RETRYABLE_ATTEMPTS) {
      await idbTx(STORE, 'readwrite', (store) => store.delete(row.event_id));
      failedPermanent += 1;
      console.error('[telemetryQueue] max retries, dropped', row.event_id, result);
      continue;
    }

    const delay = jitterDelayMs(row.retry_count);
    const nextAttempt = new Date(now + delay).toISOString();
    await idbTx(STORE, 'readwrite', (store) =>
      store.put({
        ...row,
        retry_count: nextRetry,
        last_attempt_utc: nowIso,
        last_error: result.message || `HTTP ${result.status ?? ''}`,
        next_attempt_utc: nextAttempt,
      })
    );
    failedRetryable += 1;
  }

  return { sent, failedRetryable, failedPermanent, skippedNoUrl };
}

/**
 * @returns {Promise<{ depth: number, oldest_first_queued_utc: string | null, sample_errors: string[] }>}
 */
export async function getQueueStats() {
  await pruneTelemetryQueueExpired();
  const rows = await loadAllRows();
  const errors = rows
    .map((r) => r.last_error)
    .filter(Boolean)
    .slice(0, 3);
  const oldest = rows
    .map((r) => r.first_queued_utc)
    .filter(Boolean)
    .sort()[0];
  return {
    depth: rows.length,
    oldest_first_queued_utc: oldest || null,
    sample_errors: errors,
  };
}

/**
 * Read-only: count queued telemetry rows whose envelope.job_id matches this job (string-coerced).
 * Does not flush or mutate the queue.
 * @param {string|number|null|undefined} jobId
 * @returns {Promise<{ depth: number, hasPending: boolean, sample_errors: string[] }>}
 */
export async function getTelemetryQueueDepthForJob(jobId) {
  if (jobId == null || jobId === '') {
    return { depth: 0, hasPending: false, sample_errors: [] };
  }
  await pruneTelemetryQueueExpired();
  const rows = await loadAllRows();
  const jid = String(jobId);
  const matched = rows.filter((r) => String(r.envelope?.job_id ?? '') === jid);
  const errors = matched
    .map((r) => r.last_error)
    .filter(Boolean)
    .slice(0, 2);
  return {
    depth: matched.length,
    hasPending: matched.length > 0,
    sample_errors: errors,
  };
}

function scheduleFlushSoon() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flushTelemetryQueue();
  }, 400);
}

function onOnline() {
  void flushTelemetryQueue();
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    void flushTelemetryQueue();
  }
}

/**
 * Call once from app bootstrap (e.g. main.jsx).
 */
export function registerTelemetryQueueListeners() {
  if (_listenersInstalled || typeof window === 'undefined') return;
  _listenersInstalled = true;
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushTelemetryQueue();
    }
  }, 5000);
}
