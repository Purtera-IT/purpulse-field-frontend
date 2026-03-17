/**
 * POST /mock/api/labels
 *
 * Request:
 * {
 *   evidenceId: UUID,
 *   jobId?: UUID,
 *   labelerId: string (email or UUID),
 *   label: string,            // e.g. 'pass', 'defect:corrosion'
 *   confidence: number,       // 0.0 – 1.0
 *   notes?: string,
 *   labelerToolVersion?: string,
 *   bbox?: { x, y, w, h },   // normalised 0–1
 *   approvedForTraining?: boolean
 * }
 *
 * Effects:
 *   1. Insert into LabelRecord table
 *   2. Insert into AuditLog (action_type: 'label_applied')
 *
 * Response: { success: true, label: LabelRecord }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    evidenceId, jobId, labelerId, label,
    confidence, notes, labelerToolVersion,
    bbox, approvedForTraining,
  } = body;

  if (!evidenceId || !label) {
    return Response.json({ error: 'evidenceId and label are required' }, { status: 400 });
  }

  const now        = new Date().toISOString();
  const actorEmail = labelerId || user.email;

  // Derive label_type / label_value from label string (e.g. 'defect:corrosion')
  const [labelType, labelValue] = label.includes(':')
    ? label.split(':')
    : [label, label];

  const TRAINING_TYPES = new Set(['pass', 'qc_pass', 'training_approved']);

  // ── 1. Label row ───────────────────────────────────────────────────
  const labelRow = await base44.asServiceRole.entities.LabelRecord.create({
    evidence_id:          evidenceId,
    job_id:               jobId         || undefined,
    label_type:           labelType,
    label_value:          labelValue     || undefined,
    confidence:           confidence != null ? +confidence : 1.0,
    bbox:                 bbox ? JSON.stringify(bbox) : undefined,
    labeled_by:           actorEmail,
    labeled_at:           now,
    model_version:        labelerToolVersion || undefined,
    approved_for_training:approvedForTraining ?? TRAINING_TYPES.has(labelType),
    qc_status:            TRAINING_TYPES.has(labelType) ? 'approved' : 'pending',
    notes:                notes || undefined,
  });

  // ── 2. Audit log ───────────────────────────────────────────────────
  await base44.asServiceRole.entities.AuditLog.create({
    action_type:     'label_applied',
    entity_type:     'label_record',
    entity_id:       labelRow.id,
    actor_email:     actorEmail,
    actor_role:      'technician',
    payload_summary: JSON.stringify({
      evidence_id:  evidenceId,
      label_type:   labelType,
      label_value:  labelValue,
      confidence,
    }),
    result:          'success',
    client_ts:       now,
    server_ts:       now,
    job_id:          jobId || undefined,
  }).catch(() => {});

  /*
   * Sample request:
   * {
   *   "evidenceId": "550e8400-...",
   *   "jobId": "WO-2026-0001",
   *   "labelerId": "admin@purpulse.com",
   *   "label": "defect:corrosion",
   *   "confidence": 0.91,
   *   "notes": "Surface corrosion on mounting bracket",
   *   "labelerToolVersion": "purpulse-labeler-v1.2",
   *   "bbox": { "x": 0.51, "y": 0.19, "w": 0.31, "h": 0.22 }
   * }
   *
   * Sample response:
   * {
   *   "success": true,
   *   "label": {
   *     "id": "uuid",
   *     "evidence_id": "550e8400-...",
   *     "label_type": "defect",
   *     "label_value": "corrosion",
   *     "confidence": 0.91,
   *     "qc_status": "pending",
   *     "approved_for_training": false,
   *     ...
   *   }
   * }
   */
  return Response.json({ success: true, label: labelRow });
});