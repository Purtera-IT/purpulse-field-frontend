/**
 * Field evidence QC — normalize `qc_status` strings and roll up pass / fail / not reviewed for canonical UI.
 * Does not invent review workflow; only maps existing string shapes (pass, fail, approved, etc.).
 */
import type { EvidenceLike } from './fieldEvidenceViewModel'

export type NormalizedEvidenceQc = 'pass' | 'fail' | 'pending'

/**
 * Map API/admin variants onto three operational buckets only.
 * Extend when the backend adds explicit review states — do not infer richer workflow here.
 */
export function normalizeEvidenceQcStatus(qcStatus: string | null | undefined): NormalizedEvidenceQc {
  const s = String(qcStatus ?? '')
    .toLowerCase()
    .trim()
  if (['pass', 'passed', 'approved', 'qc_pass'].includes(s)) return 'pass'
  if (['fail', 'failed', 'rejected', 'qc_fail'].includes(s)) return 'fail'
  return 'pending'
}

export interface EvidenceQcRollup {
  /** `status === 'uploaded'` only — same pool as “saved on job” for QC story */
  uploadedCount: number
  passCount: number
  failCount: number
  pendingCount: number
}

export function rollupUploadedEvidenceQc(evidence: EvidenceLike[]): EvidenceQcRollup {
  let uploadedCount = 0
  let passCount = 0
  let failCount = 0
  let pendingCount = 0
  for (const ev of evidence) {
    if (ev.status !== 'uploaded') continue
    uploadedCount++
    const q = normalizeEvidenceQcStatus(ev.qc_status)
    if (q === 'pass') passCount++
    else if (q === 'fail') failCount++
    else pendingCount++
  }
  return { uploadedCount, passCount, failCount, pendingCount }
}

export function getEvidenceQcPresentation(ev: EvidenceLike): {
  verdict: NormalizedEvidenceQc
  dotClass: string
  shortLabel: string
  /** Compact label for thumbnails */
  pillLabel: string
  detailLine: string
} {
  const verdict = normalizeEvidenceQcStatus(ev.qc_status)
  const map = {
    pass: {
      dotClass: 'bg-emerald-500',
      shortLabel: 'QC pass',
      pillLabel: 'PASS',
      detailLine: 'Review outcome: acceptable for QC. The file stays on the job as-is.',
    },
    fail: {
      dotClass: 'bg-red-500',
      shortLabel: 'QC fail',
      pillLabel: 'FAIL',
      detailLine:
        'Review outcome: not acceptable. Add replacement evidence if you need a retake — this record stays for traceability.',
    },
    pending: {
      dotClass: 'bg-slate-400',
      shortLabel: 'QC pending',
      pillLabel: 'REVIEW',
      detailLine:
        'No QC decision on this file yet — review pending. Saved on the job is not the same as passed QC.',
    },
  } as const
  return { verdict, ...map[verdict] }
}
