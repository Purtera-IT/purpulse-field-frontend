import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAllowedTransitions,
  STATE_MACHINE,
  JobStatus,
  UserRole,
} from '../jobStateMachine';

describe('Job State Machine', () => {
  describe('canTransition', () => {
    it('should allow technician to start work without evidence', () => {
      const gate = canTransition('checked_in', 'in_progress', 'technician', [], false, false);
      expect(gate.isAllowed).toBe(true);
      expect(gate.canOverride).toBe(false);
    });

    it('should deny technician job completion without required evidence', () => {
      const evidence = []; // No photos
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, false, false);
      
      expect(gate.isAllowed).toBe(false);
      expect(gate.blockers.length).toBeGreaterThan(0);
      expect(gate.blockers.some(b => !b.isMet)).toBe(true);
      expect(gate.canOverride).toBe(false);
    });

    it('should allow completion with required evidence (2+ photos)', () => {
      const evidence = [
        { evidence_type: 'before_photo' },
        { evidence_type: 'after_photo' },
      ];
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, true, true);
      
      expect(gate.isAllowed).toBe(true);
      expect(gate.blockers.every(b => b.isMet)).toBe(true);
    });

    it('should allow admin to override missing evidence', () => {
      const evidence = []; // No evidence
      const gate = canTransition('in_progress', 'pending_closeout', 'admin', evidence, false, false);
      
      expect(gate.isAllowed).toBe(false);
      expect(gate.canOverride).toBe(true);
      expect(gate.overrideReason).toContain('admin override');
    });

    it('should deny technician transition to unapproved states', () => {
      const gate = canTransition('submitted', 'approved', 'technician', [], false, false);
      
      expect(gate.isAllowed).toBe(false);
      expect(gate.canOverride).toBe(false);
    });

    it('should allow dispatcher to approve submitted jobs', () => {
      const gate = canTransition('submitted', 'approved', 'dispatcher', [], false, false);
      
      expect(gate.isAllowed).toBe(true);
    });

    it('should handle invalid transitions gracefully', () => {
      const gate = canTransition('approved', 'in_progress', 'technician', [], false, false);
      
      expect(gate.isAllowed).toBe(false);
      expect(gate.overrideReason).toBe('Invalid transition');
    });

    it('should count photos correctly for requirement gating', () => {
      const evidence = [
        { evidence_type: 'before_photo' },
        { evidence_type: 'after_photo' },
        { evidence_type: 'photo_damage' },
      ];
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, true, true);
      
      const photoReq = gate.blockers.find(b => b.type === 'photo_count');
      expect(photoReq?.current).toBe(3);
      expect(photoReq?.isMet).toBe(true);
    });

    it('should require checklist completion for job closeout', () => {
      const evidence = [
        { evidence_type: 'before_photo' },
        { evidence_type: 'after_photo' },
      ];
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, false, true);
      
      const checklistReq = gate.blockers.find(b => b.type === 'checklist_complete');
      expect(checklistReq?.isMet).toBe(false);
      expect(gate.isAllowed).toBe(false);
    });

    it('should require signature for submission', () => {
      const gate = canTransition('pending_closeout', 'submitted', 'technician', [], false, false);
      
      const signatureReq = gate.blockers.find(b => b.type === 'signature');
      expect(signatureReq?.isMet).toBe(false);
      expect(gate.isAllowed).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return only transitions allowed for technician', () => {
      const transitions = getAllowedTransitions('in_progress', 'technician', [], false, false);
      
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions.every(t => t.allowedRoles.includes('technician'))).toBe(true);
    });

    it('should include blocked transitions when admin', () => {
      const evidence = []; // No evidence
      const transitions = getAllowedTransitions('in_progress', 'admin', evidence, false, false);
      
      // Admin can still see the transition (may override)
      const completeTransition = transitions.find(t => t.to === 'pending_closeout');
      expect(completeTransition).toBeDefined();
    });

    it('should not include transitions with blocked roles', () => {
      const transitions = getAllowedTransitions('submitted', 'technician', [], false, false);
      
      // Technician cannot approve/reject
      expect(transitions.find(t => t.to === 'approved')).toBeUndefined();
      expect(transitions.find(t => t.to === 'rejected')).toBeUndefined();
    });
  });

  describe('Role-based restrictions', () => {
    it('should restrict closeout approval to dispatcher/admin', () => {
      const techGate = canTransition('submitted', 'approved', 'technician', [], false, false);
      const dispatchGate = canTransition('submitted', 'approved', 'dispatcher', [], false, false);
      const adminGate = canTransition('submitted', 'approved', 'admin', [], false, false);

      expect(techGate.isAllowed).toBe(false);
      expect(dispatchGate.isAllowed).toBe(true);
      expect(adminGate.isAllowed).toBe(true);
    });

    it('should restrict reopening to dispatcher/admin', () => {
      const techGate = canTransition('pending_closeout', 'in_progress', 'technician', [], false, false);
      const dispatchGate = canTransition('pending_closeout', 'in_progress', 'dispatcher', [], false, false);

      expect(techGate.isAllowed).toBe(false);
      expect(dispatchGate.isAllowed).toBe(true);
    });

    it('should allow technician to pause work', () => {
      const gate = canTransition('in_progress', 'paused', 'technician', [], false, false);
      expect(gate.isAllowed).toBe(true);
    });
  });

  describe('Evidence requirement tracking', () => {
    it('should track photo count with current/required', () => {
      const evidence = [
        { evidence_type: 'before_photo' },
      ];
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, true, true);
      
      const photoReq = gate.blockers.find(b => b.type === 'photo_count');
      expect(photoReq?.current).toBe(1);
      expect(photoReq?.required).toBe(2);
    });

    it('should calculate all blockers for a transition', () => {
      const evidence = []; // No evidence
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, false, false);
      
      // Should have photo + checklist blockers
      expect(gate.blockers.length).toBeGreaterThanOrEqual(2);
      expect(gate.blockers.every(b => !b.isMet)).toBe(true);
    });

    it('should pass with all evidence present', () => {
      const evidence = [
        { evidence_type: 'before_photo' },
        { evidence_type: 'after_photo' },
      ];
      const gate = canTransition('in_progress', 'pending_closeout', 'technician', evidence, true, true);
      
      expect(gate.blockers.every(b => b.isMet)).toBe(true);
      expect(gate.isAllowed).toBe(true);
    });
  });
});