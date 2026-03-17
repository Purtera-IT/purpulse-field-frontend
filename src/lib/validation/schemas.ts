/**
 * Zod validation schemas for runtime contract enforcement
 * Validates API responses before use to prevent runtime crashes
 */
import { z } from 'zod';

// ── Enums ──
const JobStatusSchema = z.enum([
  'assigned',
  'en_route',
  'checked_in',
  'in_progress',
  'paused',
  'pending_closeout',
  'submitted',
  'approved',
  'rejected',
  'qc_required',
  'closed',
]);

const JobPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const SyncStatusSchema = z.enum(['synced', 'pending', 'error']).optional();

const EvidenceTypeSchema = z.enum([
  'site_photo',
  'before_photo',
  'after_photo',
  'equipment_label',
  'signature',
  'chat_attachment',
]);

const EvidenceStatusSchema = z.enum([
  'pending_upload',
  'uploading',
  'uploaded',
  'error',
  'replaced',
]);

const TimeEntryTypeSchema = z.enum([
  'work_start',
  'work_stop',
  'break_start',
  'break_end',
  'travel_start',
  'travel_end',
]);

const BlockerTypeSchema = z.enum([
  'access_issue',
  'equipment_missing',
  'safety_concern',
  'weather',
  'customer_unavailable',
  'scope_change',
  'other',
]);

const BlockerSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// ── ExifData ──
export const ExifDataSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  iso: z.number().optional(),
  focal_mm: z.number().optional(),
  exposure_s: z.number().optional(),
  width_px: z.number().optional(),
  height_px: z.number().optional(),
  orientation: z.number().optional(),
});

// ── Job ──
export const JobSchema = z.object({
  id: z.string(),
  external_id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  project_name: z.string().optional(),
  company_name: z.string().optional(),
  site_id: z.string().optional(),
  site_name: z.string().optional(),
  site_address: z.string().optional(),
  site_lat: z.number().optional(),
  site_lon: z.number().optional(),
  assigned_to: z.string().optional(),
  assigned_name: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  scheduled_date: z.string().optional(),
  scheduled_time: z.string().optional(),
  check_in_time: z.string().optional(),
  work_start_time: z.string().optional(),
  work_end_time: z.string().optional(),
  status: JobStatusSchema,
  priority: JobPrioritySchema.optional(),
  sync_status: SyncStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  access_instructions: z.string().optional(),
  hazards: z.string().optional(),
  deliverables_remaining: z.number().optional(),
  in_geofence: z.boolean().optional(),
  created_date: z.string().optional(),
  updated_date: z.string().optional(),
  created_by: z.string().optional(),
});

export type JobValidated = z.infer<typeof JobSchema>;

// ── Evidence ──
export const EvidenceSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  evidence_type: EvidenceTypeSchema,
  file_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  azure_blob_url: z.string().optional(),
  content_type: z.string().optional(),
  size_bytes: z.number().optional(),
  sha256: z.string().optional(),
  exif_metadata: ExifDataSchema.optional(),
  captured_at: z.string().optional(),
  geo_lat: z.number().optional(),
  geo_lon: z.number().optional(),
  geo_altitude_m: z.number().optional(),
  geo_accuracy_m: z.number().optional(),
  status: EvidenceStatusSchema,
  upload_error: z.string().optional(),
  quality_score: z.number().optional(),
  quality_warning: z.string().optional(),
  runbook_step_id: z.string().optional(),
  replaced_by: z.string().optional(),
  notes: z.string().optional(),
  approved_for_training: z.boolean().optional(),
  created_date: z.string().optional(),
  updated_date: z.string().optional(),
});

export type EvidenceValidated = z.infer<typeof EvidenceSchema>;

// ── Activity ──
export const ActivitySchema = z.object({
  id: z.string(),
  event_type: z.enum([
    'clock_in',
    'clock_out',
    'start_step',
    'end_step',
    'upload',
    'label',
    'blocker_created',
    'blocker_resolved',
    'note_added',
    'qc_review',
    'manifest_export',
  ]),
  user_id: z.string(),
  job_id: z.string().optional(),
  work_order_id: z.string().optional(),
  site_id: z.string().optional(),
  runbook_step_id: z.string().optional(),
  timestamp: z.string(),
  meta: z.record(z.any()).optional(),
  session_id: z.string().optional(),
  created_date: z.string().optional(),
});

export type ActivityValidated = z.infer<typeof ActivitySchema>;

// ── TimeEntry ──
export const TimeEntrySchema = z.object({
  id: z.string(),
  job_id: z.string(),
  entry_type: TimeEntryTypeSchema,
  timestamp: z.string(),
  source: z.enum(['app', 'manual', 'drag_edit']).default('app'),
  geo_lat: z.number().optional(),
  geo_lon: z.number().optional(),
  notes: z.string().optional(),
  sync_status: SyncStatusSchema,
  client_request_id: z.string().optional(),
  locked: z.boolean().optional(),
  approved_by: z.string().optional(),
  approved_at: z.string().optional(),
  override_reason: z.string().optional(),
  created_date: z.string().optional(),
  updated_date: z.string().optional(),
});

export type TimeEntryValidated = z.infer<typeof TimeEntrySchema>;

// ── Blocker ──
export const BlockerSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  blocker_type: BlockerTypeSchema,
  severity: BlockerSeveritySchema.default('medium'),
  note: z.string(),
  photo_evidence_ids: z.array(z.string()).optional(),
  status: z.enum(['open', 'acknowledged', 'resolved']).default('open'),
  sync_status: SyncStatusSchema,
  created_date: z.string().optional(),
  updated_date: z.string().optional(),
});

export type BlockerValidated = z.infer<typeof BlockerSchema>;

// ── ChatMessage ──
export const ChatMessageSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  thread_id: z.string().optional(),
  client_message_id: z.string().optional(),
  sender_email: z.string().email(),
  sender_name: z.string().optional(),
  body: z.string(),
  attachments: z
    .array(
      z.object({
        evidence_id: z.string().optional(),
        file_url: z.string().url(),
        content_type: z.string().optional(),
      })
    )
    .optional(),
  sent_at: z.string(),
  sync_status: SyncStatusSchema,
  created_date: z.string().optional(),
});

export type ChatMessageValidated = z.infer<typeof ChatMessageSchema>;

// ── LabelRecord ──
export const LabelRecordSchema = z.object({
  id: z.string(),
  evidence_id: z.string(),
  job_id: z.string(),
  label_type: z.enum([
    'defect',
    'pass',
    'flag',
    'skip',
    'qc_fail',
    'qc_pass',
    'training_approved',
  ]),
  label_value: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(1),
  bbox: z.string().optional(),
  labeled_by: z.string(),
  labeled_at: z.string(),
  model_version: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  approved_for_training: z.boolean().optional(),
  qc_status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  reviewed_by: z.string().optional(),
  reviewed_at: z.string().optional(),
  notes: z.string().optional(),
  created_date: z.string().optional(),
  updated_date: z.string().optional(),
});

export type LabelRecordValidated = z.infer<typeof LabelRecordSchema>;

// ── AuditLog ──
export const AuditLogSchema = z.object({
  id: z.string(),
  job_id: z.string().optional(),
  action_type: z.enum([
    'evidence_upload',
    'evidence_retake',
    'evidence_delete',
    'time_start',
    'time_stop',
    'time_break_start',
    'time_break_end',
    'time_manual_edit',
    'blocker_created',
    'blocker_resolved',
    'runbook_step_complete',
    'runbook_phase_complete',
    'closeout_submitted',
    'closeout_approved',
    'closeout_rejected',
    'job_status_change',
    'label_applied',
    'label_approved',
    'label_rejected',
    'meeting_created',
    'meeting_transcript_attached',
    'manifest_exported',
    'audit_exported',
    'admin_bulk_action',
    'user_login',
    'user_logout',
    'dataset_snapshot_created',
  ]),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  actor_email: z.string().email(),
  actor_role: z.enum(['technician', 'dispatcher', 'admin', 'system']),
  payload_summary: z.string().optional(),
  result: z.enum(['success', 'error', 'skipped']).default('success'),
  error_message: z.string().optional(),
  client_ts: z.string(),
  server_ts: z.string().optional(),
  session_id: z.string().optional(),
  device_id: z.string().optional(),
  ip_address: z.string().optional(),
  duration_ms: z.number().optional(),
  created_date: z.string().optional(),
});

export type AuditLogValidated = z.infer<typeof AuditLogSchema>;