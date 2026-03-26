import { describe, it, expect } from 'vitest'
import {
  sortRunbookPhases,
  computePhaseBlocked,
  computeRunbookProgress,
  findNextFocusStep,
  isRunbookComplete,
  mergeRunbookStepOutcome,
  persistedStepUiBucket,
  stepDisplayTitle,
  type EmbeddedRunbookPhase,
} from '../runbookExecutionViewModel'

function phase(
  id: string,
  order: number,
  steps: Array<{ id: string; required?: boolean; completed?: boolean; order?: number }>
): EmbeddedRunbookPhase {
  return {
    id,
    name: id,
    order,
    steps: steps.map((s) => ({
      id: s.id,
      title: s.id,
      order: s.order ?? 0,
      required: s.required !== false,
      completed: s.completed ?? false,
    })),
  }
}

describe('runbookExecutionViewModel', () => {
  it('sortRunbookPhases orders by order', () => {
    const sorted = sortRunbookPhases([phase('b', 2, []), phase('a', 1, [])])
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('computePhaseBlocked blocks phase 2 until phase 1 required steps done', () => {
    const phases = sortRunbookPhases([
      phase('p1', 1, [
        { id: 's1', completed: false },
        { id: 's2', completed: false },
      ]),
      phase('p2', 2, [{ id: 's3', completed: false }]),
    ])
    const blocked = computePhaseBlocked(phases)
    expect(blocked.p1).toBe(false)
    expect(blocked.p2).toBe(true)
  })

  it('computePhaseBlocked unblocks next phase when all required complete', () => {
    const phases = sortRunbookPhases([
      phase('p1', 1, [
        { id: 's1', completed: true },
        { id: 's2', completed: true },
      ]),
      phase('p2', 2, [{ id: 's3', completed: false }]),
    ])
    const blocked = computePhaseBlocked(phases)
    expect(blocked.p2).toBe(false)
  })

  it('optional incomplete steps do not block next phase', () => {
    const phases = sortRunbookPhases([
      {
        id: 'p1',
        order: 1,
        steps: [
          { id: 's1', title: 'r', order: 0, required: true, completed: true },
          { id: 's2', title: 'o', order: 1, required: false, completed: false },
        ],
      },
      phase('p2', 2, [{ id: 's3', completed: false }]),
    ])
    const blocked = computePhaseBlocked(phases)
    expect(blocked.p2).toBe(false)
  })

  it('isRunbookComplete is false when phases undefined', () => {
    expect(isRunbookComplete(undefined)).toBe(false)
    expect(isRunbookComplete(null)).toBe(false)
  })

  it('isRunbookComplete is true when empty phases array', () => {
    expect(isRunbookComplete([])).toBe(true)
  })

  it('isRunbookComplete requires every step completed', () => {
    const done = sortRunbookPhases([phase('p1', 1, [{ id: 'a', completed: true }])])
    expect(isRunbookComplete(done)).toBe(true)
    const notDone = sortRunbookPhases([phase('p1', 1, [{ id: 'a', completed: false }])])
    expect(isRunbookComplete(notDone)).toBe(false)
  })

  it('isRunbookComplete is false when a phase has no steps property', () => {
    const phases: EmbeddedRunbookPhase[] = [{ id: 'p1', order: 1 }]
    expect(isRunbookComplete(phases)).toBe(false)
  })

  it('computeRunbookProgress', () => {
    const phases = sortRunbookPhases([
      phase('p1', 1, [
        { id: 'a', completed: true },
        { id: 'b', completed: false },
        { id: 'c', required: false, completed: false },
      ]),
    ])
    const p = computeRunbookProgress(phases)
    expect(p.totalSteps).toBe(3)
    expect(p.totalDone).toBe(1)
    expect(p.requiredTotal).toBe(2)
    expect(p.requiredDone).toBe(1)
  })

  it('findNextFocusStep returns first incomplete required in unlocked phase', () => {
    const phases = sortRunbookPhases([
      phase('p1', 1, [
        { id: 's1', completed: true },
        { id: 's2', completed: false },
      ]),
      phase('p2', 2, [{ id: 's3', completed: false }]),
    ])
    const blocked = computePhaseBlocked(phases)
    expect(findNextFocusStep(phases, blocked)).toEqual({ phaseId: 'p1', stepId: 's2' })
  })

  it('findNextFocusStep skips blocked phases', () => {
    const phases = sortRunbookPhases([
      phase('p1', 1, [{ id: 's1', completed: false }]),
      phase('p2', 2, [{ id: 's2', completed: false }]),
    ])
    const blocked = { p1: false, p2: true }
    expect(findNextFocusStep(phases, blocked)).toEqual({ phaseId: 'p1', stepId: 's1' })
  })

  it('mergeRunbookStepOutcome sets completed and result', () => {
    const phases = sortRunbookPhases([phase('p1', 1, [{ id: 's1', completed: false }])])
    const next = mergeRunbookStepOutcome(phases, 's1', 'pass')
    expect(next[0].steps?.[0].completed).toBe(true)
    expect(next[0].steps?.[0].result).toBe('pass')
    expect(next[0].steps?.[0].completed_at).toBeTruthy()
  })

  it('persistedStepUiBucket', () => {
    expect(persistedStepUiBucket({ id: '1', completed: false })).toBe(null)
    expect(persistedStepUiBucket({ id: '1', completed: true, result: 'pass' })).toBe('complete')
    expect(persistedStepUiBucket({ id: '1', completed: true, result: 'fail' })).toBe('failed')
    expect(persistedStepUiBucket({ id: '1', completed: true, result: 'fail_remediated' })).toBe('failed')
    expect(
      persistedStepUiBucket({ id: '1', completed: true, result: 'pass', override_reason: 'x' })
    ).toBe('overridden')
  })

  it('stepDisplayTitle', () => {
    expect(stepDisplayTitle({ id: '1', title: 'T' })).toBe('T')
    expect(stepDisplayTitle({ id: '1', name: 'N' })).toBe('N')
  })
})
