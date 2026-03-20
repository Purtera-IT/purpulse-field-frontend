/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildToolCheckEventPayload,
  assertToolCheckEventRequired,
  emitToolCheckEvent,
  TOOL_CHECK_EVENT_PROPERTY_KEYS,
} from '@/lib/toolCheckEvent';
import {
  buildCanonicalJobContextString,
  computeJobContextFingerprint,
  shouldEmitJobContextSnapshot,
  markJobContextSnapshotEmitted,
  buildJobContextFieldPayload,
  assertJobContextFieldRequired,
  emitJobContextField,
  emitJobContextFieldIfChanged,
  JOB_CONTEXT_FIELD_PROPERTY_KEYS,
  JOB_CONTEXT_FINGERPRINT_STORAGE_PREFIX,
  JOB_CONTEXT_SCHEMA_VERSION,
} from '@/lib/jobContextField';

vi.mock('@/lib/telemetryQueue', () => ({
  enqueueCanonicalEvent: vi.fn().mockResolvedValue('queued'),
}));

describe('Iteration 10 — tool_check_event', () => {
  beforeEach(() => vi.clearAllMocks());

  it('payload passes assert when all checklist items true', () => {
    const p = buildToolCheckEventPayload({
      job: { id: 'j1', project_id: 'p1' },
      user: { id: 'u1' },
      ppeCompliant: true,
      essentialToolsReady: true,
      bomDocsReviewed: true,
      siteSafetyAck: true,
    });
    expect(p.event_name).toBe('tool_check_event');
    expect(p.all_items_passed_flag).toBe(true);
    expect(() => assertToolCheckEventRequired(p)).not.toThrow();
    expect(TOOL_CHECK_EVENT_PROPERTY_KEYS).toContain('tool_check_timestamp');
  });

  it('rejects inconsistent all_items_passed_flag', () => {
    const p = buildToolCheckEventPayload({
      job: { id: 'j1' },
      user: null,
      ppeCompliant: true,
      essentialToolsReady: false,
      bomDocsReviewed: true,
      siteSafetyAck: true,
    });
    expect(p.all_items_passed_flag).toBe(false);
    expect(() => assertToolCheckEventRequired(p)).not.toThrow();
    p.all_items_passed_flag = true;
    expect(() => assertToolCheckEventRequired(p)).toThrow(/all_items_passed_flag/);
  });

  it('emitToolCheckEvent enqueues with allowlist', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitToolCheckEvent({
      job: { id: 'j' },
      user: null,
      ppeCompliant: true,
      essentialToolsReady: true,
      bomDocsReviewed: true,
      siteSafetyAck: true,
    });
    expect(enqueueCanonicalEvent.mock.calls[0][0].event_name).toBe('tool_check_event');
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: TOOL_CHECK_EVENT_PROPERTY_KEYS,
    });
  });
});

describe('Iteration 10 — job_context_field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('canonical string includes schema version and technician key', () => {
    const job = {
      id: 'j1',
      status: 'assigned',
      runbook_version: '2.0.0',
      updated_date: '2025-03-19T10:00:00.000Z',
      evidence_requirements: [{ type: 'photo' }],
      runbook_phases: [{ steps: [{ id: 's1' }, { id: 's2' }] }],
      fields_schema: [{ required: true }, { required: false }],
    };
    const s = buildCanonicalJobContextString(job, 'tech-1');
    expect(s).toContain(JOB_CONTEXT_SCHEMA_VERSION);
    expect(s).toContain('tech-1');
  });

  it('fingerprint is stable for same inputs', async () => {
    const job = {
      id: 'j1',
      status: 'checked_in',
      updated_date: '2025-03-19T10:00:00.000Z',
      evidence_requirements: [],
      runbook_phases: [],
    };
    const a = await computeJobContextFingerprint(job, 't1');
    const b = await computeJobContextFingerprint(job, 't1');
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });

  it('dedupe storage skips second emit', async () => {
    const job = { id: 'job-dedupe', status: 'assigned', updated_date: '2025-01-01T00:00:00.000Z' };
    const fp = await computeJobContextFingerprint(job, '');
    expect(shouldEmitJobContextSnapshot('job-dedupe', fp)).toBe(true);
    markJobContextSnapshotEmitted('job-dedupe', fp);
    expect(shouldEmitJobContextSnapshot('job-dedupe', fp)).toBe(false);
    expect(localStorage.getItem(`${JOB_CONTEXT_FINGERPRINT_STORAGE_PREFIX}job-dedupe`)).toBe(fp);
  });

  it('job_context_field payload passes assert', () => {
    const p = buildJobContextFieldPayload({
      job: {
        id: 'j1',
        status: 'in_progress',
        runbook_version: '1.0.0',
        evidence_requirements: [1, 2],
        runbook_phases: [{ steps: [{}] }],
        fields_schema: [{ required: true }],
      },
      user: { id: 'u' },
      contextFingerprint: 'a'.repeat(64),
    });
    expect(p.event_name).toBe('job_context_field');
    expect(p.evidence_requirement_count).toBe(2);
    expect(p.runbook_step_count).toBe(1);
    expect(p.required_field_count).toBe(1);
    expect(() => assertJobContextFieldRequired(p)).not.toThrow();
    expect(JOB_CONTEXT_FIELD_PROPERTY_KEYS).toContain('context_fingerprint');
  });

  it('emitJobContextField enqueues', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitJobContextField({
      job: { id: 'j', status: 'assigned' },
      user: null,
      contextFingerprint: 'b'.repeat(64),
    });
    expect(enqueueCanonicalEvent.mock.calls[0][0].event_name).toBe('job_context_field');
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: JOB_CONTEXT_FIELD_PROPERTY_KEYS,
    });
  });

  it('emitJobContextFieldIfChanged emits once then skips', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    const job = {
      id: 'j-once',
      status: 'assigned',
      updated_date: '2025-02-01T00:00:00.000Z',
      evidence_requirements: [],
      runbook_phases: [],
    };
    const r1 = await emitJobContextFieldIfChanged({ job, user: null });
    const r2 = await emitJobContextFieldIfChanged({ job, user: null });
    expect(r1.emitted).toBe(true);
    expect(r2.emitted).toBe(false);
    expect(enqueueCanonicalEvent).toHaveBeenCalledTimes(1);
  });
});
