/**
 * POST /mock/api/evidence
 *
 * Registers a completed upload. Side effects:
 *   1. Insert into Evidence table
 *   2. Insert into UploadManifest table
 *   3. Insert Activity (event_type: 'upload')
 *   4. Insert AuditLog
 *
 * Request body: EvidenceMeta (camelCase from UI)
 * Response: { success: true, evidence: EvidenceMeta, manifestId: UUID }
 *
 * ── EvidenceMeta shape ──────────────────────────────────────────────────
 * {
 *   id: UUID,
 *   workOrderId: UUID,
 *   siteId?: UUID,
 *   uploaderId?: UUID,
 *   blobUrl: string,
 *   storageContainer?: string,       // 'evidence-prod' | 'base44-staging'
 *   captureTs?: ISO8601,
 *   deviceTs?: ISO8601,
 *   captureLat?: number,
 *   captureLon?: number,
 *   mimeType?: string,
 *   width?: number,
 *   height?: number,
 *   fileSize?: number,
 *   sha256?: string,
 *   exif?: object,
 *   runbookStepId?: UUID,
 *   qcVerdict?: 'pass'|'fail'|'unknown',
 *   qcNotes?: string,
 *   createdAt?: ISO8601
 * }
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
    id, workOrderId, siteId, uploaderId, blobUrl, storageContainer,
    captureTs, deviceTs, captureLat, captureLon,
    mimeType, width, height, fileSize, sha256, exif,
    runbookStepId, qcVerdict, qcNotes, createdAt,
  } = body;

  if (!workOrderId || !blobUrl) {
    return Response.json({ error: 'workOrderId and blobUrl are required' }, { status: 400 });
  }

  const now          = new Date().toISOString();
  const evidenceId   = id   || crypto.randomUUID();
  const manifestId   = crypto.randomUUID();
  const activityId   = crypto.randomUUID();
  const auditId      = crypto.randomUUID();
  const actorEmail   = uploaderId || user.email;
  const startMs      = Date.now();

  // ── 1. Evidence row ────────────────────────────────────────────────
  const evidenceRow = {
    job_id:            workOrderId,
    evidence_type:     mimeType?.startsWith('video') ? 'general'
                     : mimeType === 'application/pdf' ? 'general'
                     : 'site_photo',
    file_url:          blobUrl,
    azure_blob_url:    storageContainer === 'azure-placeholder' ? blobUrl : undefined,
    content_type:      mimeType      || 'application/octet-stream',
    size_bytes:        fileSize       || undefined,
    sha256:            sha256         || undefined,
    exif_metadata:     exif           || undefined,
    captured_at:       captureTs      || now,
    geo_lat:           captureLat     || undefined,
    geo_lon:           captureLon     || undefined,
    status:            'uploaded',
    runbook_step_id:   runbookStepId  || undefined,
    qc_status:         qcVerdict === 'pass' ? 'approved' : qcVerdict === 'fail' ? 'rejected' : 'pending',
    notes:             qcNotes        || undefined,
    approved_for_training: false,
  };

  const evidence = await base44.asServiceRole.entities.Evidence.create(evidenceRow);

  // ── 2. Manifest row ────────────────────────────────────────────────
  const manifest = await base44.asServiceRole.entities.UploadManifest.create({
    job_id:            workOrderId,
    evidence_id:       evidence.id,
    filename:          blobUrl.split('/').pop() || 'upload',
    sha256:            sha256        || 'placeholder-' + evidenceId.slice(0, 8),
    file_url:          blobUrl,
    azure_blob_url:    blobUrl,
    content_type:      mimeType      || 'application/octet-stream',
    size_bytes:        fileSize       || undefined,
    width_px:          width          || undefined,
    height_px:         height         || undefined,
    geo_lat:           captureLat     || undefined,
    geo_lon:           captureLon     || undefined,
    capture_ts:        captureTs      || now,
    upload_ts:         now,
    evidence_type:     evidenceRow.evidence_type,
    runbook_step_id:   runbookStepId  || undefined,
    technician_email:  actorEmail,
    source_app_version:'2.4.1',
    sync_status:       'synced',
    azure_indexed:     false,
    approved_for_training: false,
  }).catch(() => ({ id: manifestId })); // non-fatal

  // ── 3. Activity row ────────────────────────────────────────────────
  await base44.asServiceRole.entities.Activity.create({
    event_type:      'upload',
    user_id:         actorEmail,
    work_order_id:   workOrderId,
    site_id:         siteId        || undefined,
    runbook_step_id: runbookStepId || undefined,
    timestamp:       now,
    meta: {
      evidence_id:  evidence.id,
      lat:          captureLat || undefined,
      lon:          captureLon || undefined,
      device_id:    'api-client',
      app_version:  '2.4.1',
    },
  }).catch(() => {});

  // ── 4. Audit log ───────────────────────────────────────────────────
  await base44.asServiceRole.entities.AuditLog.create({
    action_type:     'evidence_upload',
    entity_type:     'evidence',
    entity_id:       evidence.id,
    actor_email:     actorEmail,
    actor_role:      'technician',
    payload_summary: JSON.stringify({
      filename:      blobUrl.split('/').pop(),
      mime_type:     mimeType,
      size_bytes:    fileSize,
      work_order_id: workOrderId,
    }),
    result:          'success',
    client_ts:       captureTs || now,
    server_ts:       now,
    duration_ms:     Date.now() - startMs,
    job_id:          workOrderId,
  }).catch(() => {});

  /*
   * Sample request:
   * {
   *   "id": "550e8400-e29b-41d4-a716-446655440000",
   *   "workOrderId": "WO-2026-0001",
   *   "blobUrl": "https://mock-cdn.base44.app/evidence-prod/WO-2026-0001/.../photo.jpg",
   *   "mimeType": "image/jpeg",
   *   "fileSize": 2097152,
   *   "sha256": "a3f1c2d4e5b6...",
   *   "captureTs": "2026-03-17T10:00:00Z",
   *   "captureLat": 30.2672,
   *   "captureLon": -97.7431,
   *   "exif": { "make": "Apple", "model": "iPhone 15 Pro", "iso": 64 },
   *   "runbookStepId": "s1-1"
   * }
   *
   * Sample response:
   * {
   *   "success": true,
   *   "evidence": { "id": "...", "job_id": "WO-2026-0001", "status": "uploaded", ... },
   *   "manifestId": "uuid"
   * }
   */
  return Response.json({
    success:    true,
    evidence,
    manifestId: manifest?.id || manifestId,
  });
});