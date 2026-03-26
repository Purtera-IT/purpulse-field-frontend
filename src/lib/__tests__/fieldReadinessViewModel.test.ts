import { describe, it, expect } from 'vitest'
import { buildFieldReadinessSummary, READINESS_SHORT_LINES } from '../fieldReadinessViewModel'
import type { Job } from '@/api/types'

function baseJob(over: Partial<Job>): Job {
  return {
    id: 'j1',
    created_date: '2025-01-01T00:00:00.000Z',
    updated_date: '2025-01-01T00:00:00.000Z',
    created_by: 'a@b.com',
    title: 'T',
    status: 'assigned',
    priority: 'medium',
    ...over,
  } as Job
}

describe('buildFieldReadinessSummary', () => {
  it('assigned: route is current', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'assigned' }), {
      hasWorkStartTimeEntry: false,
    })
    expect(s.phases[0].state).toBe('current')
    expect(s.phases[1].state).toBe('upcoming')
    expect(s.phases[2].state).toBe('upcoming')
    expect(s.headline).toMatch(/en route/i)
  })

  it('en_route: route complete, start work current', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'en_route' }), {
      hasWorkStartTimeEntry: false,
    })
    expect(s.phases[0].state).toBe('complete')
    expect(s.phases[1].state).toBe('current')
    expect(s.phases[2].state).toBe('upcoming')
  })

  it('checked_in: start work current', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'checked_in' }), {
      hasWorkStartTimeEntry: false,
    })
    expect(s.phases[0].state).toBe('complete')
    expect(s.phases[1].state).toBe('current')
    expect(s.phases[2].state).toBe('upcoming')
  })

  it('in_progress without work_start: timer current', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'in_progress' }), {
      hasWorkStartTimeEntry: false,
    })
    expect(s.phases[0].state).toBe('complete')
    expect(s.phases[1].state).toBe('complete')
    expect(s.phases[2].state).toBe('current')
    expect(s.headline).toMatch(/timer/i)
  })

  it('in_progress with work_start: all complete', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'in_progress' }), {
      hasWorkStartTimeEntry: true,
    })
    expect(s.phases.every((p) => p.state === 'complete')).toBe(true)
  })

  it('includes disclaimer', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'assigned' }), {
      hasWorkStartTimeEntry: false,
    })
    expect(s.disclaimer.length).toBeGreaterThan(10)
  })

  it('assigned headline matches READINESS_SHORT_LINES.assigned', () => {
    const s = buildFieldReadinessSummary(baseJob({ status: 'assigned' }), {
      hasWorkStartTimeEntry: false,
    })
    expect(s.headline).toBe(READINESS_SHORT_LINES.assigned)
  })

  it('en_route, checked_in, paused headlines match READINESS_SHORT_LINES (header + card alignment)', () => {
    expect(
      buildFieldReadinessSummary(baseJob({ status: 'en_route' }), { hasWorkStartTimeEntry: false }).headline
    ).toBe(READINESS_SHORT_LINES.en_route)
    expect(
      buildFieldReadinessSummary(baseJob({ status: 'checked_in' }), { hasWorkStartTimeEntry: false }).headline
    ).toBe(READINESS_SHORT_LINES.checked_in)
    expect(
      buildFieldReadinessSummary(baseJob({ status: 'paused' }), { hasWorkStartTimeEntry: true }).headline
    ).toBe(READINESS_SHORT_LINES.paused)
  })
})
