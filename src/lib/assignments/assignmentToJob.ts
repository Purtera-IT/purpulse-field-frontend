/**
 * Map PurPulse GET /api/assignments rows + runbook_v2 snapshot into field Job shape
 * (Base44-compatible + runbook_phases for RunbookSteps).
 */
import type { Job } from '@/api/types'
import type { ResolvedAssignment } from '@/api/types'
import { parseRunbookJsonFromAssignment } from '@/lib/runbook/runbookV2Snapshot'
import type { EmbeddedRunbookPhase, EmbeddedRunbookStep } from '@/lib/runbookExecutionViewModel'
import {
  buildJobDescriptionFromSnapshot,
  extractHazards,
  extractOnSiteContact,
  formatSiteAddressFromContext,
} from '@/lib/runbook/runbookJobHydration'

const FIELD_STATUSES = [
  'assigned',
  'en_route',
  'checked_in',
  'in_progress',
  'paused',
  'pending_closeout',
  'submitted',
  'approved',
  'rejected',
] as const

type FieldStatus = (typeof FIELD_STATUSES)[number]

/** Map PM work_orders.status to field JobSchema status */
export function mapWorkOrderStatusToFieldStatus(wo: string | null | undefined): FieldStatus {
  const s = (wo || '').toLowerCase().trim()
  switch (s) {
    case 'scheduled':
    case 'draft':
      return 'assigned'
    case 'in_progress':
    case 'submitted':
    case 'qc_review':
    case 'qc_passed':
    case 'qc_failed':
    case 'remediating':
      return 'in_progress'
    case 'closeout_ready':
    case 'invoiced':
      return 'pending_closeout'
    case 'closed':
      return 'approved'
    case 'assigned':
    case 'en_route':
    case 'checked_in':
    case 'paused':
    case 'pending_closeout':
    case 'approved':
    case 'rejected':
      return s as FieldStatus
    default:
      return 'assigned'
  }
}

function runbookV2ExecutionToPhases(runbookJson: unknown): EmbeddedRunbookPhase[] {
  const parsed = parseRunbookJsonFromAssignment(runbookJson)
  if (parsed.kind !== 'runbook_v2') {
    return []
  }
  const snap = parsed.snapshot
  const exec = snap.execution
  if (!exec || !Array.isArray(exec.phases) || !Array.isArray(exec.steps)) {
    return []
  }

  const phases = [...exec.phases].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  ) as Array<Record<string, unknown>>

  const steps = exec.steps as Array<Record<string, unknown>>

  return phases.map((p) => {
    const pid = String(p.id ?? '')
    const phaseSteps = steps
      .filter((s) => String(s.phase_id ?? '') === pid)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))

    const embeddedSteps: EmbeddedRunbookStep[] = phaseSteps.map((s) => {
      const gate = s.gate as string | undefined
      const family =
        gate === 'critical' ? 'red_gate' : gate === 'important' ? 'important' : 'informational'
      return {
        id: String(s.id ?? ''),
        name: String(s.title ?? s.id ?? 'Step'),
        title: String(s.title ?? ''),
        description: typeof s.instructions === 'string' ? s.instructions : undefined,
        order: Number(s.order) || 0,
        completed: false,
        required: true,
        step_family: family,
        category: family,
        required_evidence_types: Array.isArray(s.evidence_expectations)
          ? (s.evidence_expectations as { label?: string }[])
              .map((e) => e.label)
              .filter(Boolean)
          : undefined,
      }
    })

    return {
      id: pid,
      name: String(p.name ?? pid),
      order: Number(p.order) || 0,
      meta: (p.meta && typeof p.meta === 'object' ? p.meta : {}) as Record<string, unknown>,
      steps: embeddedSteps,
    }
  })
}

/**
 * Overlay completion from a previous cached job (Dexie) by stable step id.
 */
export function overlayCachedRunbookProgress(
  phases: EmbeddedRunbookPhase[],
  cachedPhases: EmbeddedRunbookPhase[] | undefined | null,
): EmbeddedRunbookPhase[] {
  if (!cachedPhases?.length) return phases

  const byStep = new Map<string, EmbeddedRunbookStep>()
  for (const p of cachedPhases) {
    for (const s of p.steps || []) {
      if (s?.id) byStep.set(s.id, s)
    }
  }

  return phases.map((p) => ({
    ...p,
    steps: (p.steps || []).map((s) => {
      const prev = byStep.get(s.id)
      if (!prev) return s
      return {
        ...s,
        completed: prev.completed ?? s.completed,
        completed_at: prev.completed_at ?? s.completed_at,
        result: prev.result ?? s.result,
        override_reason: prev.override_reason ?? s.override_reason,
      }
    }),
  }))
}

export function assignmentToJob(
  a: ResolvedAssignment,
  opts: { technicianEmail: string; mergeCachedJob?: Job | null },
): Job {
  const now = new Date().toISOString()
  const email = opts.technicianEmail || 'technician@field.local'
  let phases = runbookV2ExecutionToPhases(a.runbook_json)

  if (opts.mergeCachedJob?.runbook_phases?.length) {
    phases = overlayCachedRunbookProgress(phases, opts.mergeCachedJob.runbook_phases as EmbeddedRunbookPhase[])
  }

  const parsed = parseRunbookJsonFromAssignment(a.runbook_json)

  const sched = a.scheduled_date
  const scheduledIso = sched
    ? /T\d/.test(sched)
      ? sched
      : `${sched.slice(0, 10)}T12:00:00.000Z`
    : undefined

  const ac =
    parsed.kind === 'runbook_v2'
      ? (parsed.snapshot.assignment_context as Record<string, unknown> | undefined)
      : undefined
  const pc =
    parsed.kind === 'runbook_v2'
      ? (parsed.snapshot.program_context as Record<string, unknown> | undefined)
      : undefined

  let siteFromProgram: string | undefined
  if (parsed.kind === 'runbook_v2') {
    const prog = parsed.snapshot.program_context as Record<string, unknown> | undefined
    const site = prog?.site
    if (site && typeof site === 'object' && !Array.isArray(site)) {
      const n = (site as Record<string, unknown>).name
      if (typeof n === 'string' && n.trim()) siteFromProgram = n.trim()
    }
  }
  const siteName = a.site_name || (ac?.site_name as string) || siteFromProgram || undefined

  const siteAddress =
    formatSiteAddressFromContext(ac?.site_address) ||
    (typeof ac?.site_address === 'string' ? ac.site_address.trim() : undefined)

  const contact = extractOnSiteContact(ac, pc)
  const description = buildJobDescriptionFromSnapshot(pc, ac)
  const hazards = extractHazards(pc)

  let contactEmail: string | undefined
  if (contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    contactEmail = contact.email
  }

  const job: Job = {
    id: a.job_id,
    created_date: now,
    updated_date: now,
    created_by: email,
    external_id: a.fieldnation_workorder_id != null ? String(a.fieldnation_workorder_id) : undefined,
    title: a.title || 'Work order',
    description,
    status: mapWorkOrderStatusToFieldStatus(a.status),
    priority: 'medium',
    scheduled_date: scheduledIso,
    scheduled_time: undefined,
    project_name: a.project_name || undefined,
    site_name: typeof siteName === 'string' ? siteName : undefined,
    site_address: siteAddress,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_email: contactEmail,
    hazards,
    assigned_to: email,
    assigned_name: undefined,
    sync_status: 'synced',
    progress: undefined,
    // Extended fields (JobSchema.extend)
    runbook_phases: phases as unknown as Job['runbook_phases'],
    runbook_version: a.runbook_version,
    assignment_source: 'purpulse_api',
    assignment_debug: a.debug as unknown as Record<string, unknown>,
    fieldnation_workorder_id: a.fieldnation_workorder_id ?? null,
    runbook_assignment_context: ac ? { ...ac } : undefined,
    runbook_program_context: pc ? { ...pc } : undefined,
  } as Job

  return job
}
