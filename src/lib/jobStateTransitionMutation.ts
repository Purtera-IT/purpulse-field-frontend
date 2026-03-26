/// <reference types="vite/client" />

/**
 * Job lifecycle transition: canonical telemetry ordering + Job.update payload (Iteration 14).
 * Closeout submit (pending_closeout → submitted): closeout_event → dispatch_event → persist.
 */

import { base44 } from '@/api/base44Client';
import { fetchJobContextForArtifactEvent } from '@/lib/artifactEvent';
import { emitCloseoutEvent } from '@/lib/closeoutEvent';
import { emitDispatchEventForJobStatusChange } from '@/lib/dispatchEvent';
import { deriveCloseoutSubmissionFlags } from '@/lib/closeoutSubmissionFlags';

type TransitionJob = Record<string, unknown> & { id: string | number };
type TransitionUser = Record<string, unknown> & { email?: string };

export async function executeJobStateTransitionMutation({
  job,
  user,
  evidence = [],
  toStatus,
  fromStatus,
  isOverride,
  overrideReason,
  dispatchOverrides,
}: {
  job: TransitionJob;
  user: TransitionUser;
  evidence?: Array<Record<string, unknown>>;
  toStatus: string;
  fromStatus: string;
  isOverride: boolean;
  overrideReason: string;
  dispatchOverrides: Record<string, unknown> | undefined;
}) {
  if (job?.id == null || !user) {
    throw new Error('Missing job or user');
  }

  const jobId = String(job.id);
  const closeoutSubmitIso =
    toStatus === 'submitted' && fromStatus === 'pending_closeout'
      ? new Date().toISOString()
      : null;

  if (closeoutSubmitIso) {
    try {
      /* Enrich closeout payload with project/site; same helper as artifact path (name is historical). */
      const jobCtx = await fetchJobContextForArtifactEvent(jobId);
      const jobForEvent = { ...job, ...jobCtx };
      const flags = deriveCloseoutSubmissionFlags(job, evidence);
      await emitCloseoutEvent({
        job: jobForEvent,
        user,
        ...flags,
        closeoutSubmitTimestampIso: closeoutSubmitIso,
        invoiceSupportDocsFlag: null,
        portalUpdateFlag: null,
        timecardSubmittedFlag: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (import.meta.env.DEV) console.error('[JobStateTransitioner] closeout_event', e);
      throw new Error(`Telemetry: ${msg}`);
    }
  }

  try {
    await emitDispatchEventForJobStatusChange({
      job,
      targetAppStatus: toStatus,
      user,
      overrides:
        dispatchOverrides && typeof dispatchOverrides === 'object' ? dispatchOverrides : {},
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) console.error('[JobStateTransitioner] dispatch_event', e);
    throw new Error(`Telemetry: ${msg}`);
  }

  const now = new Date().toISOString();
  const timeFields: Record<string, string> = {};
  if (toStatus === 'checked_in') {
    timeFields.check_in_time = now;
  }
  if (toStatus === 'in_progress' && fromStatus !== 'paused') {
    timeFields.work_start_time = now;
    const checkIn = job.check_in_time;
    timeFields.check_in_time =
      typeof checkIn === 'string' && checkIn ? checkIn : now;
  }
  if (toStatus === 'pending_closeout') {
    timeFields.work_end_time = now;
  }
  if (closeoutSubmitIso) {
    timeFields.closeout_submitted_at = closeoutSubmitIso;
  }

  const payload: Record<string, unknown> = {
    status: toStatus,
    ...timeFields,
    ...(isOverride && {
      override_reason: overrideReason,
      overridden_by: user.email,
    }),
  };

  return base44.entities.Job.update(jobId, payload);
}
