/**
 * Closeout readiness — truthful checklist from job, evidence, runbook, timer, and Blocker records.
 * Uses the same transition rules as `canTransition` (technician role) for work-complete + submit gates.
 */
import { canTransition, type JobStatus, type UserRole } from '@/lib/jobStateMachine'
import { partitionEvidenceForRequirements, type EvidenceLike } from '@/lib/fieldEvidenceViewModel'
import { rollupUploadedEvidenceQc } from '@/lib/evidenceQcViewModel'
import type { Job } from '@/api/client'
import { hasTechnicianCloseoutFeedback, outcomeLabel } from '@/lib/fieldCloseoutFeedbackViewModel'

/** Sections the Closeout UI can deep-link via FieldJobDetail tab setter */
export type CloseoutNavSection =
  | 'overview'
  | 'runbook'
  | 'evidence'
  | 'comms'
  | 'closeout'
  | 'closeout_outcome'

export type CloseoutCheckKind = 'blocking' | 'attention' | 'info'

export interface CloseoutCheckItem {
  id: string
  label: string
  detail: string
  met: boolean
  kind: CloseoutCheckKind
  actionLabel?: string
  navigateTo?: CloseoutNavSection
}

/**
 * - `blocked` — unmet **blocking** checklist rows (must fix to proceed).
 * - `review_suggested` — no blocking gaps, but **attention** rows (timer, escalations, drift) warrant a look.
 */
export type CloseoutOverall =
  | 'ready'
  | 'blocked'
  | 'review_suggested'
  | 'early_stage'
  | 'paused_work'
  | 'submitted_phase'

export interface CloseoutReadinessSummary {
  headline: string
  subline?: string
  overall: CloseoutOverall
  checks: CloseoutCheckItem[]
}

const TECH: UserRole = 'technician'

function hasRunbookPhases(job: Pick<Job, 'runbook_phases'>): boolean {
  return Array.isArray(job.runbook_phases) && job.runbook_phases.length > 0
}

function openEscalationCount(blockers: Array<{ status?: string }> | undefined): number {
  if (!blockers?.length) return 0
  return blockers.filter((b) => b.status !== 'resolved').length
}

/** Blocking unmet takes precedence; attention-only yields a softer overall than blocked. */
export function deriveChecklistOverall(checks: CloseoutCheckItem[]): 'ready' | 'blocked' | 'review_suggested' {
  if (checks.some((c) => c.kind === 'blocking' && !c.met)) return 'blocked'
  if (checks.some((c) => c.kind === 'attention' && !c.met)) return 'review_suggested'
  return 'ready'
}

/**
 * Build closeout readiness for the canonical Closeout tab.
 * `runbookComplete` should match `isRunbookComplete(job.runbook_phases)` when phases exist.
 */
export function buildCloseoutReadinessSummary(input: {
  job: Pick<
    Job,
    | 'status'
    | 'runbook_phases'
    | 'evidence_requirements'
    | 'signoff_signature_url'
    | 'technician_closeout_outcome'
    | 'technician_closeout_recorded_at'
  >
  evidence: EvidenceLike[]
  runbookComplete: boolean
  workSegmentOpen: boolean
  blockers?: Array<{ status?: string }>
}): CloseoutReadinessSummary {
  const { job, evidence, runbookComplete, workSegmentOpen, blockers } = input
  const status = job.status as JobStatus
  const hasSignature = !!job.signoff_signature_url
  const checks: CloseoutCheckItem[] = []

  if (status === 'submitted' || status === 'approved') {
    return {
      overall: 'submitted_phase',
      headline: 'This job is past field closeout in this app.',
      subline: 'Submitted or approved — follow office workflow if you need changes.',
      checks: [],
    }
  }

  if (status === 'rejected') {
    return {
      overall: 'blocked',
      headline: 'Job was rejected — follow office instructions before closing out again.',
      checks: [],
    }
  }

  if (status === 'assigned' || status === 'en_route' || status === 'checked_in') {
    return {
      overall: 'early_stage',
      headline: 'Closeout comes after work is in progress and complete on site.',
      subline: 'Use Overview to move through travel, check-in, and start work. This checklist will apply when you are finishing work.',
      checks: [],
    }
  }

  if (status === 'paused') {
    checks.push({
      id: 'state_paused',
      label: 'Job state',
      detail: 'Work is paused. Resume on Overview before you mark work complete or use closeout.',
      met: false,
      kind: 'blocking',
      actionLabel: 'Open Overview',
      navigateTo: 'overview',
    })
    return {
      overall: 'paused_work',
      headline: 'Work is paused — resume before closeout.',
      subline:
        'After you resume, finish runbook and evidence, stop the timer when done, then mark work complete from Job state.',
      checks,
    }
  }

  const appendJobEvidenceReqs = () => {
    const parts = partitionEvidenceForRequirements(job, evidence)
    for (const row of parts) {
      const label = row.req.label?.trim() || row.req.type.replace(/_/g, ' ')
      const met = row.met
      checks.push({
        id: `job_req_${row.req.type}`,
        label: `Required evidence: ${label}`,
        detail: met
          ? `${row.uploaded} of ${row.min} on file for this requirement.`
          : `Add ${row.unmet} more (have ${row.uploaded}, office asked for ${row.min}).`,
        met,
        kind: 'blocking',
        actionLabel: 'Open Evidence',
        navigateTo: 'evidence',
      })
    }
  }

  const appendRunbookRow = (kind: CloseoutCheckKind) => {
    if (!hasRunbookPhases(job)) {
      checks.push({
        id: 'runbook_na',
        label: 'Runbook on job',
        detail: 'No runbook phases on this job — nothing to complete in Runbook.',
        met: true,
        kind: 'info',
      })
      return
    }
    checks.push({
      id: 'runbook_complete',
      label: 'Runbook steps',
      detail: runbookComplete
        ? 'All steps marked complete on the job.'
        : 'Finish required runbook steps on the job before treating work as done.',
      met: runbookComplete,
      kind,
      actionLabel: 'Open Runbook',
      navigateTo: 'runbook',
    })
  }

  const appendWorkCompleteTransitionRows = () => {
    const gate = canTransition('in_progress', 'pending_closeout', TECH, evidence, runbookComplete, false)
    for (const b of gate.blockers) {
      if (b.type === 'photo_count') {
        checks.push({
          id: 'gate_photos',
          label: 'Before / after photos',
          detail: b.isMet
            ? `At least ${b.required} photo-type items on the job.`
            : `Add before/after photo evidence (${b.current ?? 0} of ${b.required ?? 2}). Needed before you can mark work complete.`,
          met: b.isMet,
          kind: 'blocking',
          actionLabel: 'Open Evidence',
          navigateTo: 'evidence',
        })
      } else if (b.type === 'checklist_complete') {
        checks.push({
          id: 'gate_runbook',
          label: 'Runbook checklist',
          detail: b.isMet
            ? 'Every runbook step is marked complete on this job.'
            : 'Finish every required runbook step before you mark work complete.',
          met: b.isMet,
          kind: 'blocking',
          actionLabel: 'Open Runbook',
          navigateTo: 'runbook',
        })
      }
    }
  }

  const appendTimerRow = (when: 'in_progress' | 'pending_closeout') => {
    if (!workSegmentOpen) return
    checks.push({
      id: 'timer_open',
      label: 'Work timer',
      detail:
        when === 'in_progress'
          ? 'Work timer is still running. Stop it from Job state when you are done on site, before you close out.'
          : 'Work timer still shows time on the clock — stop it from Job state if work is finished.',
      met: false,
      kind: 'attention',
      actionLabel: 'Open Overview',
      navigateTo: 'overview',
    })
  }

  const appendEscalationRow = () => {
    const n = openEscalationCount(blockers)
    if (n === 0) return
    checks.push({
      id: 'open_escalations',
      label: 'Escalations / blockers',
      detail: `${n} escalation record(s) still open or waiting on office — review in Comms so nothing is left hanging.`,
      met: false,
      kind: 'attention',
      actionLabel: 'Open Comms',
      navigateTo: 'comms',
    })
  }

  const appendQcFailedEvidenceRow = () => {
    const r = rollupUploadedEvidenceQc(evidence)
    if (r.failCount === 0) return
    checks.push({
      id: 'qc_evidence_failed',
      label: 'QC — failed evidence',
      detail: `Some saved evidence failed QC and may need replacement before you treat this job as quality-complete. Open Evidence to add new captures or follow office instructions.`,
      met: false,
      kind: 'attention',
      actionLabel: 'Open Evidence',
      navigateTo: 'evidence',
    })
  }

  if (status === 'in_progress') {
    appendWorkCompleteTransitionRows()
    appendJobEvidenceReqs()
    appendTimerRow('in_progress')
    appendEscalationRow()
    appendQcFailedEvidenceRow()

    const blockingUnmet = checks.filter((c) => c.kind === 'blocking' && !c.met)
    const attention = checks.filter((c) => c.kind === 'attention')

    let headline = 'Finish execution before you close out.'
    let subline =
      'Job state → Complete work moves you into closeout when the must-haves below are satisfied (unless an admin overrides).'
    if (blockingUnmet.length === 0 && attention.length === 0) {
      headline = 'Execution looks ready to move toward closeout.'
      subline =
        'When work is done on site, stop the timer if needed, then use Job state → Complete work. Add any remaining office-required evidence first.'
    } else if (blockingUnmet.length === 0) {
      headline = 'Must-haves met — scan the reminders below before you mark work complete.'
    }

    return {
      overall: deriveChecklistOverall(checks),
      headline,
      subline,
      checks,
    }
  }

  if (status === 'pending_closeout') {
    appendRunbookRow('attention')
    const photoGate = canTransition('in_progress', 'pending_closeout', TECH, evidence, runbookComplete, false)
    const photoReq = photoGate.blockers.find((b) => b.type === 'photo_count')
    if (photoReq && !photoReq.isMet) {
      checks.push({
        id: 'drift_photos',
        label: 'Before / after photos',
        detail: `Only ${photoReq.current ?? 0} photo-type items — expected at least ${photoReq.required ?? 2}. Add evidence or confirm with the office.`,
        met: false,
        kind: 'attention',
        actionLabel: 'Open Evidence',
        navigateTo: 'evidence',
      })
    }

    appendJobEvidenceReqs()
    for (const c of checks) {
      if (c.id.startsWith('job_req_') && !c.met) c.kind = 'attention'
    }

    checks.push({
      id: 'signoff',
      label: 'Customer sign-off',
      detail: hasSignature
        ? 'Signature is on file for this job.'
        : 'Capture customer sign-off below — required before you can hand the job in from Job state.',
      met: hasSignature,
      kind: 'blocking',
      actionLabel: hasSignature ? undefined : 'Show sign-off',
      navigateTo: 'closeout',
    })

    appendTimerRow('pending_closeout')
    appendEscalationRow()
    appendQcFailedEvidenceRow()

    const feedbackRecorded = hasTechnicianCloseoutFeedback(job)
    const outcome = job.technician_closeout_outcome
    checks.push({
      id: 'technician_closeout_feedback',
      label: 'Technician finish outcome',
      detail: feedbackRecorded
        ? `Informational — recorded: ${outcome === 'clean' || outcome === 'concerns' || outcome === 'problematic' ? outcomeLabel(outcome) : 'on file'}. Optional rating and flags are saved on the job; you can update before submit.`
        : 'Informational — recommended, not required to submit: record how the finish went (clean / concerns / problematic) for operations, separate from customer sign-off. Does not block handoff.',
      met: feedbackRecorded,
      kind: 'info',
      actionLabel: feedbackRecorded ? 'View outcome' : 'Record outcome',
      navigateTo: 'closeout_outcome',
    })

    const ov = deriveChecklistOverall(checks)

    let headline = 'Closeout still has must-fix items.'
    let subline: string | undefined =
      'Sign-off is part of readiness. When everything below is clear, finish from Job state → Submit closeout.'

    if (ov === 'ready') {
      headline = 'Ready to hand the job in.'
      subline =
        'This checklist looks clear — use Job state → Submit closeout when you are finished here.'
    } else if (ov === 'review_suggested') {
      headline = 'Almost there — quick review suggested.'
      subline =
        'No must-fix items left on this list; double-check the reminders, then submit from Job state when ready.'
    }

    return {
      overall: ov,
      headline,
      subline,
      checks,
    }
  }

  return {
    overall: 'early_stage',
    headline: 'Closeout readiness',
    subline: 'Use Overview and the tabs above as you work this order.',
    checks: [],
  }
}
