/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildQcEventPayload,
  assertQcEventRequired,
  QC_EVENT_PROPERTY_KEYS,
  emitQcEvent,
  mapLabelTypeToValidationResult,
  parseBboxForQcEvent,
} from '@/lib/qcEvent';

vi.mock('@/lib/telemetryQueue', () => ({
  enqueueCanonicalEvent: vi.fn().mockResolvedValue('queued-id'),
}));

describe('qcEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildQcEventPayload sets reviewer_id and technician_id consistently', () => {
    const p = buildQcEventPayload({
      job: { id: 'job_1', project_id: 'p1', site_id: 's1' },
      user: { id: 'u1' },
      evidence: { id: 'ev_1', job_id: 'job_1', runbook_step_id: 'st-9', quality_score: 88 },
      validationResult: 'passed',
      reviewNotes: 'Looks good',
      defectFlag: false,
      retestFlag: false,
      qcTaskId: null,
      confidence: 0.91,
    });
    expect(p.event_name).toBe('qc_event');
    expect(p.source_system).toBe('field_app');
    expect(p.job_id).toBe('job_1');
    expect(p.artifact_id).toBe('ev_1');
    expect(p.reviewer_id).toBe(p.technician_id);
    expect(p.validation_result).toBe('passed');
    expect(p.defect_flag).toBe(false);
    expect(p.retest_flag).toBe(false);
    expect(p.review_notes).toBe('Looks good');
    expect(p.step_instance_id).toBe('st-9');
    expect(p.confidence).toBe(0.91);
    expect(p.project_id).toBe('p1');
    expect(p.site_id).toBe('s1');
  });

  it('scales quality_score 0-100 to confidence 0-1 when passed as confidence', () => {
    const p = buildQcEventPayload({
      job: { id: 'j' },
      user: { id: 'u' },
      evidence: { id: 'e', job_id: 'j' },
      validationResult: 'failed',
      defectFlag: true,
      retestFlag: false,
      confidence: 75,
    });
    expect(p.confidence).toBe(0.75);
  });

  it('mapLabelTypeToValidationResult maps training_approved to passed', () => {
    expect(mapLabelTypeToValidationResult('qc_pass')).toBe('passed');
    expect(mapLabelTypeToValidationResult('fail')).toBe('failed');
    expect(mapLabelTypeToValidationResult('skip')).toBe('needs_review');
  });

  it('parseBboxForQcEvent parses JSON string', () => {
    expect(parseBboxForQcEvent('{"x":0,"y":0,"w":1,"h":1}')).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(parseBboxForQcEvent(null)).toBeNull();
  });

  it('assertQcEventRequired rejects invalid validation_result', () => {
    const p = buildQcEventPayload({
      job: { id: 'j' },
      user: null,
      evidence: { id: 'e', job_id: 'j' },
      validationResult: 'passed',
      defectFlag: false,
      retestFlag: false,
    });
    expect(() => assertQcEventRequired(p)).not.toThrow();
    p.validation_result = 'bogus';
    expect(() => assertQcEventRequired(p)).toThrow(/validation_result/);
  });

  it('emitQcEvent enqueues with allowlist', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitQcEvent({
      job: { id: 'j' },
      user: { id: 'rev' },
      evidence: { id: 'art', job_id: 'j' },
      validationResult: 'needs_review',
      defectFlag: false,
      retestFlag: false,
    });
    expect(enqueueCanonicalEvent).toHaveBeenCalledTimes(1);
    expect(enqueueCanonicalEvent.mock.calls[0][0].event_name).toBe('qc_event');
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: QC_EVENT_PROPERTY_KEYS,
    });
  });

  it('QC_EVENT_PROPERTY_KEYS includes qc fields', () => {
    expect(QC_EVENT_PROPERTY_KEYS).toContain('reviewer_id');
    expect(QC_EVENT_PROPERTY_KEYS).toContain('validation_result');
    expect(QC_EVENT_PROPERTY_KEYS).toContain('defect_flag');
  });
});
