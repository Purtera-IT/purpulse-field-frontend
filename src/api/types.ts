import { z } from 'zod'

/**
 * Shared types for API requests and responses
 * All entities include built-in Base44 fields: id, created_date, updated_date, created_by
 */

// ── Built-in fields (auto-managed by Base44) ──
const BaseEntity = z.object({
  id: z.string(),
  created_date: z.string().datetime(),
  updated_date: z.string().datetime(),
  created_by: z.string().email(),
})

// ── Job/Work Order ──
export const JobSchema = BaseEntity.extend({
  external_id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['assigned', 'en_route', 'checked_in', 'in_progress', 'paused', 'pending_closeout', 'submitted', 'approved', 'rejected']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  scheduled_date: z.string().datetime().optional(),
  scheduled_time: z.string().optional(),
  project_name: z.string().optional(),
  site_name: z.string().optional(),
  site_address: z.string().optional(),
  site_lat: z.number().optional(),
  site_lon: z.number().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional(),
  assigned_to: z.string().email().optional(),
  assigned_name: z.string().optional(),
  check_in_time: z.string().datetime().optional(),
  work_start_time: z.string().datetime().optional(),
  work_end_time: z.string().datetime().optional(),
  closeout_submitted_at: z.string().datetime().optional(),
  technician_closeout_outcome: z.enum(['clean', 'concerns', 'problematic']).optional(),
  technician_closeout_rating: z.number().int().min(1).max(5).nullable().optional(),
  technician_closeout_complaint_flag: z.boolean().optional(),
  technician_closeout_compliment_flag: z.boolean().optional(),
  technician_closeout_notes: z.string().optional(),
  technician_closeout_recorded_at: z.string().datetime().optional(),
  qc_status: z.enum(['pending', 'passed', 'failed']).optional(),
  qc_fail_reasons: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  deliverables_remaining: z.number().optional(),
  in_geofence: z.boolean().optional(),
  sync_status: z.enum(['synced', 'pending', 'error']).optional(),
})

export type Job = z.infer<typeof JobSchema>

// ── Technician ──
export const TechnicianSchema = BaseEntity.extend({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  skill_tags: z.array(z.string()).optional(),
  certifications: z.array(z.object({
    name: z.string(),
    issued: z.string().date().optional(),
    expires: z.string().date().optional(),
    status: z.enum(['valid', 'expired', 'expiring_soon']).optional(),
  })).optional(),
  home_base_city: z.string().optional(),
  badge_number: z.string().optional(),
  employment_type: z.enum(['full_time', 'contractor', 'sub_contractor']).optional(),
  active: z.boolean(),
})

export type Technician = z.infer<typeof TechnicianSchema>

// ── Evidence / Asset ──
// file_url: http(s) plus common non-http schemes from the field client / simulated storage.
// TECHNICAL_DEBT (real storage slice): Revisit when backends return blob:, signed custom schemes, or other
// URL shapes — widen this union or use a permissive string + server validation instead of enumerating schemes.
const EvidenceFileUrlSchema = z.union([
  z.string().url(),
  z.string().refine(
    (s) =>
      typeof s === 'string' &&
      (s.startsWith('data:') || s.startsWith('mock://') || s.startsWith('blob:')),
    { message: 'expected data:, mock:, or blob: URL' },
  ),
])

export const EvidenceSchema = BaseEntity.extend({
  job_id: z.string(),
  evidence_type: z.string(),
  file_url: EvidenceFileUrlSchema,
  thumbnail_url: z.string().url().optional(),
  azure_blob_url: z.string().optional(),
  content_type: z.string().optional(),
  size_bytes: z.number().optional(),
  sha256: z.string().optional(),
  captured_at: z.string().datetime().optional(),
  geo_lat: z.number().optional(),
  geo_lon: z.number().optional(),
  geo_altitude_m: z.number().optional(),
  geo_accuracy_m: z.number().optional(),
  status: z.enum(['pending_upload', 'uploading', 'uploaded', 'error', 'replaced']),
  upload_error: z.string().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  quality_warning: z.string().optional(),
  qc_status: z.string().optional(),
  runbook_step_id: z.string().optional(),
  exif_metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  approved_for_training: z.boolean(),
})

export type Evidence = z.infer<typeof EvidenceSchema>

// ── Label Record ──
export const LabelRecordSchema = BaseEntity.extend({
  evidence_id: z.string(),
  job_id: z.string(),
  label_type: z.enum(['defect', 'pass', 'flag', 'skip', 'qc_fail', 'qc_pass', 'training_approved']),
  label_value: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: z.string().optional(), // JSON string: {x, y, w, h}
  labeled_by: z.string(),
  labeled_at: z.string().datetime(),
  model_version: z.string().optional(),
  qc_status: z.enum(['pending', 'approved', 'rejected']),
  reviewed_by: z.string().optional(),
  reviewed_at: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export type LabelRecord = z.infer<typeof LabelRecordSchema>

// ── Time Entry ──
export const TimeEntrySchema = BaseEntity.extend({
  job_id: z.string(),
  entry_type: z.enum(['work_start', 'work_stop', 'break_start', 'break_end', 'travel_start', 'travel_end']),
  timestamp: z.string().datetime(),
  source: z.enum(['app', 'manual', 'drag_edit']),
  geo_lat: z.number().optional(),
  geo_lon: z.number().optional(),
  notes: z.string().optional(),
  sync_status: z.enum(['synced', 'pending', 'error']),
  locked: z.boolean(),
  approved_by: z.string().email().optional(),
  approved_at: z.string().datetime().optional(),
})

export type TimeEntry = z.infer<typeof TimeEntrySchema>

// ── Meeting ──
export const MeetingSchema = BaseEntity.extend({
  job_id: z.string(),
  title: z.string(),
  meeting_type: z.enum(['kickoff', 'safety_brief', 'progress', 'debrief', 'incident', 'client_walkthrough']),
  scheduled_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  duration_min: z.number().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  transcript_url: z.string().url().optional(),
  recording_url: z.string().url().optional(),
  summary: z.string().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
})

export type Meeting = z.infer<typeof MeetingSchema>

// ── Auth Response ──
export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    full_name: z.string(),
    role: z.enum(['admin', 'user', 'technician', 'dispatcher']),
  }),
  token: z.string(),
  expiresAt: z.string().datetime().optional(),
})

export type AuthResponse = z.infer<typeof AuthResponseSchema>

// ── Batch response wrapper ──
export const BatchResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number().optional(),
    pageSize: z.number().optional(),
  })

export type BatchResponse<T> = {
  items: T[]
  total: number
  page?: number
  pageSize?: number
}