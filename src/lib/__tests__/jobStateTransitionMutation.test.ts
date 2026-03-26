import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  emitCloseoutEvent: vi.fn().mockResolvedValue(undefined),
  emitDispatchEventForJobStatusChange: vi.fn().mockResolvedValue(undefined),
  fetchJobContextForArtifactEvent: vi.fn().mockResolvedValue({ project_id: 'p99' }),
  jobUpdate: vi.fn().mockResolvedValue({ id: 'j1', status: 'submitted' }),
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      Job: {
        update: (...args: unknown[]) => hoisted.jobUpdate(...args),
      },
    },
  },
}));

vi.mock('@/lib/artifactEvent', () => ({
  fetchJobContextForArtifactEvent: hoisted.fetchJobContextForArtifactEvent,
}));

vi.mock('@/lib/closeoutEvent', () => ({
  emitCloseoutEvent: hoisted.emitCloseoutEvent,
}));

vi.mock('@/lib/dispatchEvent', () => ({
  emitDispatchEventForJobStatusChange: hoisted.emitDispatchEventForJobStatusChange,
}));

import { executeJobStateTransitionMutation } from '@/lib/jobStateTransitionMutation';

const baseJob = {
  id: 'j1',
  status: 'pending_closeout',
  evidence_requirements: [],
  fields_schema: [],
  runbook_phases: [],
  signoff_signer_name: 'A',
  signoff_signature_url: 'https://sig',
};

const user = { email: 't@x.com', id: 'u1' };

describe('executeJobStateTransitionMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.emitCloseoutEvent.mockResolvedValue(undefined);
    hoisted.emitDispatchEventForJobStatusChange.mockResolvedValue(undefined);
    hoisted.fetchJobContextForArtifactEvent.mockResolvedValue({ project_id: 'p99' });
    hoisted.jobUpdate.mockResolvedValue({ id: 'j1', status: 'submitted' });
  });

  it('emits closeout_event before dispatch_event before Job.update when submitting from pending_closeout', async () => {
    const order: string[] = [];
    hoisted.emitCloseoutEvent.mockImplementation(async () => {
      order.push('closeout');
    });
    hoisted.emitDispatchEventForJobStatusChange.mockImplementation(async () => {
      order.push('dispatch');
    });
    hoisted.jobUpdate.mockImplementation(async () => {
      order.push('update');
      return {};
    });

    await executeJobStateTransitionMutation({
      job: baseJob,
      user,
      evidence: [],
      toStatus: 'submitted',
      fromStatus: 'pending_closeout',
      isOverride: false,
      overrideReason: '',
      dispatchOverrides: undefined,
    });

    expect(order).toEqual(['closeout', 'dispatch', 'update']);
    expect(hoisted.emitCloseoutEvent).toHaveBeenCalledTimes(1);
    const closeoutArg = hoisted.emitCloseoutEvent.mock.calls[0][0];
    expect(closeoutArg.job).toMatchObject({ id: 'j1', project_id: 'p99' });
    expect(closeoutArg.closeoutSubmitTimestampIso).toBeDefined();
    expect(hoisted.jobUpdate).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({
        status: 'submitted',
        closeout_submitted_at: closeoutArg.closeoutSubmitTimestampIso,
      })
    );
  });

  it('does not emit closeout_event for other transitions', async () => {
    await executeJobStateTransitionMutation({
      job: { ...baseJob, status: 'checked_in' },
      user,
      evidence: [],
      toStatus: 'in_progress',
      fromStatus: 'checked_in',
      isOverride: false,
      overrideReason: '',
      dispatchOverrides: undefined,
    });
    expect(hoisted.emitCloseoutEvent).not.toHaveBeenCalled();
    expect(hoisted.emitDispatchEventForJobStatusChange).toHaveBeenCalled();
    expect(hoisted.jobUpdate).toHaveBeenCalled();
  });

  it('does not emit closeout_event when submitting from non-pending_closeout', async () => {
    await executeJobStateTransitionMutation({
      job: { ...baseJob, status: 'submitted' },
      user,
      evidence: [],
      toStatus: 'approved',
      fromStatus: 'submitted',
      isOverride: false,
      overrideReason: '',
      dispatchOverrides: undefined,
    });
    expect(hoisted.emitCloseoutEvent).not.toHaveBeenCalled();
  });
});
