import { describe, it, expect } from 'vitest'
import {
  normalizeEvidenceQcStatus,
  rollupUploadedEvidenceQc,
  getEvidenceQcPresentation,
} from '../evidenceQcViewModel'

describe('evidenceQcViewModel', () => {
  it('normalizeEvidenceQcStatus maps common variants', () => {
    expect(normalizeEvidenceQcStatus('pass')).toBe('pass')
    expect(normalizeEvidenceQcStatus('passed')).toBe('pass')
    expect(normalizeEvidenceQcStatus('approved')).toBe('pass')
    expect(normalizeEvidenceQcStatus('fail')).toBe('fail')
    expect(normalizeEvidenceQcStatus('failed')).toBe('fail')
    expect(normalizeEvidenceQcStatus('rejected')).toBe('fail')
    expect(normalizeEvidenceQcStatus(undefined)).toBe('pending')
    expect(normalizeEvidenceQcStatus('')).toBe('pending')
  })

  it('rollupUploadedEvidenceQc only counts uploaded', () => {
    const r = rollupUploadedEvidenceQc([
      { id: '1', status: 'uploaded', qc_status: 'pass' },
      { id: '2', status: 'uploaded', qc_status: 'fail' },
      { id: '3', status: 'pending_upload', qc_status: 'pass' },
      { id: '4', status: 'uploaded' },
    ])
    expect(r.uploadedCount).toBe(3)
    expect(r.passCount).toBe(1)
    expect(r.failCount).toBe(1)
    expect(r.pendingCount).toBe(1)
  })

  it('getEvidenceQcPresentation', () => {
    const p = getEvidenceQcPresentation({ id: '1', status: 'uploaded', qc_status: 'fail' })
    expect(p.verdict).toBe('fail')
    expect(p.shortLabel).toContain('fail')
    expect(p.pillLabel).toBe('FAIL')
    const pend = getEvidenceQcPresentation({ id: '2', status: 'uploaded' })
    expect(pend.verdict).toBe('pending')
    expect(pend.pillLabel).toBe('REVIEW')
  })
})
