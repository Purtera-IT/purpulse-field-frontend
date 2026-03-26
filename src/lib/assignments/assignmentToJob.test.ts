import { describe, expect, it } from 'vitest'
import { assignmentToJob, mapWorkOrderStatusToFieldStatus, overlayCachedRunbookProgress } from './assignmentToJob'
import type { ResolvedAssignment } from '@/api/types'

const minimalRunbook = {
  schema: 'runbook_v2',
  execution: {
    phases: [{ id: 'p1', name: 'P', order: 0 }],
    steps: [
      {
        id: 's1',
        phase_id: 'p1',
        title: 'One',
        order: 0,
        gate: 'important',
      },
    ],
  },
}

describe('mapWorkOrderStatusToFieldStatus', () => {
  it('maps PM statuses to field statuses', () => {
    expect(mapWorkOrderStatusToFieldStatus('scheduled')).toBe('assigned')
    expect(mapWorkOrderStatusToFieldStatus('in_progress')).toBe('in_progress')
    expect(mapWorkOrderStatusToFieldStatus('closeout_ready')).toBe('pending_closeout')
    expect(mapWorkOrderStatusToFieldStatus('closed')).toBe('approved')
  })
})

describe('overlayCachedRunbookProgress', () => {
  it('merges completion by step id', () => {
    const base = [
      {
        id: 'p1',
        name: 'P',
        order: 0,
        meta: {},
        steps: [
          {
            id: 's1',
            name: 'One',
            title: 'One',
            order: 0,
            completed: false,
            required: true,
            step_family: 'important',
            category: 'important',
          },
        ],
      },
    ]
    const cached = [
      {
        ...base[0],
        steps: [
          {
            ...base[0].steps[0],
            completed: true,
            completed_at: '2026-01-01T00:00:00.000Z',
            result: 'pass',
          },
        ],
      },
    ]
    const out = overlayCachedRunbookProgress(base as never, cached as never)
    expect(out[0].steps[0].completed).toBe(true)
    expect(out[0].steps[0].result).toBe('pass')
  })
})

describe('assignmentToJob', () => {
  it('builds Job with purpulse_api source and phases', () => {
    const a: ResolvedAssignment = {
      job_id: '11111111-1111-1111-1111-111111111111',
      title: 'WO',
      project_name: 'Proj',
      scheduled_date: '2026-03-01',
      status: 'in_progress',
      fieldnation_workorder_id: 1,
      site_name: 'Site A',
      runbook_version: 'v-art',
      runbook_json: minimalRunbook,
      evidence_requirements: [],
      debug: { reason_code: null },
    }
    const job = assignmentToJob(a, { technicianEmail: 't@x.com' })
    expect(job.assignment_source).toBe('purpulse_api')
    expect(job.runbook_phases?.length).toBe(1)
    expect(job.runbook_phases?.[0].steps?.[0].id).toBe('s1')
    expect(job.project_name).toBe('Proj')
    expect(job.site_name).toBe('Site A')
  })
})
