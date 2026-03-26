/**
 * Core entity type definitions for Purpulse field app
 * Ensures type safety and contract validation across adapters
 */

// ── Job Entity ──
export interface Job {
  id: string;
  external_id?: string;
  title: string;
  description?: string;
  project_name?: string;
  company_name?: string;
  site_id?: string;
  site_name?: string;
  site_address?: string;
  site_lat?: number;
  site_lon?: number;
  assigned_to?: string;
  assigned_name?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  scheduled_date?: string; // ISO date
  scheduled_time?: string;
  check_in_time?: string;
  work_start_time?: string;
  work_end_time?: string;
  status: JobStatus;
  priority?: JobPriority;
  sync_status?: SyncStatus;
  progress?: number; // 0-100
  access_instructions?: string;
  hazards?: string;
  deliverables_remaining?: number;
  in_geofence?: boolean;
  company_name?: string;
  // Runbook & evidence
  runbook_phases?: RunbookPhase[];
  evidence_requirements?: EvidenceRequirement[];
  fields_schema?: FieldSchema[];
  // Closeout
  signoff_signer_name?: string;
  signoff_signature_url?: string;
  signoff_csat?: number;
  signoff_notes?: string;
  qc_status?: 'pending' | 'passed' | 'failed';
  qc_fail_reasons?: string;
  technician_closeout_outcome?: 'clean' | 'concerns' | 'problematic';
  technician_closeout_rating?: number | null;
  technician_closeout_complaint_flag?: boolean;
  technician_closeout_compliment_flag?: boolean;
  technician_closeout_notes?: string;
  technician_closeout_recorded_at?: string;
  // Metadata
  created_date?: string;
  updated_date?: string;
  created_by?: string;
}

export type JobStatus =
  | 'assigned'
  | 'en_route'
  | 'checked_in'
  | 'in_progress'
  | 'paused'
  | 'pending_closeout'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'qc_required'
  | 'closed';

export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SyncStatus = 'synced' | 'pending' | 'error';

export interface RunbookPhase {
  id: string;
  name: string;
  order: number;
  color?: string;
  tasks: RunbookStep[];
}

export interface RunbookStep {
  id: string;
  name: string;
  description?: string;
  order: number;
  required_evidence_types?: string[];
  completed?: boolean;
  completed_at?: string;
  gate?: 'blocking' | 'warning' | 'info';
}

export interface EvidenceRequirement {
  type: string;
  label: string;
  min_count: number;
  description?: string;
}

export interface FieldSchema {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  value?: string;
}

// ── Evidence Entity ──
export interface Evidence {
  id: string;
  job_id: string;
  evidence_type: EvidenceType;
  file_url?: string;
  thumbnail_url?: string;
  azure_blob_url?: string;
  content_type?: string;
  size_bytes?: number;
  sha256?: string;
  exif_metadata?: ExifData;
  captured_at?: string;
  geo_lat?: number;
  geo_lon?: number;
  geo_altitude_m?: number;
  geo_accuracy_m?: number;
  status: 'pending_upload' | 'uploading' | 'uploaded' | 'error' | 'replaced';
  upload_error?: string;
  quality_score?: number;
  quality_warning?: string;
  runbook_step_id?: string;
  replaced_by?: string;
  notes?: string;
  approved_for_training?: boolean;
  created_date?: string;
  updated_date?: string;
}

export type EvidenceType =
  | 'site_photo'
  | 'before_photo'
  | 'after_photo'
  | 'equipment_label'
  | 'signature'
  | 'chat_attachment';

export interface ExifData {
  make?: string;
  model?: string;
  iso?: number;
  focal_mm?: number;
  exposure_s?: number;
  width_px?: number;
  height_px?: number;
  orientation?: number;
}

// ── Activity Entity ──
export interface Activity {
  id: string;
  event_type: ActivityEventType;
  user_id: string;
  job_id?: string;
  work_order_id?: string;
  site_id?: string;
  runbook_step_id?: string;
  timestamp: string;
  meta?: Record<string, any>;
  session_id?: string;
  created_date?: string;
}

export type ActivityEventType =
  | 'clock_in'
  | 'clock_out'
  | 'start_step'
  | 'end_step'
  | 'upload'
  | 'label'
  | 'blocker_created'
  | 'blocker_resolved'
  | 'note_added'
  | 'qc_review'
  | 'manifest_export';

// ── Meeting Entity ──
export interface Meeting {
  id: string;
  job_id: string;
  title: string;
  meeting_type: MeetingType;
  scheduled_at: string;
  ended_at?: string;
  duration_min?: number;
  location?: string;
  attendees?: string[];
  external_attendees?: string;
  transcript_url?: string;
  recording_url?: string;
  summary?: string;
  action_items?: string; // JSON array
  attachments?: MeetingAttachment[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  sync_status?: SyncStatus;
  created_date?: string;
  updated_date?: string;
}

export type MeetingType =
  | 'kickoff'
  | 'safety_brief'
  | 'progress'
  | 'debrief'
  | 'incident'
  | 'client_walkthrough';

export interface MeetingAttachment {
  filename: string;
  file_url: string;
  content_type?: string;
}

// ── LabelRecord Entity ──
export interface LabelRecord {
  id: string;
  evidence_id: string;
  job_id: string;
  label_type: LabelType;
  label_value?: string;
  confidence?: number; // 0.0-1.0
  bbox?: string; // JSON {x, y, w, h} normalized 0-1
  labeled_by: string;
  labeled_at: string;
  model_version?: string;
  embedding?: number[]; // 512-dim CLIP/ViT
  approved_for_training?: boolean;
  qc_status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  created_date?: string;
  updated_date?: string;
}

export type LabelType =
  | 'defect'
  | 'pass'
  | 'flag'
  | 'skip'
  | 'qc_fail'
  | 'qc_pass'
  | 'training_approved';

// ── AuditLog Entity ──
export interface AuditLog {
  id: string;
  job_id?: string;
  action_type: AuditActionType;
  entity_type?: string;
  entity_id?: string;
  actor_email: string;
  actor_role: ActorRole;
  payload_summary?: string; // JSON
  result: 'success' | 'error' | 'skipped';
  error_message?: string;
  client_ts: string;
  server_ts?: string;
  session_id?: string;
  device_id?: string;
  ip_address?: string;
  duration_ms?: number;
  created_date?: string;
}

export type AuditActionType =
  | 'evidence_upload'
  | 'evidence_retake'
  | 'evidence_delete'
  | 'time_start'
  | 'time_stop'
  | 'time_break_start'
  | 'time_break_end'
  | 'time_manual_edit'
  | 'blocker_created'
  | 'blocker_resolved'
  | 'runbook_step_complete'
  | 'runbook_phase_complete'
  | 'closeout_submitted'
  | 'closeout_approved'
  | 'closeout_rejected'
  | 'job_status_change'
  | 'label_applied'
  | 'label_approved'
  | 'label_rejected'
  | 'meeting_created'
  | 'meeting_transcript_attached'
  | 'manifest_exported'
  | 'audit_exported'
  | 'admin_bulk_action'
  | 'user_login'
  | 'user_logout'
  | 'dataset_snapshot_created';

export type ActorRole = 'technician' | 'dispatcher' | 'admin' | 'system';

// ── Adapter Interfaces ──
export interface JobsAdapter {
  getJob(id: string): Promise<Job>;
  listJobs(
    filters?: Record<string, any>,
    sort?: string,
    limit?: number
  ): Promise<Job[]>;
  createJob(data: Partial<Job>): Promise<Job>;
  updateJob(id: string, data: Partial<Job>): Promise<Job>;
  deleteJob(id: string): Promise<void>;
}

export interface EvidenceAdapter {
  getEvidence(id: string): Promise<Evidence>;
  listEvidence(jobId: string): Promise<Evidence[]>;
  createEvidence(data: Partial<Evidence>): Promise<Evidence>;
  updateEvidence(id: string, data: Partial<Evidence>): Promise<Evidence>;
  deleteEvidence(id: string): Promise<void>;
}

export interface UploadAdapter {
  uploadFile(file: File, options?: UploadOptions): Promise<UploadResult>;
  uploadPrivateFile(file: File, options?: UploadOptions): Promise<UploadResult>;
}

export interface UploadOptions {
  jobId?: string;
  evidenceId?: string;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  file_url: string;
  file_uri?: string;
  size_bytes?: number;
  content_type?: string;
}

// ── TimeEntry ──
export interface TimeEntry {
  id: string;
  job_id: string;
  entry_type: TimeEntryType;
  timestamp: string;
  source: 'app' | 'manual' | 'drag_edit';
  geo_lat?: number;
  geo_lon?: number;
  notes?: string;
  sync_status?: SyncStatus;
  client_request_id?: string;
  locked?: boolean;
  approved_by?: string;
  approved_at?: string;
  override_reason?: string;
  created_date?: string;
  updated_date?: string;
}

export type TimeEntryType =
  | 'work_start'
  | 'work_stop'
  | 'break_start'
  | 'break_end'
  | 'travel_start'
  | 'travel_end';

// ── Blocker ──
export interface Blocker {
  id: string;
  job_id: string;
  blocker_type: BlockerType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  note: string;
  photo_evidence_ids?: string[];
  status: 'open' | 'acknowledged' | 'resolved';
  sync_status?: SyncStatus;
  created_date?: string;
  updated_date?: string;
}

export type BlockerType =
  | 'access_issue'
  | 'equipment_missing'
  | 'safety_concern'
  | 'weather'
  | 'customer_unavailable'
  | 'scope_change'
  | 'other';

// ── ChatMessage ──
export interface ChatMessage {
  id: string;
  job_id: string;
  thread_id?: string;
  client_message_id?: string;
  sender_email: string;
  sender_name?: string;
  body: string;
  attachments?: ChatAttachment[];
  sent_at: string;
  sync_status?: SyncStatus;
  created_date?: string;
}

export interface ChatAttachment {
  evidence_id?: string;
  file_url: string;
  content_type?: string;
}

// ── Validation result ──
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}