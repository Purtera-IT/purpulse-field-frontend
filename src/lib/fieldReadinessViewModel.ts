/**
 * Coarse readiness summary for canonical FieldJobDetail Overview.
 * Derived only from job.status + whether any work_start TimeEntry exists — no fake persisted flags.
 */
import type { Job } from '@/api/types'

export type ReadinessPhaseState = 'complete' | 'current' | 'upcoming'

export interface ReadinessPhaseRow {
  id: 'route' | 'start_work' | 'work_timer'
  title: string
  detail: string
  state: ReadinessPhaseState
}

export interface FieldReadinessSummary {
  headline: string
  disclaimer: string
  phases: ReadinessPhaseRow[]
}

/**
 * Short next-step lines for the job header — same operator tone as Overview readiness (avoid copy drift).
 * Does not replace status-specific logic in `getNextStepMessage` for in_progress and later.
 */
/** Same strings for Overview headline and `getNextStepMessage` where both apply — one story on the page. */
export const READINESS_SHORT_LINES = {
  assigned:
    'Review site details before heading out. Going en route will ask you to confirm travel.',
  en_route:
    'Travel to site, check in when you arrive, then start work when ready (short checklist first).',
  checked_in:
    'Start work when ready — a short pre-start checklist runs first. Then open Runbook and use the timer when you bill.',
  paused:
    'Resume in job state when ready — the pre-start checklist does not run again. Start the timer when you bill time.',
} as const

function routePhaseComplete(status: Job['status']): boolean {
  return status !== 'assigned'
}

function startWorkPhaseComplete(status: Job['status']): boolean {
  return (
    status === 'in_progress' ||
    status === 'paused' ||
    status === 'pending_closeout' ||
    status === 'submitted' ||
    status === 'approved' ||
    status === 'rejected'
  )
}

function timerPhaseComplete(hasWorkStartTimeEntry: boolean): boolean {
  return hasWorkStartTimeEntry
}

function assignPhaseStates(
  routeDone: boolean,
  startDone: boolean,
  timerDone: boolean
): { route: ReadinessPhaseState; start_work: ReadinessPhaseState; work_timer: ReadinessPhaseState } {
  const phases = [
    { id: 'route' as const, done: routeDone },
    { id: 'start_work' as const, done: startDone },
    { id: 'work_timer' as const, done: timerDone },
  ]
  let seenCurrent = false
  const out: Record<string, ReadinessPhaseState> = {}
  for (const p of phases) {
    if (p.done) {
      out[p.id] = 'complete'
    } else if (!seenCurrent) {
      out[p.id] = 'current'
      seenCurrent = true
    } else {
      out[p.id] = 'upcoming'
    }
  }
  return {
    route: out.route,
    start_work: out.start_work,
    work_timer: out.work_timer,
  }
}

function headlineForStatus(job: Job, hasWorkStartTimeEntry: boolean): string {
  const s = job.status
  if (s === 'assigned') {
    return READINESS_SHORT_LINES.assigned
  }
  if (s === 'en_route') {
    return READINESS_SHORT_LINES.en_route
  }
  if (s === 'checked_in') {
    return READINESS_SHORT_LINES.checked_in
  }
  if (s === 'paused') {
    return READINESS_SHORT_LINES.paused
  }
  if (s === 'in_progress' && !hasWorkStartTimeEntry) {
    return 'Start the work timer when you begin billable work — a short site readiness check appears first.'
  }
  if (s === 'in_progress') {
    return 'Work in progress. Keep runbook and evidence up to date.'
  }
  if (s === 'pending_closeout' || s === 'submitted' || s === 'approved' || s === 'rejected') {
    return 'Readiness steps for starting work are behind you for this job.'
  }
  return 'Follow job state and timer as you work this order.'
}

const DISCLAIMER =
  'From job status and time entries in this app — not a stored readiness record on the server.'

export function buildFieldReadinessSummary(
  job: Job,
  options: { hasWorkStartTimeEntry: boolean }
): FieldReadinessSummary {
  const { hasWorkStartTimeEntry } = options
  const routeDone = routePhaseComplete(job.status)
  const startDone = startWorkPhaseComplete(job.status)
  const timerDone = timerPhaseComplete(hasWorkStartTimeEntry)
  const states = assignPhaseStates(routeDone, startDone, timerDone)

  const routeDetail = (() => {
    if (states.route === 'complete') {
      return 'Workflow past assigned (travel step used in this app — not a separate server “ETA record”).'
    }
    if (states.route === 'current') {
      return 'Next: Job state → Start route; travel confirmation runs in the sheet.'
    }
    return 'Upcoming: confirm travel when you start route.'
  })()

  const startDetail = (() => {
    if (job.status === 'paused' && states.start_work === 'complete') {
      return 'Pre-start checklist already done; resume does not repeat it — use Resume in job state.'
    }
    if (states.start_work === 'complete') {
      return 'Workflow past pre-start checklist (first move to in progress in this app).'
    }
    if (states.start_work === 'current') {
      return 'Next: Job state → Start work; short checklist before in progress.'
    }
    return 'Upcoming: runs when you go to in progress from checked in.'
  })()

  const timerDetail = (() => {
    if (states.work_timer === 'complete') {
      return 'At least one timer segment started here; scope sheet still runs each time you start the timer.'
    }
    if (states.work_timer === 'current') {
      return 'Next: Start timer → short site check, then time logs.'
    }
    return 'Upcoming: start timer when you bill work.'
  })()

  return {
    headline: headlineForStatus(job, hasWorkStartTimeEntry),
    disclaimer: DISCLAIMER,
    phases: [
      { id: 'route', title: 'Route', detail: routeDetail, state: states.route },
      { id: 'start_work', title: 'Start work', detail: startDetail, state: states.start_work },
      { id: 'work_timer', title: 'Work timer', detail: timerDetail, state: states.work_timer },
    ],
  }
}
