/**
 * Pure helpers for field-v2 evidence completeness, grouping, and honest status copy.
 * Does not invent backend fields — only projects what the job + evidence already provide.
 */

export const FALLBACK_EVIDENCE_TYPES = [
  'before_photo',
  'after_photo',
  'equipment_label',
  'site_photo',
  'general',
] as const

export type EvidenceStatus = 'pending_upload' | 'uploading' | 'uploaded' | 'error' | 'replaced'

export type EvidenceLike = {
  id: string
  evidence_type?: string
  status?: EvidenceStatus | string
  file_url?: string
  runbook_step_id?: string
  upload_error?: string
  /** Backend string; normalize with `normalizeEvidenceQcStatus` in evidenceQcViewModel */
  qc_status?: string | null
}

export type EvidenceRequirementLike = {
  type: string
  label?: string
  min_count?: number
}

export type RunbookStepRef = { id: string; title: string; phaseName?: string }

/** Walk embedded job runbook phases (steps or tasks) for capture / labels. */
export function flattenRunbookSteps(job: {
  runbook_phases?: Array<{
    name?: string
    steps?: Array<{ id: string; name?: string; title?: string }>
    tasks?: Array<{ id: string; name?: string; title?: string }>
  }>
} | null | undefined): RunbookStepRef[] {
  const phases = job?.runbook_phases
  if (!Array.isArray(phases)) return []
  const out: RunbookStepRef[] = []
  for (const phase of phases) {
    const phaseName = phase?.name
    const list = phase?.steps ?? phase?.tasks ?? []
    for (const step of list) {
      if (!step?.id) continue
      const title = step.name || step.title || step.id
      out.push({ id: step.id, title, phaseName })
    }
  }
  return out
}

export function resolveRunbookStepTitle(job: Parameters<typeof flattenRunbookSteps>[0], stepId: string | null | undefined): string | null {
  if (!stepId) return null
  const hit = flattenRunbookSteps(job).find((s) => s.id === stepId)
  return hit?.title ?? stepId
}

/** Ordered evidence types: job requirements first, then fallbacks not already listed. */
export function buildEvidenceTypeOptions(job: {
  evidence_requirements?: EvidenceRequirementLike[]
} | null | undefined): { value: string; label: string }[] {
  const reqs = job?.evidence_requirements
  const fromReq: { value: string; label: string }[] = []
  const seen = new Set<string>()
  if (Array.isArray(reqs)) {
    for (const r of reqs) {
      if (!r?.type || seen.has(r.type)) continue
      seen.add(r.type)
      fromReq.push({
        value: r.type,
        label: r.label || r.type.replace(/_/g, ' '),
      })
    }
  }
  for (const t of FALLBACK_EVIDENCE_TYPES) {
    if (seen.has(t)) continue
    seen.add(t)
    fromReq.push({ value: t, label: t.replace(/_/g, ' ') })
  }
  return fromReq
}

export function getEvidenceStatusPresentation(ev: EvidenceLike): {
  label: string
  shortLabel: string
  tone: 'ok' | 'pending' | 'error' | 'muted'
} {
  const status = ev.status as EvidenceStatus | undefined
  const err = ev.upload_error?.trim()

  if (status === 'error') {
    return {
      label: err ? `Failed — ${err}` : 'Failed',
      shortLabel: 'Failed',
      tone: 'error',
    }
  }
  if (status === 'pending_upload') {
    return { label: 'Pending upload', shortLabel: 'Pending', tone: 'pending' }
  }
  if (status === 'uploading') {
    return { label: 'Uploading', shortLabel: 'Uploading', tone: 'pending' }
  }
  if (status === 'replaced') {
    return { label: 'Replaced', shortLabel: 'Replaced', tone: 'muted' }
  }
  if (status === 'uploaded') {
    const url = ev.file_url || ''
    if (url.startsWith('data:')) {
      return {
        label: 'Preview on job · sync may be pending',
        shortLabel: 'Preview',
        tone: 'pending',
      }
    }
    if (url.startsWith('mock://')) {
      return {
        label: 'Saved on job · storage sync pending',
        shortLabel: 'Pending sync',
        tone: 'pending',
      }
    }
    return { label: 'Available', shortLabel: 'Saved', tone: 'ok' }
  }
  return { label: status || 'Unknown', shortLabel: status || '—', tone: 'muted' }
}

export function getStorageNoteForFileUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null
  if (fileUrl.startsWith('data:')) {
    return 'Saved on this job as a preview. Storage sync may still be pending.'
  }
  if (fileUrl.startsWith('mock://')) {
    return 'Saved on this job. Storage sync is still pending.'
  }
  return null
}

export type RequirementPartitionRow = {
  req: EvidenceRequirementLike
  min: number
  uploaded: number
  inFlight: number
  met: boolean
  unmet: number
}

export function partitionEvidenceForRequirements(
  job: { evidence_requirements?: EvidenceRequirementLike[] } | null | undefined,
  evidence: EvidenceLike[],
): RequirementPartitionRow[] {
  const reqs = job?.evidence_requirements
  if (!Array.isArray(reqs) || reqs.length === 0) return []
  return reqs.map((req) => {
    const min = req.min_count ?? 1
    const matching = evidence.filter((e) => e.evidence_type === req.type)
    const uploaded = matching.filter((e) => e.status === 'uploaded').length
    const inFlight = matching.filter(
      (e) => e.status === 'pending_upload' || e.status === 'uploading',
    ).length
    const met = uploaded >= min
    return {
      req,
      min,
      uploaded,
      inFlight,
      met,
      unmet: Math.max(0, min - uploaded),
    }
  })
}

export type StepEvidenceGroup = {
  stepId: string
  title: string
  items: EvidenceLike[]
}

/**
 * Evidence with a runbook_step_id under that step; job-level = no id or unknown id bucketed as job-level.
 */
export function groupEvidenceByStepOrJob(
  job: Parameters<typeof flattenRunbookSteps>[0],
  evidence: EvidenceLike[],
): { stepGroups: StepEvidenceGroup[]; jobLevel: EvidenceLike[] } {
  const steps = flattenRunbookSteps(job)
  const stepGroups: StepEvidenceGroup[] = steps.map((s) => ({
    stepId: s.id,
    title: s.title,
    items: [],
  }))
  const indexByStepId = new Map(stepGroups.map((g, i) => [g.stepId, i]))
  const jobLevel: EvidenceLike[] = []

  for (const ev of evidence) {
    const sid = ev.runbook_step_id
    if (!sid) {
      jobLevel.push(ev)
      continue
    }
    const idx = indexByStepId.get(sid)
    if (idx === undefined) {
      jobLevel.push(ev)
      continue
    }
    stepGroups[idx].items.push(ev)
  }

  return {
    stepGroups: stepGroups.filter((g) => g.items.length > 0),
    jobLevel,
  }
}

/** Assign each evidence item to at most one requirement (first matching type in requirement order). */
export function assignEvidenceToRequirements(
  job: { evidence_requirements?: EvidenceRequirementLike[] } | null | undefined,
  evidence: EvidenceLike[],
): { rows: { req: EvidenceRequirementLike; items: EvidenceLike[] }[]; other: EvidenceLike[] } {
  const reqs = job?.evidence_requirements
  if (!Array.isArray(reqs) || reqs.length === 0) {
    return { rows: [], other: [...evidence] }
  }
  const used = new Set<string>()
  const rows = reqs.map((req) => {
    const items: EvidenceLike[] = []
    for (const e of evidence) {
      if (used.has(e.id)) continue
      if (e.evidence_type === req.type) {
        items.push(e)
        used.add(e.id)
      }
    }
    return { req, items }
  })
  const other = evidence.filter((e) => !used.has(e.id))
  return { rows, other }
}
