import { describe, expect, it } from 'vitest'
import { mergeRunbookV2WithJobPhases, parseRunbookJsonFromAssignment } from './runbookV2Snapshot'
import type { EmbeddedRunbookPhase } from '@/lib/runbookExecutionViewModel'

describe('parseRunbookJsonFromAssignment', () => {
  it('detects runbook_v2', () => {
    const r = parseRunbookJsonFromAssignment({
      schema: 'runbook_v2',
      schema_version: '2.0.0',
      execution: { phases: [], steps: [{ id: 's1', title: 'T' }] },
    })
    expect(r.kind).toBe('runbook_v2')
    if (r.kind === 'runbook_v2') {
      expect(r.snapshot.schema).toBe('runbook_v2')
    }
  })
})

describe('mergeRunbookV2WithJobPhases', () => {
  it('overlays completion by step id', () => {
    const phases: EmbeddedRunbookPhase[] = [
      {
        id: 'p1',
        steps: [{ id: 'PA-1', title: 'x', completed: true, completed_at: '2026-01-01T00:00:00.000Z' }],
      },
    ]
    const out = mergeRunbookV2WithJobPhases(
      {
        schema: 'runbook_v2',
        execution: {
          phases: [],
          steps: [{ id: 'PA-1', title: 'Review' }],
        },
      },
      phases,
    )
    expect(out[0]?.completed).toBe(true)
    expect(out[0]?.completed_at).toBe('2026-01-01T00:00:00.000Z')
  })
})
