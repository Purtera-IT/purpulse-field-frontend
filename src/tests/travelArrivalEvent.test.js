/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  buildTravelEventPayload,
  buildArrivalEventPayload,
  computeOpenTravelMinutesForJob,
  assertTravelEventRequired,
  assertArrivalEventRequired,
  plannedEtaIsoFromJob,
} from '@/lib/travelArrivalEvent';

describe('travelArrivalEvent', () => {
  it('computeOpenTravelMinutesForJob returns minutes for open travel segment', () => {
    const jobId = 'j1';
    const entries = [
      { job_id: jobId, entry_type: 'travel_start', timestamp: '2026-03-19T10:00:00.000Z' },
    ];
    const mins = computeOpenTravelMinutesForJob(entries, jobId, '2026-03-19T10:30:00.000Z');
    expect(mins).toBe(30);
  });

  it('buildTravelEventPayload sets route_departure_timestamp for travel_start semantics', () => {
    const p = buildTravelEventPayload({
      job: { id: 'job_1', site_id: 's1' },
      user: { id: 'u1' },
      timestampIso: '2026-03-18T13:25:00.000Z',
      routeDeparture: '2026-03-18T13:25:00.000Z',
    });
    expect(p.event_name).toBe('travel_event');
    expect(p.route_departure_timestamp).toBe('2026-03-18T13:25:00.000Z');
    expect(p.job_id).toBe('job_1');
    expect(p.technician_id).toBeTruthy();
  });

  it('buildArrivalEventPayload sets checkin_timestamp', () => {
    const p = buildArrivalEventPayload({
      job: { id: 'job_1' },
      user: { id: 'u1' },
      timestampIso: '2026-03-18T14:03:00.000Z',
      checkin: '2026-03-18T14:03:00.000Z',
    });
    expect(p.event_name).toBe('arrival_event');
    expect(p.checkin_timestamp).toBe('2026-03-18T14:03:00.000Z');
  });

  it('buildTravelEventPayload sets eta_ack_timestamp and planned_eta from job schedule', () => {
    const p = buildTravelEventPayload({
      job: { id: 'j1', scheduled_date: '2026-03-20T00:00:00.000Z', scheduled_time: '14:30' },
      user: null,
      timestampIso: '2026-03-20T13:00:00.000Z',
      routeDeparture: '2026-03-20T13:00:00.000Z',
      etaAckTimestamp: '2026-03-20T13:00:05.000Z',
    });
    expect(p.eta_ack_timestamp).toBe('2026-03-20T13:00:05.000Z');
    expect(p.planned_eta_timestamp).toMatch(/^2026-03-20/);
    expect(() => assertTravelEventRequired(p)).not.toThrow();
  });

  it('plannedEtaIsoFromJob parses scheduled_date + scheduled_time', () => {
    const iso = plannedEtaIsoFromJob({
      scheduled_date: '2026-06-01T00:00:00.000Z',
      scheduled_time: '09:15',
    });
    expect(iso).toContain('2026-06-01');
  });

  it('buildArrivalEventPayload attaches Iteration 11 scope acknowledgement flags', () => {
    const p = buildArrivalEventPayload({
      job: { id: 'job_1' },
      user: { id: 'u1' },
      timestampIso: '2026-03-18T14:03:00.000Z',
      checkin: '2026-03-18T14:03:00.000Z',
      arrivalScopeAcknowledgements: {
        required_docs_opened_flag: true,
        risk_flag_ack_flag: true,
        customer_notes_review_flag: true,
        site_constraint_ack_flag: true,
        step_sequence_preview_flag: true,
      },
    });
    expect(p.required_docs_opened_flag).toBe(true);
    expect(p.step_sequence_preview_flag).toBe(true);
    expect(() => assertArrivalEventRequired(p)).not.toThrow();
  });
});
