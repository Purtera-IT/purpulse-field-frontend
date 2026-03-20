/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCloseoutEventPayload,
  assertCloseoutEventRequired,
  emitCloseoutEvent,
  CLOSEOUT_EVENT_PROPERTY_KEYS,
} from '@/lib/closeoutEvent';
import {
  buildEscalationEventPayload,
  assertEscalationEventRequired,
  emitEscalationEvent,
  ESCALATION_EVENT_PROPERTY_KEYS,
} from '@/lib/escalationEvent';
import {
  buildFeedbackEventPayload,
  assertFeedbackEventRequired,
  emitFeedbackEvent,
  FEEDBACK_EVENT_PROPERTY_KEYS,
} from '@/lib/feedbackEvent';

vi.mock('@/lib/telemetryQueue', () => ({
  enqueueCanonicalEvent: vi.fn().mockResolvedValue('queued'),
}));

describe('Iteration 9 canonical events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('closeout_event payload passes assert', () => {
    const p = buildCloseoutEventPayload({
      job: { id: 'j1', project_id: 'p' },
      user: { id: 'u1' },
      documentationComplete: true,
      customerSignatureCaptured: true,
      runbookComplete: true,
      requiredFieldsComplete: true,
    });
    expect(p.event_name).toBe('closeout_event');
    expect(p.documentation_complete_flag).toBe(true);
    expect(() => assertCloseoutEventRequired(p)).not.toThrow();
    expect(CLOSEOUT_EVENT_PROPERTY_KEYS).toContain('closeout_submit_timestamp');
  });

  it('closeout_event includes optional admin flags when set', () => {
    const p = buildCloseoutEventPayload({
      job: { id: 'j1' },
      user: null,
      documentationComplete: true,
      customerSignatureCaptured: true,
      runbookComplete: true,
      requiredFieldsComplete: true,
      timecardSubmittedFlag: true,
      invoiceSupportDocsFlag: true,
      portalUpdateFlag: false,
    });
    expect(p.timecard_submitted_flag).toBe(true);
    expect(p.invoice_support_docs_flag).toBe(true);
    expect(p.portal_update_flag).toBe(false);
    expect(() => assertCloseoutEventRequired(p)).not.toThrow();
  });

  it('escalation_event payload passes assert', () => {
    const p = buildEscalationEventPayload({
      job: { id: 'j1' },
      user: null,
      reasonCategory: 'access_issue',
      escalationSource: 'blocker_create',
      severity: 'high',
      escalationRecordId: 'blk-1',
      notesPreview: 'Gate locked',
    });
    expect(p.escalation_source).toBe('blocker_create');
    expect(p.reason_category).toBe('access_issue');
    expect(() => assertEscalationEventRequired(p)).not.toThrow();
    expect(ESCALATION_EVENT_PROPERTY_KEYS).toContain('notes_preview');
  });

  it('escalation_event supports runbook_escalation and resolved timestamp', () => {
    const resolved = '2025-03-19T12:00:00.000Z';
    const p = buildEscalationEventPayload({
      job: { id: 'j1' },
      user: null,
      reasonCategory: 'equipment_missing',
      escalationSource: 'runbook_escalation',
      escalationRecordId: 'blk-9',
      notesPreview: 'Task: Rack install',
      resolvedTimestampIso: resolved,
    });
    expect(p.escalation_source).toBe('runbook_escalation');
    expect(p.escalation_resolved_timestamp).toBe(resolved);
    expect(() => assertEscalationEventRequired(p)).not.toThrow();
  });

  it('feedback_event payload passes assert with flags only', () => {
    const p = buildFeedbackEventPayload({
      job: { id: 'j1' },
      user: { id: 'u' },
      complaintFlag: true,
      complimentFlag: false,
      feedbackSource: 'closeout',
    });
    expect(p.complaint_flag).toBe(true);
    expect(() => assertFeedbackEventRequired(p)).not.toThrow();
  });

  it('emitCloseoutEvent enqueues with allowlist', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitCloseoutEvent({
      job: { id: 'j' },
      user: null,
      documentationComplete: true,
      customerSignatureCaptured: false,
      runbookComplete: true,
      requiredFieldsComplete: true,
    });
    expect(enqueueCanonicalEvent).toHaveBeenCalledTimes(1);
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: CLOSEOUT_EVENT_PROPERTY_KEYS,
    });
  });

  it('emitEscalationEvent enqueues', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitEscalationEvent({
      job: { id: 'j' },
      user: null,
      reasonCategory: 'scope_change',
      escalationSource: 'pm_chat',
      notesPreview: 'Need PM approval',
    });
    expect(enqueueCanonicalEvent.mock.calls[0][0].event_name).toBe('escalation_event');
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: ESCALATION_EVENT_PROPERTY_KEYS,
    });
  });

  it('emitFeedbackEvent enqueues', async () => {
    const { enqueueCanonicalEvent } = await import('@/lib/telemetryQueue');
    await emitFeedbackEvent({
      job: { id: 'j' },
      user: null,
      ratingValue: 5,
      complaintFlag: false,
      complimentFlag: true,
      feedbackSource: 'signoff',
    });
    expect(enqueueCanonicalEvent.mock.calls[0][0].rating_value).toBe(5);
    expect(enqueueCanonicalEvent.mock.calls[0][1]).toEqual({
      allowlistKeys: FEEDBACK_EVENT_PROPERTY_KEYS,
    });
  });
});
