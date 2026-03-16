import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const QUEUE_KEY = 'purpulse_job_event_queue';

function generateClientEventId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function eventTypeToJobUpdate(eventType, ts) {
  switch (eventType) {
    case 'check_in':   return { status: 'checked_in',  check_in_time: ts };
    case 'work_start': return { status: 'in_progress', work_start_time: ts };
    case 'work_stop':  return { status: 'paused' };
    default: return {};
  }
}

export function useJobQueue() {
  const [queue, setQueue] = useState(loadQueue);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Auto-flush when connection restored
  useEffect(() => { if (isOnline) flushQueue(); }, [isOnline]);

  const syncQueue = () => {
    const q = loadQueue();
    saveQueue(q);
    setQueue([...q]);
    return q;
  };

  const removeFromQueue = useCallback((clientEventId) => {
    const next = loadQueue().filter(e => e.client_event_id !== clientEventId);
    saveQueue(next);
    setQueue(next);
  }, []);

  const flushQueue = useCallback(async () => {
    const pending = loadQueue().filter(e => e.status === 'pending');
    for (const entry of pending) {
      try {
        const updates = eventTypeToJobUpdate(entry.event_type, entry.device_ts);
        await base44.entities.Job.update(entry.job_id, { ...updates, sync_status: 'synced' });
        removeFromQueue(entry.client_event_id);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      } catch (err) {
        const q = loadQueue().map(e =>
          e.client_event_id === entry.client_event_id
            ? { ...e, status: 'failed', retry_count: (e.retry_count || 0) + 1, last_error: err.message }
            : e
        );
        saveQueue(q);
        setQueue([...q]);
      }
    }
  }, [queryClient, removeFromQueue]);

  /**
   * Optimistic Start Timer:
   * 1. Generate client_event_id
   * 2. Optimistically update query cache (UI responds immediately)
   * 3. Persist event to localStorage queue
   * 4. If online, flush to API immediately; else queue for later
   *
   * Example POST body:
   * {
   *   "client_event_id": "evt-lp4abc-xyz",
   *   "event_type": "work_start",
   *   "assignee_id": "tech@example.com",
   *   "device_ts": "2026-03-16T15:49:00Z",
   *   "device_meta": { "battery": 0.72, "gps_accuracy": 5 }
   * }
   */
  const startTimer = useCallback(async (job, currentUser) => {
    const clientEventId = generateClientEventId();
    const deviceTs = new Date().toISOString();
    const eventType = ['assigned', 'en_route'].includes(job.status) ? 'check_in' : 'work_start';
    const optimisticStatus = eventType === 'check_in' ? 'checked_in' : 'in_progress';

    // 1. Optimistic UI — instant response, no wait
    queryClient.setQueryData(['jobs'], (old = []) =>
      old.map(j => j.id === job.id
        ? { ...j, status: optimisticStatus, sync_status: 'pending' }
        : j
      )
    );

    // 2. Build event payload (mirrors POST /api/v1/jobs/{jobId}/events)
    const entry = {
      client_event_id: clientEventId,
      job_id: job.id,
      event_type: eventType,
      assignee_id: currentUser?.email || 'unknown',
      device_ts: deviceTs,
      device_meta: { battery: null, gps_accuracy: null },
      status: 'pending',
      retry_count: 0,
      created_at: deviceTs,
    };

    // 3. Persist to local queue (survives page reload)
    const next = [...loadQueue(), entry];
    saveQueue(next);
    setQueue(next);

    // 4. Flush immediately if online
    if (navigator.onLine) {
      try {
        const updates = eventTypeToJobUpdate(eventType, deviceTs);
        await base44.entities.Job.update(job.id, { ...updates, sync_status: 'synced' });
        removeFromQueue(clientEventId);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        return { ...entry, status: 'synced' };
      } catch (err) {
        const q = loadQueue().map(e =>
          e.client_event_id === clientEventId
            ? { ...e, status: 'failed', last_error: err.message }
            : e
        );
        saveQueue(q);
        setQueue([...q]);
      }
    }

    return entry;
  }, [queryClient, removeFromQueue]);

  const pendingCount = queue.filter(e => e.status === 'pending').length;
  const failedCount  = queue.filter(e => e.status === 'failed').length;

  return { queue, pendingCount, failedCount, isOnline, startTimer, flushQueue };
}