/**
 * lib/mockSeedData.js
 *
 * Seed realistic records into UploadManifest, AuditLog, LabelRecord,
 * Meeting, and DatasetSnapshot tables so the Admin pages have data to show.
 *
 * Called once from AdminManifest "Seed Mock Data" button.
 * Idempotent: checks for existing records before inserting.
 */
import { base44 } from '@/api/base44Client';
import { MOCK_JOBS } from '@/lib/mockJobs';

const TECHNICIANS = [
  { email: 'j.smith@purpulse.com',  role: 'technician' },
  { email: 'a.jones@purpulse.com',  role: 'technician' },
  { email: 'r.chen@purpulse.com',   role: 'technician' },
  { email: 'admin@purpulse.com',    role: 'admin'      },
];

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ago(days, hours = 0) { return new Date(Date.now() - (days * 86400 + hours * 3600) * 1000).toISOString(); }
function randFloat(min, max) { return +(Math.random() * (max - min) + min).toFixed(6); }
function randInt(min, max)   { return Math.floor(Math.random() * (max - min + 1)) + min; }
function fakeSha() { return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1581092921461-39b9c0f1e1e8?w=800',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
  'https://images.unsplash.com/photo-1581094651181-35942459ef62?w=800',
  'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800',
  'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=800',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
];

const EV_TYPES = ['before_photo','after_photo','site_photo','equipment_label','signature','general'];
const LABEL_TYPES = ['pass','pass','pass','defect','flag','qc_pass'];

export async function seedMockData(onProgress) {
  onProgress?.('Checking existing data…');

  const [existingManifests, existingAudits, existingLabels, existingMeetings, existingSnapshots] = await Promise.all([
    base44.entities.UploadManifest.list('-created_date', 1),
    base44.entities.AuditLog.list('-created_date', 1),
    base44.entities.LabelRecord.list('-created_date', 1),
    base44.entities.Meeting.list('-created_date', 1),
    base44.entities.DatasetSnapshot.list('-created_date', 1),
  ]);

  // ── Upload Manifests (40 rows across 6 jobs) ──────────────────────
  if (!existingManifests.length) {
    onProgress?.('Seeding upload manifests…');
    const manifests = [];
    MOCK_JOBS.slice(0, 6).forEach((job, ji) => {
      const count = 4 + ji * 2;
      for (let i = 0; i < count; i++) {
        const tech = randItem(TECHNICIANS);
        const evType = randItem(EV_TYPES);
        const url = PHOTO_URLS[i % PHOTO_URLS.length];
        manifests.push({
          job_id:             job.id,
          evidence_id:        `ev-${job.id}-${i}`,
          filename:           `${evType}_${i+1}.jpg`,
          sha256:             fakeSha(),
          file_url:           url,
          azure_blob_url:     `https://purpulse.blob.core.windows.net/evidence/${job.id}/${evType}_${i+1}.jpg`,
          content_type:       'image/jpeg',
          size_bytes:         randInt(150000, 4500000),
          width_px:           randItem([3024, 4032, 1920, 2048]),
          height_px:          randItem([4032, 3024, 1080, 1536]),
          exif_make:          randItem(['Apple', 'Samsung', 'Google']),
          exif_model:         randItem(['iPhone 15 Pro', 'Galaxy S24', 'Pixel 8']),
          exif_iso:           randItem([64, 100, 200, 400, 800]),
          exif_focal_mm:      randItem([13, 24, 35, 77]),
          exif_exposure_s:    parseFloat((1 / randInt(30, 1000)).toFixed(5)),
          geo_lat:            randFloat(30.0, 41.0),
          geo_lon:            randFloat(-97.0, -75.0),
          geo_altitude_m:     randFloat(5, 300),
          geo_accuracy_m:     randFloat(2, 25),
          capture_ts:         ago(ji + 1, i),
          upload_ts:          ago(ji + 1, i - 0.1),
          evidence_type:      evType,
          runbook_step_id:    `step-${ji + 1}-${(i % 3) + 1}`,
          technician_email:   tech.email,
          source_app_version: '2.4.1',
          device_id:          `device-${tech.email.split('@')[0]}`,
          sync_status:        'synced',
          azure_indexed:      i < 3,
          approved_for_training: i < 2,
        });
      }
    });
    await base44.entities.UploadManifest.bulkCreate(manifests);
  }

  // ── Audit Logs (50 entries) ───────────────────────────────────────
  if (!existingAudits.length) {
    onProgress?.('Seeding audit logs…');
    const ACTION_TYPES = [
      'evidence_upload','time_start','time_stop','runbook_step_complete',
      'closeout_submitted','label_applied','job_status_change','meeting_created',
    ];
    const audits = Array.from({ length: 50 }, (_, i) => {
      const tech = randItem(TECHNICIANS);
      const job  = randItem(MOCK_JOBS);
      const act  = randItem(ACTION_TYPES);
      return {
        job_id:          job.id,
        action_type:     act,
        entity_type:     act.split('_')[0],
        entity_id:       `entity-${i}`,
        actor_email:     tech.email,
        actor_role:      tech.role,
        payload_summary: JSON.stringify({ job_id: job.id, step: i }),
        result:          i % 12 === 0 ? 'error' : 'success',
        error_message:   i % 12 === 0 ? 'Network timeout during upload' : null,
        client_ts:       ago(Math.floor(i / 5), i % 24),
        server_ts:       ago(Math.floor(i / 5), i % 24),
        session_id:      `sess-${tech.email.split('@')[0]}-1`,
        device_id:       `device-${tech.email.split('@')[0]}`,
        duration_ms:     randInt(50, 3200),
      };
    });
    await base44.entities.AuditLog.bulkCreate(audits);
  }

  // ── Label Records (25 entries) ────────────────────────────────────
  if (!existingLabels.length) {
    onProgress?.('Seeding label records…');
    const labels = MOCK_JOBS.slice(0, 5).flatMap((job, ji) =>
      Array.from({ length: 5 }, (_, i) => ({
        evidence_id:   `ev-${job.id}-${i}`,
        job_id:        job.id,
        label_type:    randItem(LABEL_TYPES),
        label_value:   randItem(['corrosion', 'cable_loose', 'connector_ok', 'panel_clean', 'seal_broken']),
        confidence:    +(0.85 + Math.random() * 0.15).toFixed(3),
        bbox:          JSON.stringify({ x: randFloat(0.1, 0.5), y: randFloat(0.1, 0.5), w: randFloat(0.1, 0.4), h: randFloat(0.1, 0.4) }),
        labeled_by:    randItem(TECHNICIANS).email,
        labeled_at:    ago(ji + 1, i),
        model_version: null,
        embedding:     null,
        approved_for_training: i < 2,
        qc_status:     randItem(['pending','approved','approved','rejected']),
        notes:         i % 3 === 0 ? 'Reviewed on-site by PM' : null,
      }))
    );
    await base44.entities.LabelRecord.bulkCreate(labels);
  }

  // ── Meetings (6 entries) ──────────────────────────────────────────
  if (!existingMeetings.length) {
    onProgress?.('Seeding meetings…');
    const meetings = MOCK_JOBS.slice(0, 6).map((job, i) => ({
      job_id:              job.id,
      title:               ['Site Kickoff', 'Safety Brief', 'Progress Review', 'Client Walkthrough', 'Debrief', 'Incident Review'][i],
      meeting_type:        ['kickoff','safety_brief','progress','client_walkthrough','debrief','incident'][i],
      scheduled_at:        ago(i + 1, 9),
      ended_at:            ago(i + 1, 8),
      duration_min:        randInt(20, 75),
      location:            job.site_address || 'On-site',
      attendees:           [TECHNICIANS[i % TECHNICIANS.length].email, 'admin@purpulse.com'],
      external_attendees:  job.contact_name,
      transcript_url:      i < 3 ? `https://purpulse.blob.core.windows.net/transcripts/${job.id}-meeting-${i}.vtt` : null,
      summary:             i < 3 ? `Reviewed scope and safety requirements for ${job.title}. Action items assigned.` : null,
      action_items:        JSON.stringify([{ owner: TECHNICIANS[i % 2].email, task: 'Submit daily evidence', due_date: ago(-1) }]),
      status:              'completed',
      sync_status:         'synced',
    }));
    await base44.entities.Meeting.bulkCreate(meetings);
  }

  // ── Dataset Snapshot (1 entry) ────────────────────────────────────
  if (!existingSnapshots.length) {
    onProgress?.('Seeding dataset snapshot…');
    await base44.entities.DatasetSnapshot.create({
      snapshot_date:          new Date().toISOString().slice(0, 10),
      total_jobs:             MOCK_JOBS.length,
      total_evidence:         42,
      evidence_with_geo:      38,
      labeled_evidence:       25,
      approved_for_training:  12,
      avg_images_per_job:     5.25,
      transcript_count:       3,
      total_label_records:    25,
      label_counts_by_type:   JSON.stringify({ pass: 10, defect: 5, flag: 4, qc_pass: 4, qc_fail: 2 }),
      embedding_coverage_pct: 0,
      total_manifest_rows:    42,
      total_audit_rows:       50,
      dataset_size_mb:        184.5,
      model_training_ready:   false,
      notes:                  'Initial mock seed — embeddings pending ML pipeline',
      azure_container_url:    'https://purpulse.blob.core.windows.net/datasets/snapshot-2026-03-17',
    });
  }

  onProgress?.('Done!');
}