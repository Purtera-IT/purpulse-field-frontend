/**
 * useUploadQueue — offline-persistent upload queue (v3)
 *
 * Architecture:
 *   - Module-level _queue + pub-sub: state shared across all hook instances in one tab
 *   - File blobs in IndexedDB (indexedFileStore) — survive page reloads & restarts
 *   - Queue metadata in localStorage only (no blobs)
 *   - On reload: pending/uploading/processing items are async-checked in IndexedDB
 *       blob present  → status: 'pending'          (auto-resume on online)
 *       blob missing  → status: 'needs_reattach'   (user re-selects file)
 *   - Items older than MAX_OFFLINE_WINDOW_DAYS are auto-expired on hydration
 *   - Exponential backoff retry: delay = min(30s, 2^attempt * 1s), up to RETRY_LIMIT
 *   - Upload slot released during backoff → other items continue uploading
 *
 * Config:
 *   MAX_CONCURRENT          — parallel uploads in flight         (default: 2)
 *   RETRY_LIMIT             — max auto-retries per item          (default: 5)
 *   UPLOAD_TIMEOUT_MS       — per-attempt timeout                (default: 60s)
 *   MAX_OFFLINE_WINDOW_DAYS — expire stuck items older than N days (default: 7)
 */

import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { setFile, getFile, deleteFile, pruneOrphanedFiles } from '@/lib/indexedFileStore';
import {
  emitArtifactEventForCompletedUpload,
  fetchJobContextForArtifactEvent,
} from '@/lib/artifactEvent';

// ── Config ────────────────────────────────────────────────────────────
const QUEUE_KEY              = 'purpulse_upload_queue_v3';
const MAX_CONCURRENT         = 2;
const RETRY_LIMIT            = 5;
const UPLOAD_TIMEOUT_MS      = 60_000;
const MAX_OFFLINE_WINDOW_DAYS = 7;

// ── Module singletons (one set per browser tab) ───────────────────────
const previewStore = new Map();   // id → objectURL (in-memory, regenerated from IDB)
let _queue         = [];
let _active        = 0;
const _listeners   = new Set();
let _queryClient   = null;
let _initialized   = false;

// ── Core state helpers ────────────────────────────────────────────────
function broadcast() { _listeners.forEach(fn => fn([..._queue])); }

function persist() {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(_queue));
}

function set(next) { _queue = next; persist(); broadcast(); }

function patch(id, updates) {
  set(_queue.map(item => item.id === id ? { ...item, ...updates } : item));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeId() {
  return 'uq-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

// ── Hydration ─────────────────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw       = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    const cutoffMs  = Date.now() - MAX_OFFLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return raw.map(item => {
      // Auto-expire stuck items that are too old
      if (
        item.addedAt &&
        new Date(item.addedAt).getTime() < cutoffMs &&
        ['pending', 'uploading', 'processing', 'needs_reattach', 'paused'].includes(item.status)
      ) {
        deleteFile(item.id).catch(() => {});
        return {
          ...item,
          status: 'expired',
          error: `Expired after ${MAX_OFFLINE_WINDOW_DAYS} days offline — please recapture`,
        };
      }
      // Active items need async IDB check before resuming
      if (['pending', 'uploading', 'processing'].includes(item.status)) {
        return { ...item, status: 'pending_rehydrate' };
      }
      return item;
    });
  } catch { return []; }
}

async function rehydrateItems() {
  const toCheck = _queue.filter(i => i.status === 'pending_rehydrate');
  await Promise.all(toCheck.map(async (item) => {
    try {
      const file = await getFile(item.id);
      if (file) {
        if (!previewStore.has(item.id)) previewStore.set(item.id, URL.createObjectURL(file));
        patch(item.id, { status: 'pending', error: null });
      } else {
        patch(item.id, { status: 'needs_reattach', error: 'File not found — tap to re-add' });
      }
    } catch {
      patch(item.id, { status: 'needs_reattach', error: 'Could not read stored file' });
    }
  }));

  // Prune orphaned IDB blobs whose queue items were removed externally
  const validIds = _queue.map(i => i.id);
  pruneOrphanedFiles(validIds).catch(() => {});
}

// ── Upload pipeline ───────────────────────────────────────────────────
async function uploadItemOnce(item) {
  const file = await getFile(item.id);
  if (!file) {
    patch(item.id, { status: 'needs_reattach', error: 'File lost — please re-add' });
    _active--;
    processNext();
    return;
  }

  patch(item.id, { status: 'uploading', progress: 0, error: null });

  // Simulate progress (base44 SDK has no XHR progress callback)
  let prog = 0;
  const tick = setInterval(() => {
    prog = Math.min(prog + 12, 82);
    patch(item.id, { progress: prog });
  }, 280);

  try {
    const uploadPromise  = base44.integrations.Core.UploadFile({ file });
    const timeoutPromise = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Upload timed out')), UPLOAD_TIMEOUT_MS)
    );
    const { file_url } = await Promise.race([uploadPromise, timeoutPromise]);
    clearInterval(tick);

    // Server-side processing simulation (OCR, face-blur)
    patch(item.id, { status: 'processing', progress: 92, processingStep: 'face-blur' });
    await sleep(800);
    patch(item.id, { processingStep: 'ocr' });
    await sleep(700);

    const currentItem = _queue.find(i => i.id === item.id) || item;
    const evidence = await base44.entities.Evidence.create({
      job_id:       currentItem.jobId,
      evidence_type: currentItem.metadata.tags?.[0] || 'general',
      file_url,
      notes: [
        currentItem.metadata.note,
        currentItem.metadata.serial_number ? `Serial: ${currentItem.metadata.serial_number}` : null,
        currentItem.metadata.part_number   ? `Part: ${currentItem.metadata.part_number}`     : null,
      ].filter(Boolean).join(' · '),
      captured_at: currentItem.metadata.capture_ts,
      geo_lat:     currentItem.metadata.lat  || null,
      geo_lon:     currentItem.metadata.lon  || null,
      status:      'uploaded',
      content_type: file.type,
      size_bytes:  file.size,
    });

    try {
      const job = await fetchJobContextForArtifactEvent(currentItem.jobId);
      await emitArtifactEventForCompletedUpload({
        job,
        user: null,
        evidence,
        metadata: currentItem.metadata,
        photoUploadedCount: 1,
        photoRequiredCount:
          typeof currentItem.metadata?.photo_required_count === 'number'
            ? currentItem.metadata.photo_required_count
            : null,
      });
    } catch (err) {
      console.warn('[artifact_event] failed to enqueue after upload', err);
    }

    // Cleanup IDB blob after confirmed upload
    await deleteFile(item.id).catch(() => {});
    const url = previewStore.get(item.id);
    if (url) { URL.revokeObjectURL(url); previewStore.delete(item.id); }

    patch(item.id, { status: 'done', progress: 100, evidenceId: evidence.id, qc_status: 'ok' });
    _queryClient?.invalidateQueries({ queryKey: ['evidence', item.jobId] });
    _active--;
    processNext();

  } catch (err) {
    clearInterval(tick);
    const currentItem    = _queue.find(i => i.id === item.id) || item;
    const nextRetryCount = (currentItem.retryCount || 0) + 1;
    _active--;

    if (nextRetryCount > RETRY_LIMIT) {
      patch(item.id, {
        status: 'failed',
        progress: 0,
        retryCount: nextRetryCount,
        error: err?.message || 'Upload failed — max retries reached',
      });
      processNext();
    } else {
      // Exponential backoff — slot released so other items can upload during wait
      const delayMs = Math.min(30_000, Math.pow(2, nextRetryCount) * 1000);
      patch(item.id, {
        status: 'pending',
        progress: 0,
        retryCount: nextRetryCount,
        error: `Retry ${nextRetryCount}/${RETRY_LIMIT} in ${Math.round(delayMs / 1000)}s…`,
      });
      setTimeout(() => {
        const latest = _queue.find(i => i.id === item.id);
        if (latest && latest.status === 'pending') processNext();
      }, delayMs);
    }
  }
}

function processNext() {
  if (!navigator.onLine) return;
  const pending = _queue.filter(i => i.status === 'pending');
  while (_active < MAX_CONCURRENT && pending.length > 0) {
    const next = pending.shift();
    _active++;
    uploadItemOnce(next);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────
export function useUploadQueue(queryClient) {
  const [queue, setQueueState] = useState(() => {
    if (!_initialized) {
      _initialized = true;
      _queue = loadFromStorage();
    }
    return [..._queue];
  });

  if (queryClient && !_queryClient) _queryClient = queryClient;

  useEffect(() => {
    _listeners.add(setQueueState);
    return () => _listeners.delete(setQueueState);
  }, []);

  // Async IDB rehydration on mount — then kick off any pending uploads
  useEffect(() => {
    const hasPending = _queue.some(i => i.status === 'pending_rehydrate');
    if (hasPending) {
      rehydrateItems().then(() => { if (navigator.onLine) processNext(); });
    } else if (navigator.onLine) {
      processNext();
    }
  }, []);  

  // Auto-flush when connectivity restored
  useEffect(() => {
    const onOnline = () => processNext();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // ── Public actions ────────────────────────────────────────────────
  const addToQueue = useCallback((files, metadata, jobId, onFirstUploaded) => {
    const newItems = files.map(file => {
      const id = makeId();
      // Async IDB write — on failure mark needs_reattach
      setFile(id, file).catch(err => {
        console.error('[UploadQueue] IDB write failed:', id, err);
        setTimeout(() => patch(id, { status: 'needs_reattach', error: 'Failed to persist file' }), 0);
      });
      previewStore.set(id, URL.createObjectURL(file));
      return {
        id, jobId,
        filename: file.name,
        size: file.size,
        contentType: file.type,
        addedAt: new Date().toISOString(),
        metadata: {
          client_event_id: id,
          job_id: jobId,
          capture_ts: new Date().toISOString(),
          face_blur: true,
          tags: [],
          ...metadata,
        },
        status: 'pending',
        progress: 0,
        retryCount: 0,
        error: null,
        evidenceId: null,
        qc_status: null,
        onFirstUploaded,
      };
    });
    set([..._queue, ...newItems]);
    processNext();
  }, []);

  const retryItem = useCallback(async (id) => {
    const file = await getFile(id).catch(() => null);
    if (!file) {
      patch(id, { status: 'needs_reattach', error: 'File not found — please re-add' });
      return;
    }
    patch(id, { status: 'pending', progress: 0, error: null, retryCount: 0 });
    processNext();
  }, []);

  /** Re-attach a new file to a needs_reattach queue item and resume upload. */
  const reattachFile = useCallback(async (id, file) => {
    await setFile(id, file).catch(err => console.error('[UploadQueue] reattach IDB write failed:', err));
    const old = previewStore.get(id);
    if (old) URL.revokeObjectURL(old);
    previewStore.set(id, URL.createObjectURL(file));
    patch(id, { status: 'pending', progress: 0, error: null, filename: file.name, retryCount: 0 });
    processNext();
  }, []);

  const pauseItem = useCallback((id) => { patch(id, { status: 'paused' }); }, []);

  const resumeItem = useCallback((id) => {
    patch(id, { status: 'pending' });
    processNext();
  }, []);

  const cancelItem = useCallback((id) => {
    deleteFile(id).catch(() => {});
    const url = previewStore.get(id);
    if (url) URL.revokeObjectURL(url);
    previewStore.delete(id);
    set(_queue.filter(i => i.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    set(_queue.filter(i => !['done', 'cancelled', 'expired'].includes(i.status)));
  }, []);

  const retryAll = useCallback(() => {
    set(_queue.map(i =>
      i.status === 'failed' ? { ...i, status: 'pending', error: null, retryCount: 0 } : i
    ));
    processNext();
  }, []);

  const getPreview = useCallback((id) => previewStore.get(id) ?? null, []);

  // ── Derived state ─────────────────────────────────────────────────
  const pending       = queue.filter(i => i.status === 'pending').length;
  const uploading     = queue.filter(i => ['uploading', 'processing'].includes(i.status)).length;
  const failed        = queue.filter(i => ['failed', 'needs_reattach'].includes(i.status)).length;
  const done          = queue.filter(i => i.status === 'done').length;
  const needsReattach = queue.filter(i => i.status === 'needs_reattach').length;
  const expired       = queue.filter(i => i.status === 'expired').length;

  /** Observability snapshot — expose to monitoring / logging. */
  const metrics = { queueSize: queue.length, pending, uploading, failed, done, needsReattach, expired };
  if (import.meta.env.DEV && metrics.failed > 0) {
    console.debug('[UploadQueue] metrics:', metrics);
  }

  return {
    queue, pending, uploading, failed, done, needsReattach, expired, metrics,
    addToQueue, retryItem, reattachFile,
    pauseItem, resumeItem, cancelItem, clearDone, retryAll, getPreview,
  };
}

// ── Test utilities (no-op in production) ─────────────────────────────
export function __resetForTest__() {
  _queue       = [];
  _active      = 0;
  _initialized = false;
  _queryClient = null;
  _listeners.clear();
  previewStore.clear();
  localStorage.removeItem(QUEUE_KEY);
}