/**
 * Iteration 14 — human-readable audit map: canonical event families vs field-v2 surfaces.
 *
 * **NOT a runtime source of truth.** Do not import this module to drive routing, feature flags, or
 * emission logic — the app does not read these rows at runtime. Maintainers use it (plus
 * canonicalFieldEventCoverage.test.ts) to catch renames and document gaps. All real behavior lives
 * in src/lib/*Event.js, jobContextField.js, and call sites.
 *
 * The registry can list families that are only partially covered in canonical v2 (e.g. travel); do
 * not assume “listed” implies “fully emitted on FieldJobDetail.” Read each row’s `notes`.
 */

export const ITERATION_14_REQUIRED_FAMILIES = [
  'dispatch',
  'travel',
  'arrival',
  'runbook_step',
  'artifact',
  'qc',
  'closeout',
  'escalation',
  'feedback',
  'tool_check',
  'job_context',
] as const

export type Iteration14EventFamily = (typeof ITERATION_14_REQUIRED_FAMILIES)[number]

export type FamilyCoverageRow = {
  /** Primary implementation module (path from repo root). */
  emitterModule: string
  /** Exported emit/build entrypoints. */
  emitExports: string[]
  /** Canonical FieldJobDetail / fieldv2 touchpoints. */
  v2Surfaces: string[]
  notes: string
}

/**
 * One row per Iteration-14 family. Travel and arrival share travelArrivalEvent.js by design.
 */
export const CANONICAL_FIELD_EVENT_COVERAGE: Record<Iteration14EventFamily, FamilyCoverageRow> = {
  dispatch: {
    emitterModule: 'src/lib/dispatchEvent.js',
    emitExports: ['emitDispatchEventForJobStatusChange'],
    v2Surfaces: ['JobStateTransitioner', 'useJobQueue (FieldJobs timer)'],
    notes: 'emit-before-Job.update in JobStateTransitioner; closeout submit path chains after closeout_event',
  },
  travel: {
    emitterModule: 'src/lib/travelArrivalEvent.js',
    emitExports: ['buildTravelEventPayload', 'emitCanonicalEventsForTimeEntry'],
    v2Surfaces: ['FieldTimeTracker: no travel_start; TimeLog/TimerPanel legacy'],
    notes:
      'INCOMPLETE in canonical v2: FieldJobDetail / FieldTimeTracker do not emit travel_start|travel_end; legacy TimerPanel/TimeLog do. Primary follow-up = Iteration 15-style travel/arrival lifecycle on the rebuilt path.',
  },
  arrival: {
    emitterModule: 'src/lib/travelArrivalEvent.js',
    emitExports: ['buildArrivalEventPayload', 'emitCanonicalEventsForTimeEntry'],
    v2Surfaces: ['FieldTimeTracker (work_start before time entry)'],
    notes: 'Arrival/work_start queued before apiClient.createTimeEntry',
  },
  runbook_step: {
    emitterModule: 'src/lib/runbookStepEvent.js',
    emitExports: ['emitRunbookStepEvent'],
    v2Surfaces: ['RunbookSteps'],
    notes: 'emit before persistOutcome (Job.update) on complete/fail; start emits before local session only',
  },
  artifact: {
    emitterModule: 'src/lib/artifactEvent.js',
    emitExports: ['emitArtifactEventForCompletedUpload'],
    v2Surfaces: ['fieldAdapters Base44UploadAdapter.completeUpload', 'EvidenceCaptureModal'],
    notes: 'After Evidence.create by design — payload needs persisted evidence id',
  },
  qc: {
    emitterModule: 'src/lib/qcEvent.js',
    emitExports: ['emitQcEvent'],
    v2Surfaces: ['fieldAdapters Base44LabelAdapter.createLabel', 'EvidenceGalleryView labeling'],
    notes: 'After LabelRecord.create — schema needs record linkage',
  },
  closeout: {
    emitterModule: 'src/lib/closeoutEvent.js',
    emitExports: ['emitCloseoutEvent'],
    v2Surfaces: ['JobStateTransitioner (pending_closeout→submitted)', 'CloseoutPreview legacy'],
    notes:
      'Flags: closeoutSubmissionFlags.ts deriveCloseoutSubmissionFlags; closeout_event before dispatch_event before Job.update on v2 submit (Iteration 14)',
  },
  escalation: {
    emitterModule: 'src/lib/escalationEvent.js',
    emitExports: ['emitEscalationEvent'],
    v2Surfaces: ['BlockerForm (JobCommsSection)', 'PMChatView', 'TasksTab'],
    notes: 'Iteration 14: emit before Blocker.create; escalation_record_id optional until row exists',
  },
  feedback: {
    emitterModule: 'src/lib/feedbackEvent.js',
    emitExports: ['emitFeedbackEvent'],
    v2Surfaces: ['JobCloseoutOutcomePanel', 'CloseoutPreview optional block'],
    notes: 'Iteration 14: emit before Job.update for technician outcome panel',
  },
  tool_check: {
    emitterModule: 'src/lib/toolCheckEvent.js',
    emitExports: ['emitToolCheckEvent'],
    v2Surfaces: ['PreJobToolCheckModal'],
    notes: 'Emit before parent transition continues',
  },
  job_context: {
    emitterModule: 'src/lib/jobContextField.js',
    emitExports: ['emitJobContextFieldIfChanged'],
    v2Surfaces: ['FieldJobDetail useEffect'],
    notes: 'Fingerprint dedupe; not tied to single entity mutation',
  },
}
