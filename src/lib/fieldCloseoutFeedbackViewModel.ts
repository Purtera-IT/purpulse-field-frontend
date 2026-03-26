/**
 * Technician closeout outcome — job persistence slice + mapping to feedback_event (feedback_source: closeout).
 * Outcome triad is the primary signal; complaint checkbox is an explicit add-on for customer/issue reporting.
 */
import type { Job } from '@/api/client'

export type TechnicianCloseoutOutcome = 'clean' | 'concerns' | 'problematic'

export type TechnicianCloseoutFeedbackForm = {
  outcome: TechnicianCloseoutOutcome | null
  rating: number | null
  complaintFlag: boolean
  complimentFlag: boolean
  notes: string
}

const NOTES_MAX = 2000

/** True when a technician outcome has been saved on the job. */
export function hasTechnicianCloseoutFeedback(
  job: Pick<Job, 'technician_closeout_outcome' | 'technician_closeout_recorded_at'>
): boolean {
  const o = job.technician_closeout_outcome
  if (o === 'clean' || o === 'concerns' || o === 'problematic') return true
  return !!job.technician_closeout_recorded_at
}

/**
 * For feedback_event: complaint if finish was not fully clean OR technician explicitly flags a customer concern.
 * Outcome is overall finish quality; explicit checkbox is a narrower “issue reported” signal — both may apply.
 */
export function complaintFlagForFeedbackEvent(
  outcome: TechnicianCloseoutOutcome,
  explicitComplaint: boolean
): boolean {
  return outcome === 'concerns' || outcome === 'problematic' || explicitComplaint
}

/** Payload for base44.entities.Job.update — call only when form.outcome is set. */
export function buildTechnicianCloseoutJobUpdate(
  form: TechnicianCloseoutFeedbackForm,
  opts?: { recordedAtIso?: string }
): Record<string, unknown> {
  if (!form.outcome) {
    throw new Error('technician_closeout_outcome required')
  }
  const notes = form.notes.trim()
  const clipped = notes.length > NOTES_MAX ? `${notes.slice(0, NOTES_MAX - 3)}...` : notes
  const rating =
    form.rating != null && form.rating >= 1 && form.rating <= 5 ? Math.round(form.rating) : null
  const recordedAt = opts?.recordedAtIso ?? new Date().toISOString()

  return {
    technician_closeout_outcome: form.outcome,
    technician_closeout_rating: rating,
    technician_closeout_complaint_flag: form.complaintFlag,
    technician_closeout_compliment_flag: form.complimentFlag,
    technician_closeout_notes: clipped || null,
    technician_closeout_recorded_at: recordedAt,
  }
}

/**
 * Arguments for emitFeedbackEvent. Intended call order (Iteration 14): emit first, then Job.update
 * with the same recordedAtIso — see saveTechnicianCloseoutOutcomeWithTelemetry.
 */
export function buildCloseoutFeedbackEventArgs(input: {
  job: Record<string, unknown>
  user: unknown
  form: TechnicianCloseoutFeedbackForm
}): {
  job: Record<string, unknown>
  user: unknown
  ratingValue: number | null
  complaintFlag: boolean
  complimentFlag: boolean
  feedbackNotes: string | null
  feedbackSource: 'closeout'
} {
  const { job, user, form } = input
  if (!form.outcome) {
    throw new Error('outcome required for feedback event')
  }
  const ratingValue =
    form.rating != null && form.rating >= 1 && form.rating <= 5 ? Math.round(form.rating) : null
  const notes = form.notes.trim()
  const feedbackNotes = notes.length > 2000 ? `${notes.slice(0, 1997)}...` : notes || null

  return {
    job,
    user,
    ratingValue,
    complaintFlag: complaintFlagForFeedbackEvent(form.outcome, form.complaintFlag),
    complimentFlag: form.complimentFlag,
    feedbackNotes,
    feedbackSource: 'closeout',
  }
}

export function outcomeLabel(outcome: TechnicianCloseoutOutcome): string {
  switch (outcome) {
    case 'clean':
      return 'Clean finish'
    case 'concerns':
      return 'Finished with concerns'
    case 'problematic':
      return 'Problematic finish'
    default:
      return outcome
  }
}

/** Hydrate form from job row (pending_closeout re-edit). */
export function formStateFromJob(
  job: Pick<
    Job,
    | 'technician_closeout_outcome'
    | 'technician_closeout_rating'
    | 'technician_closeout_complaint_flag'
    | 'technician_closeout_compliment_flag'
    | 'technician_closeout_notes'
  >
): TechnicianCloseoutFeedbackForm {
  const o = job.technician_closeout_outcome
  const outcome =
    o === 'clean' || o === 'concerns' || o === 'problematic' ? o : null
  const r = job.technician_closeout_rating
  const rating = typeof r === 'number' && r >= 1 && r <= 5 ? r : null
  return {
    outcome,
    rating,
    complaintFlag: job.technician_closeout_complaint_flag === true,
    complimentFlag: job.technician_closeout_compliment_flag === true,
    notes: typeof job.technician_closeout_notes === 'string' ? job.technician_closeout_notes : '',
  }
}
