/**
 * Operator-facing sync / outbox vocabulary for the canonical field job surface (Iteration 13).
 *
 * Three different mechanisms (do not conflate):
 * - Dexie `queuedEdits` — durable local queue for entity mutations until API sync (OfflineEditsIndicator).
 * - In-memory `UploadQueueManager` (uploadQueue.ts) — resumable file chunks for evidence upload UI
 *   (UploadProgressIndicator). Separate from Dexie `db.uploadQueue` rows used inside jobRepository.
 * - IndexedDB `purpulse_telemetry_queue` — canonical telemetry envelopes until ingestion accepts them.
 */

/** Subtitle for queued-offline-edit surfaces */
export const SYNC_QUEUED_EDITS_SUBTITLE =
  'Saved on this device until sync completes — not the same as saved on the server yet.'

/** Evidence requirement row: in-flight files not fully on server / not yet synced */
export const EVIDENCE_IN_FLIGHT_PHRASE = 'not finished yet (upload or sync)'

const TELEMETRY_EVENT_PENDING_ONE = '1 activity update waiting to send'
const TELEMETRY_EVENT_PENDING_MANY = (n: number) => `${n} activity updates waiting to send`

/** UI label for a queued edit row (Dexie queuedEdits.status). */
export function labelQueuedEditStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'Waiting to sync'
    case 'in_progress':
      return 'Sending…'
    case 'failed':
      return 'Needs attention'
    default:
      return status
  }
}

/**
 * UI label for an in-memory upload session (UploadQueueManager).
 * `completed` means the chunk session finished in the client pipeline — not “evidence fully processed / QC / server accepted” end-to-end unless the rest of the product guarantees that separately.
 */
export function labelUploadSessionStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'Waiting to sync'
    case 'uploading':
      return 'Sending…'
    case 'paused':
      return 'Paused'
    case 'failed':
      return 'Needs attention'
    case 'completed':
      return 'Upload finished'
    default:
      return status
  }
}

export type QueuedEditLike = { status: string }
export type UploadSessionLike = { status: string }

export interface JobSyncSurfaceSummary {
  isOnline: boolean
  waitingEdits: number
  sendingEdits: number
  failedEdits: number
  waitingUploads: number
  sendingUploads: number
  failedUploads: number
  completedUploads: number
  telemetryPending: number
  hasBlockingAttention: boolean
  /** True when strip should show a headline (edits, uploads, telemetry backlog, or offline with local work). */
  showSyncStrip: boolean
  /** One-line operator summary; null when nothing to say. */
  summarySentence: string | null
}

/**
 * Aggregate counts for the job-level sync strip. Upload `completed` = manager finished sending chunks
 * for that session (honest for transfer); does not claim evidence record / QC / downstream ingestion completeness.
 */
export function summarizeJobSyncSurface(input: {
  isOnline: boolean
  edits: QueuedEditLike[]
  uploads: UploadSessionLike[]
  telemetryDepthForJob: number
}): JobSyncSurfaceSummary {
  const { isOnline, edits, uploads, telemetryDepthForJob } = input

  let waitingEdits = 0
  let sendingEdits = 0
  let failedEdits = 0
  for (const e of edits) {
    if (e.status === 'pending') waitingEdits += 1
    else if (e.status === 'in_progress') sendingEdits += 1
    else if (e.status === 'failed') failedEdits += 1
  }

  let waitingUploads = 0
  let sendingUploads = 0
  let failedUploads = 0
  let completedUploads = 0
  for (const u of uploads) {
    if (u.status === 'pending' || u.status === 'paused') waitingUploads += 1
    else if (u.status === 'uploading') sendingUploads += 1
    else if (u.status === 'failed') failedUploads += 1
    else if (u.status === 'completed') completedUploads += 1
  }

  const hasBlockingAttention = failedEdits > 0 || failedUploads > 0
  const hasOpenUploadWork = uploads.some((u) => u.status !== 'completed')
  const showSyncStrip =
    edits.length > 0 ||
    uploads.length > 0 ||
    telemetryDepthForJob > 0 ||
    (!isOnline && (edits.length > 0 || hasOpenUploadWork || telemetryDepthForJob > 0))

  const parts: string[] = []
  if (!isOnline && (edits.length > 0 || hasOpenUploadWork || telemetryDepthForJob > 0)) {
    parts.push('Offline — changes stay on this device until connection returns')
  }

  if (waitingEdits > 0) {
    parts.push(
      waitingEdits === 1 ? '1 job change waiting to sync' : `${waitingEdits} job changes waiting to sync`
    )
  }
  if (sendingEdits > 0) {
    parts.push(sendingEdits === 1 ? '1 job change sending' : `${sendingEdits} job changes sending`)
  }
  if (failedEdits > 0) {
    parts.push(
      failedEdits === 1 ? '1 job change needs attention' : `${failedEdits} job changes need attention`
    )
  }

  if (waitingUploads > 0) {
    parts.push(
      waitingUploads === 1
        ? '1 file waiting to upload'
        : `${waitingUploads} files waiting to upload`
    )
  }
  if (sendingUploads > 0) {
    parts.push(sendingUploads === 1 ? '1 file sending' : `${sendingUploads} files sending`)
  }
  if (failedUploads > 0) {
    parts.push(
      failedUploads === 1 ? '1 upload needs attention' : `${failedUploads} uploads need attention`
    )
  }

  if (telemetryDepthForJob > 0) {
    parts.push(
      telemetryDepthForJob === 1
        ? TELEMETRY_EVENT_PENDING_ONE
        : TELEMETRY_EVENT_PENDING_MANY(telemetryDepthForJob)
    )
  }

  const summarySentence = parts.length > 0 ? parts.join(' · ') : null

  return {
    isOnline,
    waitingEdits,
    sendingEdits,
    failedEdits,
    waitingUploads,
    sendingUploads,
    failedUploads,
    completedUploads,
    telemetryPending: telemetryDepthForJob,
    hasBlockingAttention,
    showSyncStrip,
    summarySentence,
  }
}
