import { describe, it, expect } from 'vitest'
import { buildCloseoutReadinessSummary, deriveChecklistOverall } from '../closeoutReadinessViewModel'

const jobBase = {
  runbook_phases: [] as { id: string; order: number; steps?: { id: string; completed?: boolean }[] }[],
  evidence_requirements: [] as { type: string; label?: string; min_count?: number }[],
  signoff_signature_url: null as string | null,
}

describe('closeoutReadinessViewModel', () => {
  it('assigned is early_stage with no checklist rows', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'assigned' },
      evidence: [],
      runbookComplete: false,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r.overall).toBe('early_stage')
    expect(r.checks).toHaveLength(0)
  })

  it('paused surfaces resume as blocking', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'paused' },
      evidence: [],
      runbookComplete: false,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r.overall).toBe('paused_work')
    expect(r.checks.some((c) => c.id === 'state_paused' && !c.met)).toBe(true)
  })

  it('in_progress includes transition blockers when runbook and photos missing', () => {
    const r = buildCloseoutReadinessSummary({
      job: {
        ...jobBase,
        status: 'in_progress',
        runbook_phases: [{ id: 'p1', order: 0, steps: [{ id: 's1', completed: false }] }],
      },
      evidence: [],
      runbookComplete: false,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r.checks.some((c) => c.id === 'gate_photos' && !c.met)).toBe(true)
    expect(r.checks.some((c) => c.id === 'gate_runbook' && !c.met)).toBe(true)
    expect(r.overall).toBe('blocked')
  })

  it('deriveChecklistOverall distinguishes blocked vs review_suggested', () => {
    expect(
      deriveChecklistOverall([
        { id: 'a', label: '', detail: '', met: false, kind: 'blocking' },
      ])
    ).toBe('blocked')
    expect(
      deriveChecklistOverall([
        { id: 'a', label: '', detail: '', met: true, kind: 'blocking' },
        { id: 'b', label: '', detail: '', met: false, kind: 'attention' },
      ])
    ).toBe('review_suggested')
    expect(deriveChecklistOverall([{ id: 'a', label: '', detail: '', met: true, kind: 'blocking' }])).toBe('ready')
  })

  it('in_progress when gates met and no timer/escalations is ready', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'in_progress' },
      evidence: [{ id: '1', evidence_type: 'before_photo', status: 'uploaded' }, { id: '2', evidence_type: 'after_photo', status: 'uploaded' }],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r.overall).toBe('ready')
    expect(r.checks.every((c) => c.kind !== 'blocking' || c.met)).toBe(true)
  })

  it('job evidence_requirements add blocking rows in in_progress', () => {
    const r = buildCloseoutReadinessSummary({
      job: {
        ...jobBase,
        status: 'in_progress',
        evidence_requirements: [{ type: 'site_photo', label: 'Site', min_count: 1 }],
      },
      evidence: [
        { id: '1', evidence_type: 'before_photo', status: 'uploaded' },
        { id: '2', evidence_type: 'after_photo', status: 'uploaded' },
      ],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    const row = r.checks.find((c) => c.id === 'job_req_site_photo')
    expect(row).toBeDefined()
    expect(row?.met).toBe(false)
  })

  it('pending_closeout requires signoff until signature url set', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'pending_closeout' },
      evidence: [],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    const sign = r.checks.find((c) => c.id === 'signoff')
    expect(sign?.met).toBe(false)
    expect(r.overall).toBe('blocked')
  })

  it('pending_closeout adds info row for technician finish outcome', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'pending_closeout' },
      evidence: [],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    const row = r.checks.find((c) => c.id === 'technician_closeout_feedback')
    expect(row?.kind).toBe('info')
    expect(row?.navigateTo).toBe('closeout_outcome')
    expect(row?.met).toBe(false)
    const r2 = buildCloseoutReadinessSummary({
      job: {
        ...jobBase,
        status: 'pending_closeout',
        technician_closeout_outcome: 'clean',
      },
      evidence: [],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r2.checks.find((c) => c.id === 'technician_closeout_feedback')?.met).toBe(true)
  })

  it('in_progress adds QC attention when uploaded evidence has qc fail', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'in_progress' },
      evidence: [
        { id: '1', evidence_type: 'before_photo', status: 'uploaded', qc_status: 'fail' },
        { id: '2', evidence_type: 'after_photo', status: 'uploaded', qc_status: 'pass' },
      ],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r.checks.some((c) => c.id === 'qc_evidence_failed')).toBe(true)
    expect(r.overall).toBe('review_suggested')
  })

  it('open blockers add attention row', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'in_progress' },
      evidence: [
        { id: '1', evidence_type: 'before_photo', status: 'uploaded' },
        { id: '2', evidence_type: 'after_photo', status: 'uploaded' },
      ],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [{ status: 'open' }],
    })
    expect(r.checks.some((c) => c.id === 'open_escalations')).toBe(true)
    expect(r.overall).toBe('review_suggested')
  })

  it('submitted is submitted_phase', () => {
    const r = buildCloseoutReadinessSummary({
      job: { ...jobBase, status: 'submitted' },
      evidence: [],
      runbookComplete: true,
      workSegmentOpen: false,
      blockers: [],
    })
    expect(r.overall).toBe('submitted_phase')
  })
})
