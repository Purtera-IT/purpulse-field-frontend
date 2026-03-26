import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  emitFeedbackEvent: vi.fn().mockResolvedValue(undefined),
  fetchJobContextForArtifactEvent: vi.fn().mockResolvedValue({ site_id: 's1' }),
  jobUpdate: vi.fn().mockResolvedValue({}),
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

vi.mock('@/lib/feedbackEvent', () => ({
  emitFeedbackEvent: hoisted.emitFeedbackEvent,
}));

import { saveTechnicianCloseoutOutcomeWithTelemetry } from '@/lib/technicianCloseoutOutcomeSave';

describe('saveTechnicianCloseoutOutcomeWithTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.emitFeedbackEvent.mockResolvedValue(undefined);
    hoisted.fetchJobContextForArtifactEvent.mockResolvedValue({ site_id: 's1' });
    hoisted.jobUpdate.mockResolvedValue({});
  });

  it('calls emitFeedbackEvent before Job.update with matching feedback and recorded timestamps', async () => {
    const order: string[] = [];
    let feedbackTs: string | undefined;
    let patchTs: string | undefined;

    hoisted.emitFeedbackEvent.mockImplementation(async (opts: { feedbackTimestampIso?: string }) => {
      order.push('feedback');
      feedbackTs = opts.feedbackTimestampIso;
    });
    hoisted.jobUpdate.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      order.push('update');
      patchTs = patch.technician_closeout_recorded_at as string;
      return {};
    });

    const job = {
      id: 'job-42',
      technician_closeout_outcome: null,
    };
    const user = { id: 'u1' };
    const form = {
      outcome: 'clean' as const,
      rating: null,
      complaintFlag: false,
      complimentFlag: false,
      notes: '',
    };

    await saveTechnicianCloseoutOutcomeWithTelemetry(job, user, form);

    expect(order).toEqual(['feedback', 'update']);
    expect(feedbackTs).toBeDefined();
    expect(patchTs).toBe(feedbackTs);
    expect(hoisted.emitFeedbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        job: expect.objectContaining({ id: 'job-42', site_id: 's1' }),
        feedbackSource: 'closeout',
        feedbackTimestampIso: feedbackTs,
      })
    );
  });
});
