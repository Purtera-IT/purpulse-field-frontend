/**
 * Shared booleans for closeout_event payloads (Iteration 14).
 * Mirrors legacy CloseoutPreview checks so FieldJobDetail submit and CloseoutPreview stay aligned.
 */

/** Minimal evidence shape for documentation completeness. */
export type EvidenceForCloseoutFlags = {
  evidence_type?: string
  status?: string
}

export interface CloseoutSubmissionFlags {
  documentationComplete: boolean
  customerSignatureCaptured: boolean
  runbookComplete: boolean
  requiredFieldsComplete: boolean
}

/**
 * Derive closeout_event boolean flags from job + evidence (uploaded docs only).
 * - documentation: every evidence_requirements row met by uploaded evidence of matching type
 * - customer signature: both signer name and signature URL present
 * - runbook: all steps completed, or no steps
 * - required fields: every required fields_schema entry has non-empty value
 */
export function deriveCloseoutSubmissionFlags(
  job: Record<string, unknown> | null | undefined,
  evidence: EvidenceForCloseoutFlags[]
): CloseoutSubmissionFlags {
  const requirements = Array.isArray(job?.evidence_requirements)
    ? (job!.evidence_requirements as Array<{ type?: string; min_count?: number; label?: string }>)
    : []
  const fields = Array.isArray(job?.fields_schema)
    ? (job!.fields_schema as Array<{ required?: boolean; value?: string; label?: string; key?: string }>)
    : []
  const phases = Array.isArray(job?.runbook_phases)
    ? (job!.runbook_phases as Array<{ steps?: Array<{ completed?: boolean }> }>)
    : []

  const evidenceChecks = requirements.map((req) => {
    const min = req.min_count ?? 1
    const matching = evidence.filter(
      (e) => e.evidence_type === req.type && e.status === 'uploaded'
    )
    return matching.length >= min
  })
  const documentationComplete =
    requirements.length === 0 ? true : evidenceChecks.every(Boolean)

  const fieldChecks = fields
    .filter((f) => f.required)
    .map((f) => !!f.value && String(f.value).trim() !== '')
  const requiredFieldsComplete = fieldChecks.length === 0 ? true : fieldChecks.every(Boolean)

  const allSteps = phases.flatMap((p) => p.steps || [])
  const completedSteps = allSteps.filter((s) => s.completed).length
  const runbookComplete = allSteps.length === 0 || completedSteps === allSteps.length

  const customerSignatureCaptured =
    !!job?.signoff_signer_name &&
    typeof job.signoff_signer_name === 'string' &&
    !!job?.signoff_signature_url &&
    typeof job.signoff_signature_url === 'string'

  return {
    documentationComplete,
    customerSignatureCaptured,
    runbookComplete,
    requiredFieldsComplete,
  }
}
