/**
 * tests/useUploadQueue.test.js
 * Unit tests for the useUploadQueue hook module-level logic.
 *
 * We test the pure state-management layer (loadFromStorage, queue mutations,
 * derived counts) by directly importing and calling the exported helpers.
 * Network calls (base44.integrations.Core.UploadFile) are mocked.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────
vi.mock('@/api/base44Client', () => ({
  base44: {
    integrations: { Core: { UploadFile: vi.fn().mockResolvedValue({ file_url: 'https://cdn.example.com/test.jpg' }) } },
    entities: { Evidence: { create: vi.fn().mockResolvedValue({ id: 'ev-new' }) } },
  },
}));

vi.mock('@/lib/indexedFileStore', () => ({
  setFile:            vi.fn().mockResolvedValue(undefined),
  getFile:            vi.fn().mockResolvedValue(new File(['data'], 'test.jpg', { type: 'image/jpeg' })),
  deleteFile:         vi.fn().mockResolvedValue(undefined),
  pruneOrphanedFiles: vi.fn().mockResolvedValue(undefined),
}));

// Stub navigator.onLine
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

// ── Import after mocks ────────────────────────────────────────────────
import { useUploadQueue, __resetForTest__ } from '../src/hooks/useUploadQueue.js';

const QUEUE_KEY = 'purpulse_upload_queue_v3';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeFile(name = 'photo.jpg') {
  return new File(['fake-image-data'], name, { type: 'image/jpeg' });
}

// ── Tests ─────────────────────────────────────────────────────────────
describe('useUploadQueue', () => {
  beforeEach(() => {
    __resetForTest__();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with an empty queue', () => {
    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });
    expect(result.current.queue).toHaveLength(0);
    expect(result.current.pending).toBe(0);
    expect(result.current.uploading).toBe(0);
    expect(result.current.done).toBe(0);
    expect(result.current.failed).toBe(0);
  });

  it('addToQueue adds items with status=pending', () => {
    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });

    act(() => {
      result.current.addToQueue([makeFile('a.jpg'), makeFile('b.jpg')], {}, 'job-1');
    });

    expect(result.current.queue).toHaveLength(2);
    expect(result.current.pending).toBe(2);
    result.current.queue.forEach(item => {
      expect(item.status).toBe('pending');
      expect(item.jobId).toBe('job-1');
      expect(item.retryCount).toBe(0);
      expect(item.id).toMatch(/^uq-/);
    });
  });

  it('cancelItem removes item from queue', () => {
    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });

    act(() => { result.current.addToQueue([makeFile()], {}, 'job-1'); });
    const id = result.current.queue[0].id;

    act(() => { result.current.cancelItem(id); });

    expect(result.current.queue).toHaveLength(0);
  });

  it('clearDone removes only done/cancelled/expired items', () => {
    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });

    // Inject mixed state via localStorage before hook init
    __resetForTest__();
    const items = [
      { id: 'q1', status: 'done',    jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
      { id: 'q2', status: 'pending', jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
      { id: 'q3', status: 'failed',  jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const { result: r2 } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });
    act(() => { r2.current.clearDone(); });

    expect(r2.current.queue.find(i => i.id === 'q1')).toBeUndefined();
    expect(r2.current.queue.find(i => i.id === 'q2')).toBeDefined();
    expect(r2.current.queue.find(i => i.id === 'q3')).toBeDefined();
  });

  it('retryAll resets all failed items to pending', () => {
    __resetForTest__();
    const items = [
      { id: 'q1', status: 'failed',  retryCount: 5, jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
      { id: 'q2', status: 'pending', retryCount: 0, jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });
    act(() => { result.current.retryAll(); });

    const q1 = result.current.queue.find(i => i.id === 'q1');
    expect(q1.status).toBe('pending');
    expect(q1.retryCount).toBe(0);
    expect(q1.error).toBeNull();
  });

  it('pauseItem sets status to paused; resumeItem sets back to pending', () => {
    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });

    act(() => { result.current.addToQueue([makeFile()], {}, 'job-2'); });
    const id = result.current.queue[0].id;

    act(() => { result.current.pauseItem(id); });
    expect(result.current.queue.find(i => i.id === id)?.status).toBe('paused');

    act(() => { result.current.resumeItem(id); });
    expect(result.current.queue.find(i => i.id === id)?.status).toBe('pending');
  });

  it('persists queue to localStorage on mutation', () => {
    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });

    act(() => { result.current.addToQueue([makeFile()], {}, 'job-3'); });

    const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('pending');
  });

  it('auto-expires items older than 7 days on hydration', () => {
    __resetForTest__();
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      { id: 'old', status: 'pending', jobId: 'j1', metadata: {}, addedAt: oldDate },
      { id: 'new', status: 'pending', jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });
    // old item gets status 'expired'; new stays pending_rehydrate (becomes pending after IDB check)
    const old = result.current.queue.find(i => i.id === 'old');
    expect(old.status).toBe('expired');
  });

  it('metrics reflects correct counts', () => {
    __resetForTest__();
    const items = [
      { id: 'a', status: 'done',    jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
      { id: 'b', status: 'failed',  jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
      { id: 'c', status: 'pending', jobId: 'j1', metadata: {}, addedAt: new Date().toISOString() },
    ];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));

    const { result } = renderHook(() => useUploadQueue(), { wrapper: makeWrapper() });
    expect(result.current.metrics.queueSize).toBe(3);
    expect(result.current.metrics.done).toBe(1);
    expect(result.current.metrics.failed).toBe(1);
  });
});