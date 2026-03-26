import { describe, it, expect } from 'vitest'
import {
  hasTechnicianCloseoutFeedback,
  complaintFlagForFeedbackEvent,
  buildTechnicianCloseoutJobUpdate,
  buildCloseoutFeedbackEventArgs,
  formStateFromJob,
} from '../fieldCloseoutFeedbackViewModel'

describe('fieldCloseoutFeedbackViewModel', () => {
  it('hasTechnicianCloseoutFeedback', () => {
    expect(hasTechnicianCloseoutFeedback({})).toBe(false)
    expect(hasTechnicianCloseoutFeedback({ technician_closeout_outcome: 'clean' })).toBe(true)
    expect(hasTechnicianCloseoutFeedback({ technician_closeout_recorded_at: '2025-01-01T00:00:00.000Z' })).toBe(
      true
    )
  })

  it('complaintFlagForFeedbackEvent', () => {
    expect(complaintFlagForFeedbackEvent('clean', false)).toBe(false)
    expect(complaintFlagForFeedbackEvent('clean', true)).toBe(true)
    expect(complaintFlagForFeedbackEvent('concerns', false)).toBe(true)
    expect(complaintFlagForFeedbackEvent('problematic', false)).toBe(true)
  })

  it('buildTechnicianCloseoutJobUpdate', () => {
    const u = buildTechnicianCloseoutJobUpdate({
      outcome: 'concerns',
      rating: 3,
      complaintFlag: true,
      complimentFlag: false,
      notes: '  hi  ',
    })
    expect(u.technician_closeout_outcome).toBe('concerns')
    expect(u.technician_closeout_rating).toBe(3)
    expect(u.technician_closeout_complaint_flag).toBe(true)
    expect(u.technician_closeout_compliment_flag).toBe(false)
    expect(u.technician_closeout_notes).toBe('hi')
    expect(u.technician_closeout_recorded_at).toBeTruthy()
  })

  it('buildCloseoutFeedbackEventArgs maps complaint from outcome or explicit', () => {
    const args = buildCloseoutFeedbackEventArgs({
      job: { id: 'j1' },
      user: null,
      form: {
        outcome: 'clean',
        rating: null,
        complaintFlag: true,
        complimentFlag: false,
        notes: '',
      },
    })
    expect(args.complaintFlag).toBe(true)
    expect(args.feedbackSource).toBe('closeout')
  })

  it('formStateFromJob', () => {
    const f = formStateFromJob({
      technician_closeout_outcome: 'problematic',
      technician_closeout_rating: 2,
      technician_closeout_complaint_flag: false,
      technician_closeout_compliment_flag: true,
      technician_closeout_notes: 'x',
    })
    expect(f.outcome).toBe('problematic')
    expect(f.rating).toBe(2)
    expect(f.complimentFlag).toBe(true)
    expect(f.notes).toBe('x')
  })
})
