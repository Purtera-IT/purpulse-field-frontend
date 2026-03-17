/**
 * useUploadQueue unit tests
 *
 * Setup:  npm install -D vitest @vitest/ui jsdom
 * Run:    npx vitest run              (or: npm test)
 *
 * Add to package.json:
 *   "scripts": { "test": "vitest run" },
 *   "devDependencies": { "vitest": "^1.4.0", "jsdom": "^24.0.0" }
 *
 * vitest.config.js:
 *   export default { test: { environment: 'jsdom', globals: true } }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────
vi.mock('@/lib/indexedFileStore', () => {
  const store = new Map();
  return {
    setFile:              vi.fn(async (id, file) => { store.set(id, file); }),
    getFile:              vi.fn(async (id) => store.get(id) ?? null),
    deleteFile:           vi.fn(async (id) => { store.delete(id); }),
    pruneOrphanedFiles:   vi.fn(async () => 0),
    __store__:            store, // test access
  };
});

vi.mock('@/api/base44Client', () => ({
  base44: {
    integrations: {
      Core: {
        UploadFile: vi.fn().mockResolvedValue({ file_url: 'https://cdn.purpulse.io/test.jpg' }),
      },
    },
    entities: {
      Evidence: {
        create: vi.fn().mockResolvedValue({ id: 'ev-123' }),
      },
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────
function makeFile(name = 'test.jpg', size = 1024) {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

// ── Tests ─────────────────────────────────────────────────────────────
describe('useUploadQueue', () => {
  let resetFn;

  beforeEach(async () => {
    // Lazy import so mocks are in place first
    const mod = await import('@/hooks/useUploadQueue');
    resetFn = mod.__resetForTest__;
    resetFn();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetFn?.();
  });

  // ── A. Add & persist ────────────────────────────────────────────────
  it('adds item to queue and persists blob to IndexedDB', async () => {
    const { useUploadQueue } = await import('@/hooks/useUploadQueue');
    const { result } = renderHook(() => useUploadQueue());

    const file = makeFile();
    act(() => { result.current.addToQueue([file], { tags: ['before'] }, 'job-1'); });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].status).toBe('pending');
    expect(result.current.queue[0].jobId).toBe('job-1');

    // Wait for fire-and-forget IDB write
    const { setFile } = await import('@/lib/indexedFileStore');
    await vi.runAllMicrotasksAsync();
    expect(setFile).toHaveBeenCalledOnce();
  });

  // ── B. Page reload resume ────────────────────────────────────────────
  it('resumes pending item after simulated page reload when blob exists', async () => {
    const { useUploadQueue, __resetForTest__ } = await import('@/hooks/useUploadQueue');
    const { getFile } = await import('@/lib/indexedFileStore');

    // Seed localStorage with a pending item (simulates previous session)
    const fakeId = 'uq-aaa-bbb';
    localStorage.setItem('purpulse_upload_queue_v3', JSON.stringify([{
      id: fakeId, jobId: 'job-1',
      filename: 'photo.jpg', size: 512, contentType: 'image/jpeg',
      addedAt: new Date().toISOString(),
      status: 'pending',   // will become pending_rehydrate on load
      progress: 0, retryCount: 0, error: null, evidenceId: null,
      metadata: { client_event_id: fakeId, job_id: 'job-1', tags: ['before'], capture_ts: new Date().toISOString() },
    }]));

    // Ensure IDB mock returns a blob for this id
    getFile.mockResolvedValueOnce(makeFile());

    __resetForTest__();  // force re-init so loadFromStorage picks up new localStorage

    const { result } = renderHook(() => useUploadQueue());
    // After rehydrateItems resolves, item should be 'pending'
    await vi.runAllMicrotasksAsync();

    const item = result.current.queue.find(i => i.id === fakeId);
    expect(item).toBeDefined();
    expect(item.status).toBe('pending');
  });

  // ── C. needs_reattach when blob is gone ──────────────────────────────
  it('marks item needs_reattach when blob is absent from IndexedDB', async () => {
    const { useUploadQueue, __resetForTest__ } = await import('@/hooks/useUploadQueue');
    const { getFile } = await import('@/lib/indexedFileStore');

    const fakeId = 'uq-lost-file';
    localStorage.setItem('purpulse_upload_queue_v3', JSON.stringify([{
      id: fakeId, jobId: 'job-2',
      filename: 'lost.jpg', size: 512, contentType: 'image/jpeg',
      addedAt: new Date().toISOString(), status: 'pending',
      progress: 0, retryCount: 0, error: null, evidenceId: null,
      metadata: { client_event_id: fakeId, job_id: 'job-2', tags: [], capture_ts: new Date().toISOString() },
    }]));

    getFile.mockResolvedValueOnce(null); // blob missing
    __resetForTest__();

    const { result } = renderHook(() => useUploadQueue());
    await vi.runAllMicrotasksAsync();

    const item = result.current.queue.find(i => i.id === fakeId);
    expect(item?.status).toBe('needs_reattach');
    expect(result.current.needsReattach).toBe(1);
  });

  // ── D. Expiry of old items ────────────────────────────────────────────
  it('expires items older than MAX_OFFLINE_WINDOW_DAYS', async () => {
    const { useUploadQueue, __resetForTest__ } = await import('@/hooks/useUploadQueue');

    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(); // 8 days ago
    const fakeId  = 'uq-old-item';
    localStorage.setItem('purpulse_upload_queue_v3', JSON.stringify([{
      id: fakeId, jobId: 'job-3',
      filename: 'old.jpg', size: 512, contentType: 'image/jpeg',
      addedAt: oldDate, status: 'pending',
      progress: 0, retryCount: 0, error: null, evidenceId: null,
      metadata: { client_event_id: fakeId, job_id: 'job-3', tags: [], capture_ts: oldDate },
    }]));

    __resetForTest__();
    const { result } = renderHook(() => useUploadQueue());

    const item = result.current.queue.find(i => i.id === fakeId);
    expect(item?.status).toBe('expired');
    expect(result.current.expired).toBe(1);
  });

  // ── E. cancelItem cleans up IDB and object URL ───────────────────────
  it('cancelItem removes blob from IndexedDB', async () => {
    const { useUploadQueue } = await import('@/hooks/useUploadQueue');
    const { deleteFile } = await import('@/lib/indexedFileStore');

    const { result } = renderHook(() => useUploadQueue());
    const file = makeFile();

    act(() => { result.current.addToQueue([file], {}, 'job-4'); });
    await vi.runAllMicrotasksAsync();

    const id = result.current.queue[0].id;
    act(() => { result.current.cancelItem(id); });

    expect(result.current.queue).toHaveLength(0);
    expect(deleteFile).toHaveBeenCalledWith(id);
  });

  // ── F. retryAll resets failed items ──────────────────────────────────
  it('retryAll sets failed items back to pending', async () => {
    const { useUploadQueue, __resetForTest__ } = await import('@/hooks/useUploadQueue');

    const fakeId = 'uq-failed';
    localStorage.setItem('purpulse_upload_queue_v3', JSON.stringify([{
      id: fakeId, jobId: 'job-5', filename: 'f.jpg', size: 100,
      addedAt: new Date().toISOString(), status: 'failed',
      progress: 0, retryCount: 5, error: 'Network error', evidenceId: null,
      metadata: { client_event_id: fakeId, job_id: 'job-5', tags: [], capture_ts: new Date().toISOString() },
    }]));
    __resetForTest__();

    const { result } = renderHook(() => useUploadQueue());
    act(() => { result.current.retryAll(); });

    const item = result.current.queue.find(i => i.id === fakeId);
    expect(item?.status).toBe('pending');
    expect(item?.retryCount).toBe(0);
  });

  // ── G. Metrics ───────────────────────────────────────────────────────
  it('metrics counts reflect queue state', async () => {
    const { useUploadQueue } = await import('@/hooks/useUploadQueue');
    const { result } = renderHook(() => useUploadQueue());

    act(() => { result.current.addToQueue([makeFile(), makeFile()], {}, 'job-6'); });
    await vi.runAllMicrotasksAsync();

    expect(result.current.metrics.queueSize).toBe(2);
    expect(result.current.metrics.pending).toBe(2);
    expect(result.current.metrics.failed).toBe(0);
  });
});