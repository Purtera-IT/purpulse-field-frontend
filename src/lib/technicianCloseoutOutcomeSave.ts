/**
 * Technician closeout outcome — canonical event discipline (Iteration 14, intentional).
 *
 * Order is deliberate: queue `feedback_event` first, then persist `technician_closeout_*` on Job.
 * That matches emit-before-mutate rigor elsewhere; telemetry failure blocks the save (toast in UI).
 * Do not flip to persist-then-emit without an explicit architecture decision — downstream replay
 * assumes the event queue can lead the persisted row for this flow.
 */
import { base44 } from '@/api/base44Client';
import { fetchJobContextForArtifactEvent } from '@/lib/artifactEvent';
import { emitFeedbackEvent } from '@/lib/feedbackEvent';
import {
  buildCloseoutFeedbackEventArgs,
  buildTechnicianCloseoutJobUpdate,
  type TechnicianCloseoutFeedbackForm,
} from '@/lib/fieldCloseoutFeedbackViewModel';

export async function saveTechnicianCloseoutOutcomeWithTelemetry(
  job: Record<string, unknown> & { id: string },
  user: unknown,
  form: TechnicianCloseoutFeedbackForm
): Promise<Record<string, unknown>> {
  const recordedAtIso = new Date().toISOString();
  const jobCtx = await fetchJobContextForArtifactEvent(String(job.id));
  const jobForEvent = { ...job, ...jobCtx };
  try {
    await emitFeedbackEvent({
      ...buildCloseoutFeedbackEventArgs({ job: jobForEvent, user, form }),
      feedbackTimestampIso: recordedAtIso,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Telemetry: ${msg}`);
  }
  const patch = buildTechnicianCloseoutJobUpdate(form, { recordedAtIso });
  await base44.entities.Job.update(job.id, patch);
  return patch;
}
