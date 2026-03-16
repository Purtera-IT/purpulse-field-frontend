/**
 * Mock time entries for today — realistic field tech day.
 * Two jobs: Tower Install (morning) → Ground System (afternoon).
 * Used when no DB entries exist.
 */

function ts(h, m = 0) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export const MOCK_JOB_ID_1 = 'mock-j1';
export const MOCK_JOB_ID_2 = 'mock-j2';

export const MOCK_TIME_ENTRIES = [
  // ── Morning: travel to Job 1 ─────────────────────
  { id: 'te-1',  job_id: MOCK_JOB_ID_1, entry_type: 'travel_start', timestamp: ts(7, 40), source: 'app', sync_status: 'synced', geo_lat: 37.7800, geo_lon: -122.4200 },
  { id: 'te-2',  job_id: MOCK_JOB_ID_1, entry_type: 'travel_end',   timestamp: ts(8, 12), source: 'app', sync_status: 'synced', geo_lat: 37.7749, geo_lon: -122.4194 },
  // ── Work on Job 1 ────────────────────────────────
  { id: 'te-3',  job_id: MOCK_JOB_ID_1, entry_type: 'work_start',   timestamp: ts(8, 14), source: 'app', sync_status: 'synced', geo_lat: 37.7749, geo_lon: -122.4194 },
  // Coffee break
  { id: 'te-4',  job_id: MOCK_JOB_ID_1, entry_type: 'break_start',  timestamp: ts(10, 5), source: 'app', sync_status: 'synced' },
  { id: 'te-5',  job_id: MOCK_JOB_ID_1, entry_type: 'break_end',    timestamp: ts(10, 20), source: 'app', sync_status: 'synced' },
  { id: 'te-6',  job_id: MOCK_JOB_ID_1, entry_type: 'work_start',   timestamp: ts(10, 21), source: 'app', sync_status: 'synced' },
  // Lunch break
  { id: 'te-7',  job_id: MOCK_JOB_ID_1, entry_type: 'work_stop',    timestamp: ts(12, 30), source: 'app', sync_status: 'synced' },
  { id: 'te-8',  job_id: MOCK_JOB_ID_1, entry_type: 'break_start',  timestamp: ts(12, 30), source: 'app', sync_status: 'synced' },
  { id: 'te-9',  job_id: MOCK_JOB_ID_1, entry_type: 'break_end',    timestamp: ts(13, 5),  source: 'app', sync_status: 'synced' },
  // ── Travel to Job 2 ──────────────────────────────
  { id: 'te-10', job_id: MOCK_JOB_ID_2, entry_type: 'travel_start', timestamp: ts(13, 8),  source: 'app', sync_status: 'synced', geo_lat: 37.7749, geo_lon: -122.4194 },
  { id: 'te-11', job_id: MOCK_JOB_ID_2, entry_type: 'travel_end',   timestamp: ts(13, 44), source: 'app', sync_status: 'synced', geo_lat: 37.7850, geo_lon: -122.4050 },
  // ── Work on Job 2 (ongoing) ───────────────────────
  { id: 'te-12', job_id: MOCK_JOB_ID_2, entry_type: 'work_start',   timestamp: ts(13, 45), source: 'app', sync_status: 'synced', geo_lat: 37.7850, geo_lon: -122.4050 },
  // Note: no work_stop → currently active
];

export const MOCK_JOBS_FOR_TIME = [
  { id: MOCK_JOB_ID_1, title: 'Macro Cell Tower — Foundation Phase', site_name: 'Oakland Site A', site_lat: 37.7749, site_lon: -122.4194, priority: 'high',   status: 'in_progress' },
  { id: MOCK_JOB_ID_2, title: 'Ground System Install — Site B',      site_name: 'SF Site B',      site_lat: 37.7850, site_lon: -122.4050, priority: 'medium', status: 'in_progress' },
];