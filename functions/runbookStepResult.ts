/**
 * POST /mock/api/runbooks/steps/result
 *
 * Request:
 * {
 *   stepId: string,
 *   workOrderId: UUID,
 *   techId: string (email or UUID),
 *   result: 'complete' | 'fail' | 'skip',
 *   notes?: string,
 *   evidenceIds?: UUID[],
 *   durationSeconds?: number
 * }
 *
 * Effects:
 *   1. Insert Activity (event_type: 'end_step' | 'start_step')
 *   2. Insert AuditLog (action_type: 'runbook_step_complete')
 *   3. Patches Job.runbook_phases step.completed in the embedded JSONB
 *      (best-effort — only if the job's runbook_phases array has this stepId)
 *
 * Response: { success: true, activityId: UUID, stepId, result }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { stepId, workOrderId, techId, result, notes, evidenceIds = [], durationSeconds } = body;

  if (!stepId || !workOrderId || !result) {
    return Response.json({ error: 'stepId, workOrderId and result are required' }, { status: 400 });
  }

  const VALID_RESULTS = new Set(['complete', 'fail', 'skip']);
  if (!VALID_RESULTS.has(result)) {
    return Response.json({ error: `result must be one of: ${[...VALID_RESULTS].join(', ')}` }, { status: 400 });
  }

  const now        = new Date().toISOString();
  const actorEmail = techId || user.email;

  // ── 1. Activity row ────────────────────────────────────────────────
  const activity = await base44.asServiceRole.entities.Activity.create({
    event_type:      result === 'complete' ? 'end_step' : 'start_step',
    user_id:         actorEmail,
    work_order_id:   workOrderId,
    runbook_step_id: stepId,
    timestamp:       now,
    meta: {
      step_title:   stepId,
      duration_s:   durationSeconds || undefined,
      evidence_ids: evidenceIds.length ? evidenceIds : undefined,
      note:         notes          || undefined,
      result,
      app_version:  '2.4.1',
    },
  });

  // ── 2. Audit log ───────────────────────────────────────────────────
  await base44.asServiceRole.entities.AuditLog.create({
    action_type:     'runbook_step_complete',
    entity_type:     'runbook_step',
    entity_id:       stepId,
    actor_email:     actorEmail,
    actor_role:      'technician',
    payload_summary: JSON.stringify({
      step_id:         stepId,
      result,
      duration_s:      durationSeconds,
      evidence_count:  evidenceIds.length,
      notes,
    }),
    result:          result === 'fail' ? 'error' : 'success',
    client_ts:       now,
    server_ts:       now,
    job_id:          workOrderId,
  }).catch(() => {});

  // ── 3. Patch job runbook_phases (best-effort) ─────────────────────
  try {
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: workOrderId });
    const job  = jobs[0];
    if (job?.runbook_phases?.length) {
      const phases = job.runbook_phases.map(phase => ({
        ...phase,
        steps: (phase.steps || []).map(s =>
          s.id === stepId
            ? { ...s, completed: result === 'complete', completed_at: now }
            : s
        ),
      }));
      await base44.asServiceRole.entities.Job.update(job.id, { runbook_phases: phases });
    }
  } catch (_) { /* non-fatal */ }

  /*
   * Sample request:
   * {
   *   "stepId": "s1-3",
   *   "workOrderId": "WO-2026-0001",
   *   "techId": "j.smith@purpulse.com",
   *   "result": "complete",
   *   "notes": "Torqued to 25 Nm per spec.",
   *   "evidenceIds": ["550e8400-...", "661e9511-..."],
   *   "durationSeconds": 2340
   * }
   *
   * Sample response:
   * {
   *   "success": true,
   *   "activityId": "uuid",
   *   "stepId": "s1-3",
   *   "result": "complete"
   * }
   */
  return Response.json({ success: true, activityId: activity.id, stepId, result });
});