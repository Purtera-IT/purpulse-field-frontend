/**
 * mockData.js — Purpulse Field App
 * Placeholder data models for dev / demo / Storybook use.
 * Replace with live base44 entity calls in production.
 */

export const MOCK_TECHNICIAN = {
  id: 'tech-001',
  full_name: 'Marcus Rivera',
  email: 'mrivera@purpulse.io',
  role: 'technician',
  avatar_initials: 'MR',
  badge_number: 'T-1042',
  cert_level: 'Level 3',
  region: 'West District',
};

export const MOCK_JOBS = [
  {
    id: 'job-001',
    external_id: 'WO-2024-8821',
    title: 'HVAC Unit Replacement — Bay 4',
    description: 'Full replacement of rooftop HVAC unit. Includes disconnect, removal, crane lift, reinstall, and commissioning.',
    status: 'in_progress',
    priority: 'high',
    scheduled_date: '2026-03-16',
    scheduled_time: '08:00',
    project_name: 'Riverside Industrial Complex',
    site_name: 'Warehouse B',
    site_address: '1224 Industrial Blvd, Oakland CA 94621',
    site_lat: 37.7749, site_lon: -122.2194,
    contact_name: 'Dana Cole', contact_phone: '+1 510 555 0198',
    assigned_to: 'mrivera@purpulse.io',
    check_in_time: '2026-03-16T08:14:00Z',
    work_start_time: '2026-03-16T08:20:00Z',
    sync_status: 'synced',
    qc_status: 'pending',
  },
  {
    id: 'job-002',
    external_id: 'WO-2024-8834',
    title: 'Electrical Panel Inspection',
    description: 'Annual safety inspection of main distribution panel, breaker testing, thermographic scan.',
    status: 'assigned',
    priority: 'medium',
    scheduled_date: '2026-03-16',
    scheduled_time: '13:00',
    project_name: 'Eastview Office Park',
    site_name: 'Building C',
    site_address: '440 Park Ave, Emeryville CA 94608',
    site_lat: 37.8309, site_lon: -122.2854,
    contact_name: 'Sam Liu', contact_phone: '+1 510 555 0342',
    assigned_to: 'mrivera@purpulse.io',
    sync_status: 'synced',
    qc_status: null,
  },
  {
    id: 'job-003',
    external_id: 'WO-2024-8801',
    title: 'Fire Suppression System Test',
    description: 'Quarterly test and inspection of sprinkler system per NFPA 25 requirements.',
    status: 'pending_closeout',
    priority: 'urgent',
    scheduled_date: '2026-03-15',
    scheduled_time: '09:00',
    project_name: 'Harbor Logistics Center',
    site_name: 'Zone A',
    site_address: '9900 Hegenberger Rd, Oakland CA 94621',
    site_lat: 37.7213, site_lon: -122.2152,
    contact_name: 'Troy Marsh', contact_phone: '+1 510 555 0571',
    assigned_to: 'mrivera@purpulse.io',
    work_end_time: '2026-03-15T16:45:00Z',
    sync_status: 'pending',
    qc_status: 'passed',
  },
  {
    id: 'job-004',
    external_id: 'WO-2024-8799',
    title: 'Cooling Tower Biocide Treatment',
    description: 'Monthly water treatment and biocide dosing. Sample collection required.',
    status: 'submitted',
    priority: 'low',
    scheduled_date: '2026-03-14',
    scheduled_time: '10:00',
    project_name: 'Bayside Tech Campus',
    site_name: 'Rooftop Plant',
    site_address: '2200 Mission College Blvd, Santa Clara CA 95054',
    site_lat: 37.3878, site_lon: -121.9807,
    contact_name: 'Nina Patel', contact_phone: '+1 408 555 0129',
    assigned_to: 'mrivera@purpulse.io',
    closeout_submitted_at: '2026-03-14T15:22:00Z',
    sync_status: 'synced',
    qc_status: 'passed',
  },
];

export const MOCK_TIME_ENTRIES = [
  { id: 'te-001', job_id: 'job-001', entry_type: 'travel_start', timestamp: '2026-03-16T07:32:00Z', source: 'app' },
  { id: 'te-002', job_id: 'job-001', entry_type: 'travel_end',   timestamp: '2026-03-16T08:11:00Z', source: 'app' },
  { id: 'te-003', job_id: 'job-001', entry_type: 'work_start',   timestamp: '2026-03-16T08:20:00Z', source: 'app' },
  { id: 'te-004', job_id: 'job-001', entry_type: 'break_start',  timestamp: '2026-03-16T10:00:00Z', source: 'app' },
  { id: 'te-005', job_id: 'job-001', entry_type: 'break_end',    timestamp: '2026-03-16T10:20:00Z', source: 'app' },
  { id: 'te-006', job_id: 'job-002', entry_type: 'travel_start', timestamp: '2026-03-16T12:15:00Z', source: 'app' },
];

export const MOCK_CHAT_THREADS = [
  {
    id: 'thread-job-001',
    job_id: 'job-001',
    job_title: 'HVAC Unit Replacement — Bay 4',
    last_message: 'Crane is confirmed for 11:30. Proceed with disconnect.',
    last_sender: 'Dispatch',
    last_at: '2026-03-16T09:45:00Z',
    unread: 2,
  },
  {
    id: 'thread-job-003',
    job_id: 'job-003',
    job_title: 'Fire Suppression System Test',
    last_message: 'Closeout approved. Nice work.',
    last_sender: 'Amanda Reyes (QC)',
    last_at: '2026-03-15T18:02:00Z',
    unread: 0,
  },
  {
    id: 'thread-general',
    job_id: null,
    job_title: 'Team Broadcast',
    last_message: 'Reminder: PPE audit next Thursday at 07:00.',
    last_sender: 'Safety Officer',
    last_at: '2026-03-15T10:30:00Z',
    unread: 1,
  },
];

export const MOCK_CHAT_MESSAGES = {
  'thread-job-001': [
    { id: 'msg-1', sender_name: 'Marcus Rivera', sender_email: 'mrivera@purpulse.io', body: 'On site. Starting disconnect now.', sent_at: '2026-03-16T08:22:00Z', is_me: true },
    { id: 'msg-2', sender_name: 'Dispatch', sender_email: 'dispatch@purpulse.io', body: 'Copy that. Crane ETA 11:30.', sent_at: '2026-03-16T08:25:00Z', is_me: false },
    { id: 'msg-3', sender_name: 'Dispatch', sender_email: 'dispatch@purpulse.io', body: 'Crane is confirmed for 11:30. Proceed with disconnect.', sent_at: '2026-03-16T09:45:00Z', is_me: false },
  ],
};

export const MOCK_SUPPORT_ITEMS = [
  {
    id: 'sup-001', type: 'faq',
    title: 'How do I edit a locked time entry?',
    body: 'Submit an unlock request via the TimeLog segment modal. An admin will review within 4 hours.',
  },
  {
    id: 'sup-002', type: 'faq',
    title: 'What happens when I lose connectivity?',
    body: 'All actions are queued locally (SyncQueue). They sync automatically when you reconnect.',
  },
  {
    id: 'sup-003', type: 'contact',
    title: 'Dispatch Hotline',
    body: '+1 800 PURPULS (787 7857) — available 06:00–22:00 PT',
  },
  {
    id: 'sup-004', type: 'contact',
    title: 'Emergency On-Call',
    body: '+1 800 555 0911 — 24/7 for safety critical events',
  },
  {
    id: 'sup-005', type: 'doc',
    title: 'Field Operations Manual v4.2',
    body: 'PDF — last updated Feb 2026',
  },
];

export const MOCK_PROFILE = {
  ...MOCK_TECHNICIAN,
  phone: '+1 510 555 0284',
  hire_date: '2022-06-01',
  certifications: [
    { name: 'OSHA 30-Hour',           expires: '2027-01-15', status: 'valid' },
    { name: 'EPA 608 Universal',       expires: '2028-06-30', status: 'valid' },
    { name: 'NFPA 70E Arc Flash',      expires: '2026-09-01', status: 'expiring_soon' },
    { name: 'Confined Space Entry',    expires: '2025-12-01', status: 'expired' },
  ],
  stats: {
    jobs_completed_ytd: 47,
    avg_csat: 4.8,
    on_time_rate: 94,
    hours_logged_week: 38.5,
  },
};