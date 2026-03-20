/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { buildToolCheckEventPayload, assertToolCheckEventRequired } from '@/lib/toolCheckEvent';
import { buildDispatchEventPayload, assertDispatchEventRequired } from '@/lib/dispatchEvent';
import {
  allScopeAcknowledgementsTrue,
  emptyScopeAcknowledgementState,
  SCOPE_ACKNOWLEDGEMENT_KEYS,
} from '@/constants/scopeAcknowledgements';

describe('Iteration 11 — scope acknowledgements', () => {
  it('empty scope state is not all true', () => {
    const s = emptyScopeAcknowledgementState();
    expect(SCOPE_ACKNOWLEDGEMENT_KEYS.length).toBe(5);
    expect(allScopeAcknowledgementsTrue(s)).toBe(false);
  });

  it('tool_check_event may include scope flags when all readiness checks pass', () => {
    const scope = Object.fromEntries(SCOPE_ACKNOWLEDGEMENT_KEYS.map((k) => [k, true]));
    const p = buildToolCheckEventPayload({
      job: { id: 'j1' },
      user: null,
      ppeCompliant: true,
      essentialToolsReady: true,
      bomDocsReviewed: true,
      siteSafetyAck: true,
      scopeAcknowledgements: scope,
    });
    expect(p.required_docs_opened_flag).toBe(true);
    expect(() => assertToolCheckEventRequired(p)).not.toThrow();
  });

  it('dispatch_event accepts eta_ack_timestamp override', () => {
    const p = buildDispatchEventPayload({
      job: { id: 'j1', status: 'en_route' },
      targetAppStatus: 'en_route',
      user: null,
      overrides: { eta_ack_timestamp: '2026-03-19T15:00:00.000Z' },
    });
    expect(p.eta_ack_timestamp).toBe('2026-03-19T15:00:00.000Z');
    expect(() => assertDispatchEventRequired(p)).not.toThrow();
  });
});
