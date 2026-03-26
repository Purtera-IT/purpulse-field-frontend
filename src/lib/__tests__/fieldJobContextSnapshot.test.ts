import { describe, it, expect } from 'vitest'
import {
  JOB_CONTEXT_SCHEMA_VERSION,
  buildCanonicalJobContextString,
  buildJobContextFieldPayload,
  buildRunbookStructureKey,
  computeJobContextFingerprint,
  extractJobContextFingerprintMaterial,
  normalizeJobContextLinkId,
} from '../jobContextField'

const baseJob = {
  id: 'job-1',
  status: 'in_progress',
  runbook_version: '1.0',
  evidence_requirements: [{ type: 'a' }],
  runbook_phases: [{ id: 'p1', steps: [{ id: 's1' }, { id: 's2' }] }],
  fields_schema: [{ required: true }, { required: false }],
}

describe('fieldJobContextSnapshot (Iteration 12)', () => {
  it('extractJobContextFingerprintMaterial matches schema version and omits updated_date', () => {
    const m = extractJobContextFingerprintMaterial(
      { ...baseJob, updated_date: '2025-01-01T00:00:00.000Z' },
      'tech-a'
    )
    expect(m.context_schema_version).toBe(JOB_CONTEXT_SCHEMA_VERSION)
    expect(m.tk).toBe('tech-a')
    expect(m.erc).toBe(1)
    expect(m.rsc).toBe(2)
    expect(m.rfc).toBe(1)
    expect(JSON.stringify(m)).not.toContain('updated')
  })

  it('updated_date only change does not change canonical string', () => {
    const a = buildCanonicalJobContextString(
      { ...baseJob, updated_date: '2025-01-01T00:00:00.000Z' },
      't1'
    )
    const b = buildCanonicalJobContextString(
      { ...baseJob, updated_date: '2025-06-15T12:00:00.000Z' },
      't1'
    )
    expect(a).toBe(b)
  })

  it('site_id / project_id change canonical string', () => {
    const base = buildCanonicalJobContextString(baseJob, 't1')
    const withSite = buildCanonicalJobContextString({ ...baseJob, site_id: 'site-9' }, 't1')
    const withProject = buildCanonicalJobContextString({ ...baseJob, project_id: 'proj-7' }, 't1')
    expect(withSite).not.toBe(base)
    expect(withProject).not.toBe(base)
    expect(withSite).not.toBe(withProject)
  })

  it('same logical job different object instances → same string', () => {
    const j1 = { ...baseJob }
    const j2 = { ...baseJob }
    expect(buildCanonicalJobContextString(j1, 'x')).toBe(buildCanonicalJobContextString(j2, 'x'))
  })

  it('technician key change changes canonical string', () => {
    const a = buildCanonicalJobContextString(baseJob, 'tech-1')
    const b = buildCanonicalJobContextString(baseJob, 'tech-2')
    expect(a).not.toBe(b)
  })

  it('same step count different step ids → different rb_sig and fingerprint', async () => {
    const jA = {
      ...baseJob,
      runbook_phases: [{ id: 'p1', steps: [{ id: 'a' }, { id: 'b' }] }],
    }
    const jB = {
      ...baseJob,
      runbook_phases: [{ id: 'p1', steps: [{ id: 'x' }, { id: 'y' }] }],
    }
    expect(buildRunbookStructureKey(jA.runbook_phases as unknown[])).not.toBe(
      buildRunbookStructureKey(jB.runbook_phases as unknown[])
    )
    const fa = await computeJobContextFingerprint(jA, 't')
    const fb = await computeJobContextFingerprint(jB, 't')
    expect(fa).not.toBe(fb)
  })

  it('buildRunbookStructureKey sorts tokens', () => {
    const phases = [
      { id: 'b', steps: [{ id: 's2' }] },
      { id: 'a', steps: [{ id: 's1' }] },
    ]
    const k = buildRunbookStructureKey(phases as unknown[])
    expect(k).toBe('a:s1|b:s2')
  })

  it('normalizeJobContextLinkId trims and rejects empty', () => {
    expect(normalizeJobContextLinkId('  abc  ')).toBe('abc')
    expect(normalizeJobContextLinkId('')).toBe(null)
    expect(normalizeJobContextLinkId('   ')).toBe(null)
    expect(normalizeJobContextLinkId(null)).toBe(null)
  })

  it('outbound payload includes project_id and site_id when job has them (schema allowlist)', () => {
    const p = buildJobContextFieldPayload({
      job: {
        id: 'j1',
        status: 'assigned',
        project_id: '  proj-x  ',
        site_id: 'site-y',
      },
      user: null,
      contextFingerprint: 'c'.repeat(64),
    })
    expect(p.project_id).toBe('proj-x')
    expect(p.site_id).toBe('site-y')
  })

  it('fingerprint material and payload agree on trimmed project_id', () => {
    const job = { ...baseJob, project_id: '  same  ' }
    const m = extractJobContextFingerprintMaterial(job, 't')
    const p = buildJobContextFieldPayload({
      job,
      user: null,
      contextFingerprint: 'd'.repeat(64),
    })
    expect(m.project_id).toBe('same')
    expect(p.project_id).toBe('same')
  })
})
