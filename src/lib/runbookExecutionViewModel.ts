/**
 * Pure helpers for canonical field Runbook (job.runbook_phases): ordering, gating, progress, merge for persist.
 */

export interface EmbeddedRunbookStep {
  id: string
  name?: string
  title?: string
  description?: string
  order?: number
  required?: boolean
  completed?: boolean
  completed_at?: string
  result?: string
  override_reason?: string | null
  step_family?: string
  family?: string
  category?: string
  required_evidence_types?: string[]
}

export interface EmbeddedRunbookPhase {
  id: string
  name?: string
  order?: number
  steps?: EmbeddedRunbookStep[]
  meta?: Record<string, unknown>
}

export function stepDisplayTitle(step: EmbeddedRunbookStep): string {
  return (step.title ?? step.name ?? 'Step').trim() || 'Step'
}

export function sortRunbookPhases(phases: EmbeddedRunbookPhase[]): EmbeddedRunbookPhase[] {
  return [...(phases || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function sortStepsInPhase(steps: EmbeddedRunbookStep[] | undefined): EmbeddedRunbookStep[] {
  return [...(steps || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** Phase N+1 blocked until all required steps in prior phases are done (or optional-only satisfied). Mirrors RunbookView. */
export function computePhaseBlocked(sortedPhases: EmbeddedRunbookPhase[]): Record<string, boolean> {
  const phaseBlocked: Record<string, boolean> = {}
  let previousPhaseComplete = true
  for (const phase of sortedPhases) {
    phaseBlocked[phase.id] = !previousPhaseComplete
    const steps = phase.steps || []
    const allDone = steps.every((s) => s.completed || s.required === false)
    if (!allDone) previousPhaseComplete = false
  }
  return phaseBlocked
}

export interface RunbookProgressCounts {
  totalSteps: number
  totalDone: number
  requiredTotal: number
  requiredDone: number
}

export function computeRunbookProgress(sortedPhases: EmbeddedRunbookPhase[]): RunbookProgressCounts {
  const allSteps = sortedPhases.flatMap((p) => sortStepsInPhase(p.steps))
  const totalSteps = allSteps.length
  const totalDone = allSteps.filter((s) => s.completed).length
  const requiredTotal = allSteps.filter((s) => s.required !== false).length
  const requiredDone = allSteps.filter((s) => s.completed && s.required !== false).length
  return { totalSteps, totalDone, requiredTotal, requiredDone }
}

/** True when every step in every phase is marked completed on the job (same rule as closeout/runbook banners). */
export function isRunbookComplete(phases: EmbeddedRunbookPhase[] | undefined | null): boolean {
  return phases?.every((phase) => phase.steps?.every((step) => step.completed)) ?? false
}

export interface NextFocusRef {
  phaseId: string
  stepId: string
}

/** First incomplete required step in phase order, skipping steps in blocked phases. */
export function findNextFocusStep(
  sortedPhases: EmbeddedRunbookPhase[],
  phaseBlocked: Record<string, boolean>
): NextFocusRef | null {
  for (const phase of sortedPhases) {
    if (phaseBlocked[phase.id]) continue
    const steps = sortStepsInPhase(phase.steps)
    for (const step of steps) {
      if (step.required === false) continue
      if (!step.completed) return { phaseId: phase.id, stepId: step.id }
    }
  }
  return null
}

export type StepPersistOutcome = 'pass' | 'fail'

/** Deep-merge outcome onto matching step; sets completed + completed_at + result (RunbookView-compatible). */
export function mergeRunbookStepOutcome(
  phases: EmbeddedRunbookPhase[],
  stepId: string,
  outcome: StepPersistOutcome
): EmbeddedRunbookPhase[] {
  const ts = new Date().toISOString()
  const result = outcome === 'pass' ? 'pass' : 'fail'
  return phases.map((phase) => ({
    ...phase,
    steps: (phase.steps || []).map((step) =>
      step.id === stepId
        ? {
            ...step,
            completed: true,
            completed_at: ts,
            result,
            override_reason: null,
          }
        : step
    ),
  }))
}

/** Derived UI bucket for a persisted step (null = not finished on job). */
export function persistedStepUiBucket(step: EmbeddedRunbookStep): 'complete' | 'failed' | 'overridden' | null {
  if (!step.completed) return null
  if (step.override_reason) return 'overridden'
  const r = step.result || 'pass'
  if (r === 'fail' || r === 'fail_remediated') return 'failed'
  return 'complete'
}
