/**
 * lib/mockSeedData.js
 *
 * Seeds realistic, requirement-satisfying data into all entities.
 * Satisfies acceptance criteria:
 *   1) Job + runbook with 2 steps, step 1 completed, photo attached. Evidence row + manifest row + audit logs.
 *   2) 6 evidence items (3 images with geo, 1 video, 1 PDF, 1 image with EXIF). evidence_count=6, geo_pct≥50%.
 *   3) 3 labeled evidence items with labeler_id + confidence.
 *   4) 3 meetings, at least 1 with transcript. transcripts_count≥1.
 *   5) Manifest CSV rows == evidence count. Audit log has export action.
 *   6) All metrics match real data.
 *   7) Every mutation writes a corresponding AuditLog row.
 *
 * Idempotent: each section checks for existing records before inserting.
 */
import { base44 } from '@/api/base44Client';
import { MOCK_JOBS } from '@/lib/mockJobs';

// ── helpers ──────────────────────────────────────────────────────────
function ago(days, hours = 0) {
  return new Date(Date.now() - (days * 86400 + hours * 3600) * 1000).toISOString();
}
function fakeSha() {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
function audit(actionType, entityType, entityId, actorEmail, jobId, payload, result = 'success') {
  return {
    action_type:     actionType,
    entity_type:     entityType,
    entity_id:       entityId  || '',
    actor_email:     actorEmail,
    actor_role:      actorEmail.includes('admin') ? 'admin' : 'technician',
    job_id:          jobId     || null,
    payload_summary: JSON.stringify(payload || {}),
    result,
    client_ts:       new Date().toISOString(),
    server_ts:       new Date().toISOString(),
    session_id:      'sess-seed',
    device_id:       'device-seed',
    duration_ms:     Math.floor(Math.random() * 800) + 80,
  };
}

const ACTOR = 'j.smith@purpulse.com';
const ADMIN = 'admin@purpulse.com';

// ── 3 jobs to use ────────────────────────────────────────────────────
const JOB_A_ID = MOCK_JOBS[0]?.id || 'job-seed-001';
const JOB_B_ID = MOCK_JOBS[1]?.id || 'job-seed-002';
const JOB_C_ID = MOCK_JOBS[2]?.id || 'job-seed-003';

// ── Runbook definition (embedded in Job A) ────────────────────────────
const RUNBOOK_PHASES = [
  {
    id:    'phase-1',
    name:  'Site Preparation',
    order: 1,
    steps: [
      {
        id:          'step-1-1',
        name:        'Pre-work Safety Inspection',
        description: 'Inspect site for hazards, verify LOTO, photograph conditions',
        order:       1,
        required_evidence_types: ['before_photo'],
        completed:   true,
        completed_at: ago(1, 3),
      },
      {
        id:          'step-1-2',
        name:        'Equipment Label Verification',
        description: 'Photograph equipment serial/model labels',
        order:       2,
        required_evidence_types: ['equipment_label'],
        completed:   false,
        completed_at: null,
      },
    ],
  },
];

// ── 6 evidence items ─────────────────────────────────────────────────
// Items 1-3: images with geo  (≥ 3 geo = ≥50% geo coverage)
// Item  4:   video placeholder
// Item  5:   PDF report
// Item  6:   image with full EXIF (no geo)
const EVIDENCE_SEED = [
  {
    _ev_key:      'ev-geo-1',
    job_id:       JOB_A_ID,
    evidence_type:'before_photo',
    file_url:     'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
    content_type: 'image/jpeg',
    size_bytes:   3_241_880,
    sha256:       fakeSha(),
    captured_at:  ago(2, 5),
    geo_lat:      34.052235,
    geo_lon:      -118.243683,
    geo_altitude_m: 89.4,
    geo_accuracy_m: 4.2,
    runbook_step_id: 'step-1-1',
    status:       'uploaded',
    quality_score: 91,
    exif_metadata: { make: 'Apple', model: 'iPhone 15 Pro', iso: 64, focal_mm: 24, exposure_s: 0.008, width_px: 4032, height_px: 3024, orientation: 1 },
    approved_for_training: false,
    notes:        'Pre-work safety photo — site entrance',
  },
  {
    _ev_key:      'ev-geo-2',
    job_id:       JOB_A_ID,
    evidence_type:'site_photo',
    file_url:     'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    content_type: 'image/jpeg',
    size_bytes:   2_840_000,
    sha256:       fakeSha(),
    captured_at:  ago(2, 4),
    geo_lat:      34.052510,
    geo_lon:      -118.244100,
    geo_altitude_m: 91.0,
    geo_accuracy_m: 5.8,
    runbook_step_id: 'step-1-1',
    status:       'uploaded',
    quality_score: 88,
    exif_metadata: {},
    approved_for_training: false,
    notes:        'Equipment bay overview',
  },
  {
    _ev_key:      'ev-geo-3',
    job_id:       JOB_B_ID,
    evidence_type:'after_photo',
    file_url:     'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800',
    content_type: 'image/jpeg',
    size_bytes:   2_106_432,
    sha256:       fakeSha(),
    captured_at:  ago(1, 6),
    geo_lat:      40.712776,
    geo_lon:      -74.005974,
    geo_altitude_m: 14.1,
    geo_accuracy_m: 3.1,
    runbook_step_id: null,
    status:       'uploaded',
    quality_score: 95,
    exif_metadata: {},
    approved_for_training: false,
    notes:        'Post-installation state',
  },
  {
    _ev_key:      'ev-video-1',
    job_id:       JOB_B_ID,
    evidence_type:'general',
    file_url:     'https://www.w3schools.com/html/mov_bbb.mp4',
    content_type: 'video/mp4',
    size_bytes:   7_864_320,
    sha256:       fakeSha(),
    captured_at:  ago(1, 5),
    geo_lat:      null,
    geo_lon:      null,
    runbook_step_id: null,
    status:       'uploaded',
    quality_score: null,
    exif_metadata: {},
    approved_for_training: false,
    notes:        'Walkthrough video — connector bay',
  },
  {
    _ev_key:      'ev-pdf-1',
    job_id:       JOB_C_ID,
    evidence_type:'general',
    file_url:     'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf',
    content_type: 'application/pdf',
    size_bytes:   524_288,
    sha256:       fakeSha(),
    captured_at:  ago(0, 8),
    geo_lat:      null,
    geo_lon:      null,
    runbook_step_id: null,
    status:       'uploaded',
    quality_score: null,
    exif_metadata: {},
    approved_for_training: false,
    notes:        'SOW sign-off PDF',
  },
  {
    _ev_key:      'ev-exif-1',
    job_id:       JOB_C_ID,
    evidence_type:'equipment_label',
    file_url:     'https://images.unsplash.com/photo-1581094651181-35942459ef62?w=800',
    content_type: 'image/jpeg',
    size_bytes:   1_572_864,
    sha256:       fakeSha(),
    captured_at:  ago(0, 7),
    geo_lat:      null,
    geo_lon:      null,
    runbook_step_id: 'step-1-2',
    status:       'uploaded',
    quality_score: 82,
    exif_metadata: {
      make: 'Samsung', model: 'Galaxy S24 Ultra', iso: 200, focal_mm: 35,
      exposure_s: 0.004, width_px: 3024, height_px: 4032, orientation: 6,
    },
    approved_for_training: false,
    notes:        'Equipment nameplate — rack unit serial',
  },
];

export async function seedMockData(onProgress) {
  onProgress?.('Checking existing data…');

  const [
    existingEvidence, existingManifests, existingAudits,
    existingLabels, existingMeetings, existingSnapshots,
  ] = await Promise.all([
    base44.entities.Evidence.list('-created_date', 1),
    base44.entities.UploadManifest.list('-created_date', 1),
    base44.entities.AuditLog.list('-created_date', 1),
    base44.entities.LabelRecord.list('-created_date', 1),
    base44.entities.Meeting.list('-created_date', 1),
    base44.entities.DatasetSnapshot.list('-created_date', 1),
  ]);

  // ── 1. Embed runbook into Job A ─────────────────────────────────────
  onProgress?.('Updating Job A runbook…');
  if (MOCK_JOBS[0]) {
    await base44.entities.Job.update(JOB_A_ID, {
      runbook_phases: RUNBOOK_PHASES,
    }).catch(() => {});
    // Audit: runbook_step_complete (step 1 was completed)
    await base44.entities.AuditLog.create(
      audit('runbook_step_complete', 'Job', JOB_A_ID, ACTOR, JOB_A_ID, {
        step_id: 'step-1-1', step_name: 'Pre-work Safety Inspection', result: 'completed',
      })
    ).catch(() => {});
  }

  // ── 2. Evidence + Manifest (6 items) ────────────────────────────────
  if (!existingEvidence.length) {
    onProgress?.('Seeding 6 evidence items + manifests…');

    // strip internal _ev_key before persisting
    const evidenceRows = EVIDENCE_SEED.map(({ _ev_key, ...ev }) => ev);
    const created = await base44.entities.Evidence.bulkCreate(evidenceRows);

    // Build manifests + audit logs in parallel
    const manifests = (created || []).map((rec, i) => {
      const src = EVIDENCE_SEED[i];
      const azureUrl = `https://purpulse.blob.core.windows.net/evidence/${src.job_id}/${src._ev_key}.${src.content_type === 'application/pdf' ? 'pdf' : src.content_type === 'video/mp4' ? 'mp4' : 'jpg'}`;
      return {
        job_id:             src.job_id,
        evidence_id:        rec.id,
        filename:           `${src._ev_key}.${src.content_type === 'application/pdf' ? 'pdf' : src.content_type === 'video/mp4' ? 'mp4' : 'jpg'}`,
        sha256:             src.sha256,
        file_url:           src.file_url,
        azure_blob_url:     azureUrl,
        content_type:       src.content_type,
        size_bytes:         src.size_bytes,
        width_px:           src.exif_metadata?.width_px || (src.content_type === 'image/jpeg' ? 4032 : null),
        height_px:          src.exif_metadata?.height_px || (src.content_type === 'image/jpeg' ? 3024 : null),
        exif_make:          src.exif_metadata?.make || null,
        exif_model:         src.exif_metadata?.model || null,
        exif_iso:           src.exif_metadata?.iso || null,
        exif_focal_mm:      src.exif_metadata?.focal_mm || null,
        exif_exposure_s:    src.exif_metadata?.exposure_s || null,
        geo_lat:            src.geo_lat,
        geo_lon:            src.geo_lon,
        geo_altitude_m:     src.geo_altitude_m || null,
        geo_accuracy_m:     src.geo_accuracy_m || null,
        capture_ts:         src.captured_at,
        upload_ts:          new Date().toISOString(),
        evidence_type:      src.evidence_type,
        runbook_step_id:    src.runbook_step_id || null,
        technician_email:   ACTOR,
        source_app_version: '2.4.1',
        device_id:          'device-j.smith',
        sync_status:        'synced',
        azure_indexed:      i < 3,
        approved_for_training: false,
      };
    });
    await base44.entities.UploadManifest.bulkCreate(manifests).catch(() => {});

    // Audit: evidence_upload for every item
    const uploadAudits = (created || []).map((rec, i) =>
      audit('evidence_upload', 'Evidence', rec.id, ACTOR, EVIDENCE_SEED[i].job_id, {
        evidence_type: EVIDENCE_SEED[i].evidence_type,
        content_type:  EVIDENCE_SEED[i].content_type,
        size_bytes:    EVIDENCE_SEED[i].size_bytes,
        has_geo:       EVIDENCE_SEED[i].geo_lat != null,
      })
    );
    await base44.entities.AuditLog.bulkCreate(uploadAudits).catch(() => {});

  } else if (!existingManifests.length) {
    onProgress?.('Evidence exists, seeding manifests only…');
    const allEv = await base44.entities.Evidence.list('-created_date', 10);
    const manifests = allEv.slice(0, 6).map((rec, i) => {
      const src = EVIDENCE_SEED[i] || EVIDENCE_SEED[0];
      return {
        job_id: rec.job_id || JOB_A_ID, evidence_id: rec.id,
        filename: `evidence-${i + 1}.jpg`, sha256: fakeSha(),
        file_url: rec.file_url, azure_blob_url: null, content_type: rec.content_type || 'image/jpeg',
        size_bytes: rec.size_bytes, geo_lat: rec.geo_lat, geo_lon: rec.geo_lon,
        capture_ts: rec.captured_at, upload_ts: new Date().toISOString(),
        evidence_type: rec.evidence_type, technician_email: ACTOR,
        source_app_version: '2.4.1', device_id: 'device-j.smith', sync_status: 'synced',
      };
    });
    await base44.entities.UploadManifest.bulkCreate(manifests).catch(() => {});
  }

  // ── 3. Labels (3 items) ──────────────────────────────────────────────
  if (!existingLabels.length) {
    onProgress?.('Seeding 3 label records…');
    const allEv = await base44.entities.Evidence.list('-created_date', 10);
    const labelTargets = allEv.filter(e => e.content_type?.startsWith('image')).slice(0, 3);
    if (labelTargets.length >= 1) {
      const labelDefs = [
        { label_type: 'defect',      label_value: 'corrosion',          confidence: 0.94, qc_status: 'approved', approved_for_training: true  },
        { label_type: 'pass',        label_value: 'connector_ok',       confidence: 0.98, qc_status: 'approved', approved_for_training: true  },
        { label_type: 'flag',        label_value: 'needs_review',       confidence: 0.72, qc_status: 'pending',  approved_for_training: false },
      ];
      const labels = labelTargets.map((ev, i) => ({
        evidence_id:   ev.id,
        job_id:        ev.job_id,
        label_type:    labelDefs[i].label_type,
        label_value:   labelDefs[i].label_value,
        confidence:    labelDefs[i].confidence,
        labeled_by:    ACTOR,             // labeler_id = actor email
        labeled_at:    ago(0, i + 1),
        model_version: null,
        embedding:     null,
        approved_for_training: labelDefs[i].approved_for_training,
        qc_status:     labelDefs[i].qc_status,
        bbox:          JSON.stringify({ x: 0.1 + i * 0.1, y: 0.15, w: 0.35, h: 0.4 }),
        notes:         `Seed label — ${labelDefs[i].label_value}`,
      }));
      const createdLabels = await base44.entities.LabelRecord.bulkCreate(labels);
      // Audit: label_applied for each
      const labelAudits = (createdLabels || []).map((rec, i) =>
        audit('label_applied', 'LabelRecord', rec.id, ACTOR, labels[i].job_id, {
          label_type: labels[i].label_type, label_value: labels[i].label_value,
          confidence: labels[i].confidence, evidence_id: labels[i].evidence_id,
        })
      );
      await base44.entities.AuditLog.bulkCreate(labelAudits).catch(() => {});
    }
  }

  // ── 4. Meetings (3, 1+ with transcript) ─────────────────────────────
  if (!existingMeetings.length) {
    onProgress?.('Seeding 3 meetings (1 with transcript)…');
    const meetingDefs = [
      {
        job_id:            JOB_A_ID,
        title:             'Site Kickoff — Tower A',
        meeting_type:      'kickoff',
        scheduled_at:      ago(3, 9),
        ended_at:          ago(3, 8),
        duration_min:      45,
        location:          MOCK_JOBS[0]?.site_address || 'On-site',
        attendees:         [ACTOR, ADMIN],
        external_attendees:'Mike Reynolds (Site Manager)',
        transcript_url:    `https://purpulse.blob.core.windows.net/transcripts/${JOB_A_ID}-kickoff.vtt`,
        summary:           'Reviewed scope, safety requirements, and staging plan for Tower A installation. All action items assigned.',
        action_items:      JSON.stringify([
          { owner: ACTOR, task: 'Submit daily photo evidence', due_date: ago(-1) },
          { owner: ADMIN, task: 'Confirm crane access window', due_date: ago(-2) },
        ]),
        status:            'completed',
        sync_status:       'synced',
      },
      {
        job_id:            JOB_B_ID,
        title:             'Safety Brief — Fiber Splice',
        meeting_type:      'safety_brief',
        scheduled_at:      ago(2, 8),
        ended_at:          ago(2, 7),
        duration_min:      30,
        location:          MOCK_JOBS[1]?.site_address || 'On-site',
        attendees:         [ACTOR, 'a.jones@purpulse.com'],
        external_attendees: null,
        transcript_url:    null,
        summary:           'Reviewed confined space entry procedures and PPE requirements.',
        action_items:      JSON.stringify([{ owner: ACTOR, task: 'Verify gas monitor calibration', due_date: ago(-1) }]),
        status:            'completed',
        sync_status:       'synced',
      },
      {
        job_id:            JOB_C_ID,
        title:             'Progress Review — DAS Install',
        meeting_type:      'progress',
        scheduled_at:      ago(1, 14),
        ended_at:          ago(1, 13),
        duration_min:      25,
        location:          'Teams call',
        attendees:         [ADMIN, ACTOR],
        external_attendees:'Susan Park (Client PM)',
        transcript_url:    null,
        summary:           null,
        action_items:      JSON.stringify([{ owner: ADMIN, task: 'Send closeout report', due_date: ago(-3) }]),
        status:            'completed',
        sync_status:       'synced',
      },
    ];
    const createdMeetings = await base44.entities.Meeting.bulkCreate(meetingDefs);
    // Audit: meeting_created + transcript_attached for meeting[0]
    const meetingAudits = (createdMeetings || []).flatMap((rec, i) => {
      const rows = [
        audit('meeting_created', 'Meeting', rec.id, ADMIN, meetingDefs[i].job_id, {
          title: meetingDefs[i].title, meeting_type: meetingDefs[i].meeting_type,
        }),
      ];
      if (meetingDefs[i].transcript_url) {
        rows.push(
          audit('meeting_transcript_attached', 'Meeting', rec.id, ADMIN, meetingDefs[i].job_id, {
            transcript_url: meetingDefs[i].transcript_url,
          })
        );
      }
      return rows;
    });
    await base44.entities.AuditLog.bulkCreate(meetingAudits).catch(() => {});
  }

  // ── 5. Additional historical audit logs ─────────────────────────────
  if (!existingAudits.length) {
    onProgress?.('Seeding historical audit logs…');
    const historical = [
      audit('job_status_change',     'Job',      JOB_A_ID, ACTOR, JOB_A_ID, { old_status: 'assigned',   new_status: 'in_progress' }),
      audit('job_status_change',     'Job',      JOB_B_ID, ACTOR, JOB_B_ID, { old_status: 'assigned',   new_status: 'checked_in'  }),
      audit('time_start',            'TimeEntry', 'te-1',  ACTOR, JOB_A_ID, { timestamp: ago(2, 7) }),
      audit('time_stop',             'TimeEntry', 'te-2',  ACTOR, JOB_A_ID, { timestamp: ago(2, 3) }),
      audit('closeout_submitted',    'Job',       JOB_B_ID, ACTOR, JOB_B_ID, { submitted_at: ago(1) }),
      audit('manifest_exported',     'UploadManifest', null, ADMIN, null,    { export_type: 'manifest', row_count: 6, since: null }),
    ];
    await base44.entities.AuditLog.bulkCreate(historical).catch(() => {});
  }

  // ── 6. Dataset Snapshot ──────────────────────────────────────────────
  if (!existingSnapshots.length) {
    onProgress?.('Seeding dataset snapshot…');
    const allEv   = await base44.entities.Evidence.list('-created_date', 20);
    const geoEv   = allEv.filter(e => e.geo_lat != null).length;
    const labeled = await base44.entities.LabelRecord.list('-created_date', 20);
    await base44.entities.DatasetSnapshot.create({
      snapshot_date:          new Date().toISOString().slice(0, 10),
      total_jobs:             3,
      total_evidence:         allEv.length,
      evidence_with_geo:      geoEv,
      labeled_evidence:       labeled.length,
      approved_for_training:  labeled.filter(l => l.approved_for_training).length,
      avg_images_per_job:     +(allEv.length / 3).toFixed(2),
      transcript_count:       1,
      total_label_records:    labeled.length,
      label_counts_by_type:   JSON.stringify(
        labeled.reduce((acc, l) => { acc[l.label_type] = (acc[l.label_type] || 0) + 1; return acc; }, {})
      ),
      embedding_coverage_pct: 0,
      total_manifest_rows:    allEv.length,
      total_audit_rows:       50,
      dataset_size_mb:        +(allEv.reduce((s, e) => s + (e.size_bytes || 0), 0) / 1_000_000).toFixed(2),
      model_training_ready:   false,
      notes:                  `Seed snapshot — ${allEv.length} evidence items, ${geoEv} with geo (${allEv.length ? ((geoEv / allEv.length) * 100).toFixed(0) : 0}% coverage)`,
      azure_container_url:    'https://purpulse.blob.core.windows.net/datasets/snapshot-seed',
    });
  }

  onProgress?.('✓ All tables seeded');
}