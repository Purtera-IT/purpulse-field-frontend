/**
 * Next-step copy for FieldJobDetail header — only from real job + evidence fields.
 */
import { READINESS_SHORT_LINES } from '@/lib/fieldReadinessViewModel';

export function getNextStepMessage(job, evidence = []) {
  if (!job?.status) return null;

  const s = job.status;
  const runbookDone =
    job.runbook_phases?.every((phase) => phase.steps?.every((step) => step.completed)) ?? false;

  if (s === 'assigned') {
    return READINESS_SHORT_LINES.assigned;
  }
  if (s === 'en_route') {
    return READINESS_SHORT_LINES.en_route;
  }
  if (s === 'checked_in') {
    return READINESS_SHORT_LINES.checked_in;
  }
  if (s === 'paused') {
    return READINESS_SHORT_LINES.paused;
  }
  if (s === 'in_progress') {
    if (!runbookDone) {
      return 'Work through the runbook; attach evidence to steps as you go.';
    }
    const reqs = job.evidence_requirements;
    if (Array.isArray(reqs) && reqs.length > 0) {
      const allMet = reqs.every((r) => {
        const min = r.min_count || 1;
        const count = evidence.filter(
          (e) => e.evidence_type === r.type && e.status === 'uploaded'
        ).length;
        return count >= min;
      });
      if (!allMet) {
        return 'Complete required evidence types in Evidence before closeout.';
      }
    }
    return 'Work complete on site — use Closeout when ready to finish and sign off.';
  }
  if (s === 'pending_closeout') {
    if (!job.signoff_signature_url) {
      return 'Finish sign-off and validation in Closeout.';
    }
    return 'Sign-off captured — follow any remaining closeout steps.';
  }
  if (s === 'submitted' || s === 'approved') {
    return 'This job is submitted — view-only.';
  }
  if (s === 'rejected' || s === 'qc_required') {
    return 'Follow office instructions for corrections.';
  }
  return null;
}
