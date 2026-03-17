/**
 * Field App Adapter Layer
 * All components accept adapter props; swap Base44 adapters for any backend.
 * Includes runtime validation to prevent crashes from malformed API responses.
 */
import { base44 } from '@/api/base44Client';
import {
  validateJob,
  validateJobs,
  validateEvidence,
  validateEvidenceList,
  validateActivity,
  validateActivityList,
  validateLabelRecord,
  validateAuditLog,
  validateAuditLogList,
} from '@/lib/validation/validator';

// ── Internal audit writer ─────────────────────────────────────────────
async function writeAudit(entry) {
  try {
    await base44.entities.AuditLog.create({
      action_type:     entry.action_type || 'unknown',
      entity_type:     entry.entity_type || '',
      entity_id:       entry.entity_id  || '',
      actor_email:     entry.actor_email || 'system',
      actor_role:      entry.actor_role  || 'technician',
      payload_summary: typeof entry.payload === 'object' ? JSON.stringify(entry.payload) : (entry.payload || ''),
      result:          entry.result      || 'success',
      error_message:   entry.error_message || undefined,
      client_ts:       new Date().toISOString(),
      server_ts:       new Date().toISOString(),
      session_id:      entry.session_id  || '',
      device_id:       entry.device_id   || '',
      duration_ms:     entry.duration_ms || 0,
      job_id:          entry.job_id      || undefined,
    });
  } catch (e) {
    console.warn('[AuditAdapter] Failed to write audit log:', e);
  }
}

// ── Jobs Adapter ───────────────────────────────────────────────────────
export class Base44JobsAdapter {
  async listJobs() {
    try {
      const data = await base44.entities.Job.list('-scheduled_date', 200);
      const validated = validateJobs(data);
      if (validated.length < data.length) {
        console.warn(`[Jobs] Filtered ${data.length - validated.length} invalid job records`);
      }
      return validated;
    } catch (err) {
      console.error('[Jobs] listJobs failed:', err);
      return [];
    }
  }

  async getJob(id) {
    try {
      const rows = await base44.entities.Job.filter({ id });
      if (!rows || rows.length === 0) return null;
      const result = validateJob(rows[0]);
      if (result.success && result.data) {
        return result.data;
      }
      console.error('[Jobs] getJob validation failed:', result.errors);
      return null;
    } catch (err) {
      console.error('[Jobs] getJob failed:', err);
      return null;
    }
  }

  async updateJob(id, data, actorEmail = 'system') {
    const start = Date.now();
    try {
      const result = await base44.entities.Job.update(id, data);
      const validated = validateJob(result);
      if (!validated.success) {
        console.warn('[Jobs] updateJob returned invalid data, storing partial:', validated.errors);
      }

      await writeAudit({
        action_type: data.status ? 'job_status_change' : 'admin_bulk_action',
        entity_type: 'job',
        entity_id:   id,
        actor_email: actorEmail,
        actor_role:  'technician',
        payload:     data,
        job_id:      id,
        duration_ms: Date.now() - start,
      });

      return validated.success ? validated.data : result;
    } catch (err) {
      console.error('[Jobs] updateJob failed:', err);
      await writeAudit({
        action_type: 'admin_bulk_action',
        entity_type: 'job',
        entity_id:   id,
        actor_email: actorEmail,
        result:      'error',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        duration_ms: Date.now() - start,
      });
      throw err;
    }
  }
}

// ── Upload Adapter ─────────────────────────────────────────────────────
export class Base44UploadAdapter {
  /**
   * requestUploadToken — mock token (real impl calls Azure SAS endpoint)
   * Returns: { token, upload_url, expires_at }
   */
  async requestUploadToken(file, jobId, stepId) {
    await new Promise(r => setTimeout(r, 250)); // simulate network RTT
    return {
      token:      crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      upload_url: `mock://purpulse-blob/evidence-prod/${jobId}/${encodeURIComponent(file.name)}`,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      storage_backend: localStorage.getItem('purpulse_storage_backend') || 'base44',
    };
  }

  /**
   * completeUpload — creates Evidence record after upload finishes
   * Validates response before storing to prevent crashes from malformed data
   */
  async completeUpload(token, evidenceData, actorEmail = 'system') {
    const start = Date.now();
    try {
      const record = await base44.entities.Evidence.create(evidenceData);
      const validated = validateEvidence(record);

      if (!validated.success) {
        console.warn('[Upload] Evidence validation failed:', validated.errors);
      }

      await writeAudit({
        action_type: 'evidence_upload',
        entity_type: 'evidence',
        entity_id:   record.id || 'unknown',
        actor_email: actorEmail,
        job_id:      evidenceData.job_id,
        payload: {
          filename:      evidenceData.filename || '',
          evidence_type: evidenceData.evidence_type,
          size_bytes:    evidenceData.size_bytes,
        },
        duration_ms: Date.now() - start,
      });

      return validated.success ? validated.data : record;
    } catch (err) {
      console.error('[Upload] completeUpload failed:', err);
      await writeAudit({
        action_type: 'evidence_upload',
        entity_type: 'evidence',
        actor_email: actorEmail,
        job_id:      evidenceData.job_id,
        result:      'error',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        duration_ms: Date.now() - start,
      });
      throw err;
    }
  }

  async createManifestRow(data) {
    try {
      return await base44.entities.UploadManifest.create(data);
    } catch (err) {
      console.error('[Upload] createManifestRow failed:', err);
      throw err;
    }
  }
}

// ── Label Adapter ──────────────────────────────────────────────────────
export class Base44LabelAdapter {
  async createLabel(data, actorEmail = 'system') {
    try {
      const record = await base44.entities.LabelRecord.create(data);
      const validated = validateLabelRecord(record);

      if (!validated.success) {
        console.warn('[Label] LabelRecord validation failed:', validated.errors);
      }

      await writeAudit({
        action_type: 'label_applied',
        entity_type: 'label_record',
        entity_id:   record.id || 'unknown',
        actor_email: actorEmail,
        job_id:      data.job_id,
        payload: {
          label_type:  data.label_type,
          label_value: data.label_value,
          confidence:  data.confidence,
          evidence_id: data.evidence_id,
        },
      });

      return validated.success ? validated.data : record;
    } catch (err) {
      console.error('[Label] createLabel failed:', err);
      throw err;
    }
  }

  async updateLabel(id, data, actorEmail = 'system') {
    try {
      const record = await base44.entities.LabelRecord.update(id, data);
      const validated = validateLabelRecord(record);

      if (!validated.success) {
        console.warn('[Label] updateLabel validation failed:', validated.errors);
      }

      await writeAudit({
        action_type: data.approved_for_training !== undefined ? 'label_approved' : 'label_applied',
        entity_type: 'label_record',
        entity_id:   id,
        actor_email: actorEmail,
        payload:     data,
      });

      return validated.success ? validated.data : record;
    } catch (err) {
      console.error('[Label] updateLabel failed:', err);
      throw err;
    }
  }
}

// ── Activity Adapter ───────────────────────────────────────────────────
export class Base44ActivityAdapter {
  async logActivity(data, actorEmail = 'system') {
    const record = await base44.entities.Activity.create(data);
    const actionMap = {
      clock_in:  'time_start',
      clock_out: 'time_stop',
      start_step:'runbook_step_complete',
      end_step:  'runbook_step_complete',
    };
    await writeAudit({
      action_type: actionMap[data.event_type] || 'time_manual_edit',
      entity_type: 'activity',
      entity_id:   record.id,
      actor_email: actorEmail,
      job_id:      data.work_order_id,
      payload: { event_type: data.event_type, timestamp: data.timestamp },
    });
    return record;
  }

  async listActivities(workOrderId) {
    return base44.entities.Activity.filter({ work_order_id: workOrderId }, '-timestamp', 100);
  }
}

// ── Meeting Adapter ────────────────────────────────────────────────────
export class Base44MeetingAdapter {
  async createMeeting(data, actorEmail = 'system') {
    const record = await base44.entities.Meeting.create(data);
    await writeAudit({
      action_type: 'meeting_created',
      entity_type: 'meeting',
      entity_id:   record.id,
      actor_email: actorEmail,
      job_id:      data.job_id,
      payload:     { title: data.title, meeting_type: data.meeting_type },
    });
    return record;
  }

  async attachTranscript(id, transcriptUrl, actorEmail = 'system') {
    const record = await base44.entities.Meeting.update(id, { transcript_url: transcriptUrl, status: 'completed' });
    await writeAudit({
      action_type: 'meeting_transcript_attached',
      entity_type: 'meeting',
      entity_id:   id,
      actor_email: actorEmail,
      payload:     { transcript_url: transcriptUrl },
    });
    return record;
  }
}

// ── Audit Adapter ──────────────────────────────────────────────────────
export class Base44AuditAdapter {
  async log(entry) { return writeAudit(entry); }
  async list(jobId) {
    return base44.entities.AuditLog.filter({ job_id: jobId }, '-client_ts', 100);
  }
}

// ── Default adapter bundle ─────────────────────────────────────────────
export const defaultAdapters = {
  jobs:     new Base44JobsAdapter(),
  upload:   new Base44UploadAdapter(),
  label:    new Base44LabelAdapter(),
  activity: new Base44ActivityAdapter(),
  meeting:  new Base44MeetingAdapter(),
  audit:    new Base44AuditAdapter(),
};