import { describe, it, expect } from 'vitest';
import { deriveCloseoutSubmissionFlags } from '@/lib/closeoutSubmissionFlags';

describe('deriveCloseoutSubmissionFlags', () => {
  it('returns all true when job has no requirements, no required fields, no runbook steps, and signoff', () => {
    const job = {
      evidence_requirements: [],
      fields_schema: [],
      runbook_phases: [],
      signoff_signer_name: 'A',
      signoff_signature_url: 'https://x',
    };
    const f = deriveCloseoutSubmissionFlags(job, []);
    expect(f).toEqual({
      documentationComplete: true,
      customerSignatureCaptured: true,
      runbookComplete: true,
      requiredFieldsComplete: true,
    });
  });

  it('documentation false when requirement not met', () => {
    const job = {
      evidence_requirements: [{ type: 'photo', min_count: 1 }],
      fields_schema: [],
      runbook_phases: [],
      signoff_signer_name: 'A',
      signoff_signature_url: 'u',
    };
    expect(deriveCloseoutSubmissionFlags(job, []).documentationComplete).toBe(false);
    expect(
      deriveCloseoutSubmissionFlags(job, [{ evidence_type: 'photo', status: 'uploaded' }])
        .documentationComplete
    ).toBe(true);
  });

  it('required fields false when required field empty', () => {
    const job = {
      evidence_requirements: [],
      fields_schema: [{ required: true, key: 'k', value: '' }],
      runbook_phases: [],
      signoff_signer_name: 'A',
      signoff_signature_url: 'u',
    };
    expect(deriveCloseoutSubmissionFlags(job, []).requiredFieldsComplete).toBe(false);
    expect(
      deriveCloseoutSubmissionFlags(
        {
          ...job,
          fields_schema: [{ required: true, key: 'k', value: 'x' }],
        },
        []
      ).requiredFieldsComplete
    ).toBe(true);
  });

  it('runbook false when a step incomplete', () => {
    const job = {
      evidence_requirements: [],
      fields_schema: [],
      runbook_phases: [{ steps: [{ completed: false }] }],
      signoff_signer_name: 'A',
      signoff_signature_url: 'u',
    };
    expect(deriveCloseoutSubmissionFlags(job, []).runbookComplete).toBe(false);
    expect(
      deriveCloseoutSubmissionFlags(
        {
          ...job,
          runbook_phases: [{ steps: [{ completed: true }] }],
        },
        []
      ).runbookComplete
    ).toBe(true);
  });

  it('customerSignatureCaptured false without both name and url', () => {
    const base = {
      evidence_requirements: [],
      fields_schema: [],
      runbook_phases: [],
    };
    expect(deriveCloseoutSubmissionFlags({ ...base, signoff_signer_name: 'A' }, []).customerSignatureCaptured).toBe(
      false
    );
    expect(
      deriveCloseoutSubmissionFlags(
        { ...base, signoff_signer_name: 'A', signoff_signature_url: 'u' },
        []
      ).customerSignatureCaptured
    ).toBe(true);
  });

  it('updated_date on job does not affect flags', () => {
    const job = {
      evidence_requirements: [],
      fields_schema: [],
      runbook_phases: [],
      signoff_signer_name: 'A',
      signoff_signature_url: 'u',
      updated_date: '2099-01-01',
    };
    const a = deriveCloseoutSubmissionFlags(job, []);
    const b = deriveCloseoutSubmissionFlags({ ...job, updated_date: '2099-01-02' }, []);
    expect(a).toEqual(b);
  });
});
