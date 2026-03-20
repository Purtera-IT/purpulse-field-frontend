/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  buildRunbookStepEventPayload,
  assertRunbookStepEventRequired,
  RUNBOOK_STEP_EVENT_PROPERTY_KEYS,
} from '@/lib/runbookStepEvent';

describe('runbookStepEvent', () => {
  it('buildRunbookStepEventPayload sets runbook_version from phaseMeta.sr_version', () => {
    const p = buildRunbookStepEventPayload({
      job: { id: 'job_1', project_id: 'p1', site_id: 's1' },
      user: { id: 'u1' },
      step: { id: 'step_a', title: 'Tighten bolts', step_family: 'mechanical' },
      phaseMeta: { sr_version: '2.1.0' },
      phaseId: 'ph_1',
      stepOutcome: 'pass',
      durationMinutes: 12,
    });
    expect(p.event_name).toBe('runbook_step_event');
    expect(p.source_system).toBe('field_app');
    expect(p.job_id).toBe('job_1');
    expect(p.step_instance_id).toBe('step_a');
    expect(p.runbook_version).toBe('2.1.0');
    expect(p.duration_minutes).toBe(12);
    expect(p.step_outcome).toBe('pass');
    expect(p.step_title).toBe('Tighten bolts');
    expect(p.step_family).toBe('mechanical');
    expect(p.phase_id).toBe('ph_1');
    expect(p.project_id).toBe('p1');
    expect(p.site_id).toBe('s1');
  });

  it('buildRunbookStepEventPayload falls back job.runbook_version then 0.0.0', () => {
    const p = buildRunbookStepEventPayload({
      job: { id: 'j', runbook_version: '1.0.9' },
      user: null,
      step: { id: 's1', name: 'N' },
      phaseMeta: {},
      stepOutcome: 'started',
      durationMinutes: 0,
    });
    expect(p.runbook_version).toBe('1.0.9');
    const p2 = buildRunbookStepEventPayload({
      job: { id: 'j' },
      user: null,
      step: { id: 's1', name: 'N' },
      phaseMeta: {},
      stepOutcome: 'started',
      durationMinutes: 0,
    });
    expect(p2.runbook_version).toBe('0.0.0');
  });

  it('assertRunbookStepEventRequired accepts valid payload', () => {
    const p = buildRunbookStepEventPayload({
      job: { id: 'j' },
      user: { id: 'u' },
      step: { id: 's' },
      stepOutcome: 'escalated',
      durationMinutes: 0,
      blockerFlag: true,
    });
    expect(() => assertRunbookStepEventRequired(p)).not.toThrow();
    expect(p.blocker_flag).toBe(true);
  });

  it('assertRunbookStepEventRequired rejects bad duration_minutes', () => {
    expect(() =>
      assertRunbookStepEventRequired({
        event_id: 'x',
        schema_version: '1.0.0',
        event_name: 'runbook_step_event',
        event_ts_utc: new Date().toISOString(),
        client_ts: new Date().toISOString(),
        source_system: 'field_app',
        job_id: 'j',
        technician_id: 't',
        step_instance_id: 's',
        runbook_version: '1',
        duration_minutes: -1,
        step_outcome: 'pass',
      })
    ).toThrow(/duration_minutes/);
  });

  it('RUNBOOK_STEP_EVENT_PROPERTY_KEYS includes core runbook fields', () => {
    expect(RUNBOOK_STEP_EVENT_PROPERTY_KEYS).toContain('step_instance_id');
    expect(RUNBOOK_STEP_EVENT_PROPERTY_KEYS).toContain('duration_minutes');
    expect(RUNBOOK_STEP_EVENT_PROPERTY_KEYS).toContain('runbook_version');
    expect(RUNBOOK_STEP_EVENT_PROPERTY_KEYS).toContain('blocker_flag');
  });
});
