/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildArtifactEventPayload,
  assertArtifactEventRequired,
  ARTIFACT_EVENT_PROPERTY_KEYS,
  emitArtifactEventForCompletedUpload,
} from '@/lib/artifactEvent';

vi.mock('@/lib/telemetryQueue', () => ({
  enqueueCanonicalEvent: vi.fn().mockResolvedValue('queued-id'),
}));

describe('artifactEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildArtifactEventPayload sets artifact_id and evidence_type', () => {
    const p = buildArtifactEventPayload({
      job: { id: 'job_1', project_id: 'p1', site_id: 's1' },
      user: { id: 'u1' },
      evidence: {
        id: 'ev_99',
        evidence_type: 'photo_wide',
        captured_at: '2026-03-20T12:00:00.000Z',
        content_type: 'image/jpeg',
        size_bytes: 2048,
      },
      metadata: { runbook_step_id: 'step-1', serial_number: 'SN-7' },
      photoUploadedCount: 1,
      photoRequiredCount: 4,
    });
    expect(p.event_name).toBe('artifact_event');
    expect(p.source_system).toBe('field_app');
    expect(p.job_id).toBe('job_1');
    expect(p.artifact_id).toBe('ev_99');
    expect(p.documentation_artifact_id).toBe('ev_99');
    expect(p.evidence_type).toBe('photo_wide');
    expect(p.captured_at).toBe('2026-03-20T12:00:00.000Z');
    expect(p.runbook_step_id).toBe('step-1');
    expect(p.serial_value).toBe('SN-7');
    expect(p.asset_tag_capture_flag).toBe(true);
    expect(p.customer_signature_flag).toBe(false);
    expect(p.photo_uploaded_count).toBe(1);
    expect(p.photo_required_count).toBe(4);
    expect(p.project_id).toBe('p1');
    expect(p.site_id).toBe('s1');
  });

  it('customer_signature_flag true for signature evidence_type', () => {
    const p = buildArtifactEventPayload({
      job: { id: 'j' },
      user: null,
      evidence: {
        id: 'e1',
        evidence_type: 'signature',
        captured_at: '2026-03-20T12:00:00.000Z',
      },
      metadata: {},
    });
    expect(p.customer_signature_flag).toBe(true);
    expect(p.asset_tag_capture_flag).toBe(false);
  });

  it('assertArtifactEventRequired accepts valid payload', () => {
    const p = buildArtifactEventPayload({
      job: { id: 'j' },
      user: { id: 'u' },
      evidence: { id: 'e', evidence_type: 'general', captured_at: '2026-03-20T12:00:00.000Z' },
      metadata: {},
    });
    expect(() => assertArtifactEventRequired(p)).not.toThrow();
  });

  it('emitArtifactEventForCompletedUpload enqueues via telemetryQueue', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitArtifactEventForCompletedUpload({
      job: { id: 'j' },
      user: null,
      evidence: { id: 'e', evidence_type: 'general', captured_at: '2026-03-20T12:00:00.000Z' },
      metadata: {},
    });
    expect(enqueueCanonicalEvent).toHaveBeenCalledTimes(1);
    const arg = enqueueCanonicalEvent.mock.calls[0][0];
    expect(arg.event_name).toBe('artifact_event');
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: ARTIFACT_EVENT_PROPERTY_KEYS,
    });
  });

  it('ARTIFACT_EVENT_PROPERTY_KEYS includes artifact fields', () => {
    expect(ARTIFACT_EVENT_PROPERTY_KEYS).toContain('artifact_id');
    expect(ARTIFACT_EVENT_PROPERTY_KEYS).toContain('evidence_type');
    expect(ARTIFACT_EVENT_PROPERTY_KEYS).toContain('serial_value');
  });
});
