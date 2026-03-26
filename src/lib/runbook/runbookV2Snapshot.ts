/**
 * Field-app parsing for technician-facing runbook_v2 snapshots (from GET /api/assignments runbook_json).
 * Immutable snapshot + mutable completion merged separately (see mergeRunbookV2WithJobPhases).
 */
import { z } from 'zod'
import type { EmbeddedRunbookPhase, EmbeddedRunbookStep } from '@/lib/runbookExecutionViewModel'

/** Loose parse — forward-compatible with new fields from PM */
export const RunbookV2SnapshotLooseSchema = z
  .object({
    schema: z.literal('runbook_v2'),
    schema_version: z.string().optional(),
    assignment_context: z.record(z.unknown()).optional(),
    program_context: z.record(z.unknown()).optional(),
    execution: z
      .object({
        phases: z.array(z.record(z.unknown())),
        steps: z.array(z.record(z.unknown())),
      })
      .optional(),
    render_hints: z.record(z.unknown()).optional(),
  })
  .passthrough()

export type RunbookV2SnapshotLoose = z.infer<typeof RunbookV2SnapshotLooseSchema>

export function parseRunbookJsonFromAssignment(runbookJson: unknown): {
  kind: 'runbook_v2'
  snapshot: RunbookV2SnapshotLoose
} | { kind: 'legacy'; raw: Record<string, unknown> } {
  if (runbookJson && typeof runbookJson === 'object' && !Array.isArray(runbookJson)) {
    const o = runbookJson as Record<string, unknown>
    if (o.schema === 'runbook_v2') {
      const parsed = RunbookV2SnapshotLooseSchema.safeParse(runbookJson)
      if (parsed.success) {
        return { kind: 'runbook_v2', snapshot: parsed.data }
      }
    }
    return { kind: 'legacy', raw: o }
  }
  return { kind: 'legacy', raw: {} }
}

export type RunbookV2StepWithProgress = Record<string, unknown> & {
  completed?: boolean
  completed_at?: string | null
}

/**
 * Overlay step completion from persisted job.runbook_phases (same stable step ids).
 * Does not mutate the snapshot object from the server — returns steps with progress fields for UI.
 */
export function mergeRunbookV2WithJobPhases(
  snapshot: RunbookV2SnapshotLoose,
  jobPhases: EmbeddedRunbookPhase[] | undefined | null,
): RunbookV2StepWithProgress[] {
  const steps = snapshot.execution?.steps
  if (!Array.isArray(steps)) return []

  const byId = new Map<string, EmbeddedRunbookStep>()
  for (const p of jobPhases || []) {
    for (const s of p?.steps || []) {
      if (s?.id) byId.set(s.id, s)
    }
  }

  return steps.map((row) => {
    const id = typeof row.id === 'string' ? row.id : ''
    const js = id ? byId.get(id) : undefined
    return {
      ...row,
      completed: js?.completed ?? false,
      completed_at: js?.completed_at ?? null,
    }
  })
}
