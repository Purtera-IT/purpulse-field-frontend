/**
 * useUploadQueue — offline-persistent upload queue
 *
 * Architecture:
 *   - Module-level _queue array + pub-sub: all hook instances share state in the same tab
 *   - File objects live in module-level fileStore Map (survives re-renders, not page reload)
 *   - localStorage stores item metadata only (no file blobs); items rehydrate on reload
 *     with status 'needs_reattach' if their file was lost
 *
 * Microflow (request → upload → complete):
 *   1. addToQueue(files, metadata, jobId)
 *      → each file: { client_event_id, status:'pending', progress:0 } → localStorage
 *   2. processNext() picks up to MAX_CONCURRENT pending items
 *      → status: 'uploading', simulated progress 0→85%
 *   3. base44.integrations.Core.UploadFile(file)       // SAS → PUT
 *   4. status: 'processing' (OCR / face-blur simulation, 1.5s)
 *   5. base44.entities.Evidence.create({ file_url, metadata… }) // complete call
 *   6. status: 'done', queryClient invalidation
 *
 * Example evidence metadata payload written to Evidence entity:
 * {
 *   "client_event_id": "evt-lp4abc-xyz",
 *   "job_id": "job-6789",
 *   "evidence_type": "before",
 *   "tags": ["before","rack"],
 *   "note": "Serial visible upper right",
 *   "face_blur": true,
 *   "capture_ts": "2026-03-16T15:49:00Z",
 *   "lat": 30.3035, "lon": -97.7453
 * }
 */

import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const QUEUE_KEY = 'purpulse_upload_queue_v2';
const MAX_CONCURRENT = 2;

// ── Module-level singletons (shared across all hook instances in same tab) ──
const fileStore = new Map();   // id → File
const previewStore = new Map(); // id → objectURL
let _queue = [];
let _active = 0;
const _listeners = new Set();
let _queryClient = null;

function broadcast() { _listeners.forEach(fn => fn([..._queue])); }

function persist() {
  const serialisable = _queue.map(({ ...item }) => item); // File not in item, safe to stringify
  localStorage.setItem(QUEUE_KEY, JSON.stringify(serialisable));
}

function set(next) { _queue = next; persist(); broadcast(); }

function patch(id, updates) {
  set(_queue.map(item => item.id === id ? { ...item, ...updates } : item));
}

function loadFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    // Items from previous session without a file → needs_reattach
    return raw.map(item =>
      ['pending', 'uploading', 'processing'].includes(item.status)
        ? { ...item, status: fileStore.has(item.id) ? item.status : 'needs_reattach' }
        : item
    );
  } catch { return []; }
}

function makeId() {
  return 'uq-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

async function uploadItem(item) {
  const file = fileStore.get(item.id);
  if (!file) {
    patch(item.id, { status: 'needs_reattach', error: 'File lost — please re-add' });
    _active--;
    processNext();
    return;
  }

  patch(item.id, { status: 'uploading', progress: 0, error: null });

  // Simulate upload progress (base44 UploadFile has no XHR progress callback)
  let prog = 0;
  const tick = setInterval(() => {
    prog = Math.min(prog + 12, 82);
    patch(item.id, { progress: prog });
  }, 280);

  try {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    clearInterval(tick);

    // Server processing simulation (OCR, face-blur)
    patch(item.id, { status: 'processing', progress: 92, processingStep: 'face-blur' });
    await new Promise(r => setTimeout(r, 800));
    patch(item.id, { processingStep: 'ocr' });
    await new Promise(r => setTimeout(r, 700));

    const evidence = await base44.entities.Evidence.create({
      job_id: item.jobId,
      evidence_type: item.metadata.tags?.[0] || 'general',
      file_url,
      notes: [
        item.metadata.note,
        item.metadata.serial_number ? `Serial: ${item.metadata.serial_number}` : null,
        item.metadata.part_number ? `Part: ${item.metadata.part_number}` : null,
      ].filter(Boolean).join(' · '),
      captured_at: item.metadata.capture_ts,
      geo_lat: item.metadata.lat || null,
      geo_lon: item.metadata.lon || null,
      status: 'uploaded',
      content_type: file.type,
      size_bytes: file.size,
    });

    patch(item.id, { status: 'done', progress: 100, evidenceId: evidence.id, qc_status: 'ok' });
    _queryClient?.invalidateQueries({ queryKey: ['evidence', item.jobId] });

  } catch (err) {
    clearInterval(tick);
    patch(item.id, {
      status: 'failed',
      progress: 0,
      retryCount: (item.retryCount || 0) + 1,
      error: err?.message || 'Upload failed',
    });
  }

  _active--;
  processNext();
}

function processNext() {
  if (!navigator.onLine) return;
  const pending = _queue.filter(i => i.status === 'pending');
  while (_active < MAX_CONCURRENT && pending.length > 0) {
    const next = pending.shift();
    _active++;
    uploadItem(next);
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useUploadQueue(queryClient) {
  const [queue, setQueue] = useState(() => {
    if (_queue.length === 0) _queue = loadFromStorage();
    return [..._queue];
  });

  if (queryClient && !_queryClient) _queryClient = queryClient;

  useEffect(() => {
    _listeners.add(setQueue);
    return () => _listeners.delete(setQueue);
  }, []);

  // Auto-flush when online
  useEffect(() => {
    const onOnline = () => processNext();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const addToQueue = useCallback((files, metadata, jobId, onFirstUploaded) => {
    const newItems = files.map(file => {
      const id = makeId();
      fileStore.set(id, file);
      previewStore.set(id, URL.createObjectURL(file));
      return {
        id, jobId,
        filename: file.name,
        size: file.size,
        contentType: file.type,
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

  const retryItem = useCallback((id) => {
    patch(id, { status: 'pending', progress: 0, error: null });
    processNext();
  }, []);

  const pauseItem = useCallback((id) => {
    patch(id, { status: 'paused' });
  }, []);

  const resumeItem = useCallback((id) => {
    patch(id, { status: 'pending' });
    processNext();
  }, []);

  const cancelItem = useCallback((id) => {
    fileStore.delete(id);
    const url = previewStore.get(id);
    if (url) URL.revokeObjectURL(url);
    previewStore.delete(id);
    set(_queue.filter(i => i.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    set(_queue.filter(i => i.status !== 'done' && i.status !== 'cancelled'));
  }, []);

  const retryAll = useCallback(() => {
    set(_queue.map(i => i.status === 'failed' ? { ...i, status: 'pending', error: null } : i));
    processNext();
  }, []);

  const getPreview = useCallback((id) => previewStore.get(id) || null, []);

  const pending   = queue.filter(i => i.status === 'pending').length;
  const uploading = queue.filter(i => i.status === 'uploading' || i.status === 'processing').length;
  const failed    = queue.filter(i => i.status === 'failed' || i.status === 'needs_reattach').length;
  const done      = queue.filter(i => i.status === 'done').length;

  return { queue, pending, uploading, failed, done, addToQueue, retryItem, pauseItem, resumeItem, cancelItem, clearDone, retryAll, getPreview };
}