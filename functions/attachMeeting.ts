/**
 * POST /mock/api/meetings
 *
 * Request: MeetingArtifact
 * {
 *   meetingId?: string (external Teams/Zoom ID),
 *   jobId: UUID,
 *   title: string,
 *   meetingType?: 'kickoff'|'safety_brief'|'progress'|'debrief'|'incident'|'client_walkthrough',
 *   scheduledAt?: ISO8601,
 *   endedAt?: ISO8601,
 *   durationMin?: number,
 *   location?: string,
 *   attendees?: string[],          // emails of app users
 *   externalAttendees?: string,    // free text CSV of non-app attendees
 *   transcriptText?: string,       // raw transcript to store as data URI
 *   transcriptUrl?: string,        // or a pre-hosted URL
 *   recordingUrl?: string,
 *   summary?: string,
 *   actionItems?: [{owner, task, due_date}],
 *   attachmentEvidenceIds?: UUID[] // link existing evidence to this meeting
 * }
 *
 * Effects:
 *   1. Insert Meeting row
 *   2. For each attachmentEvidenceId: Activity (event_type: 'upload') linking meeting
 *   3. Insert AuditLog (action_type: 'meeting_created')
 *   4. If transcriptText provided: also AuditLog 'meeting_transcript_attached'
 *
 * Response: { success: true, meeting: MeetingRow, linkedEvidenceCount: number }
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
  const {
    meetingId, jobId, title, meetingType, scheduledAt, endedAt,
    durationMin, location, attendees, externalAttendees,
    transcriptText, transcriptUrl, recordingUrl, summary,
    actionItems, attachmentEvidenceIds = [],
  } = body;

  if (!jobId || !title) {
    return Response.json({ error: 'jobId and title are required' }, { status: 400 });
  }

  const now        = new Date().toISOString();
  const actorEmail = user.email;

  // Derive transcript URL: prefer explicit URL, else encode text as data URI
  const finalTranscriptUrl = transcriptUrl
    || (transcriptText
        ? `data:text/plain;base64,${btoa(unescape(encodeURIComponent(transcriptText)))}`
        : undefined);

  // ── 1. Meeting row ─────────────────────────────────────────────────
  const meeting = await base44.asServiceRole.entities.Meeting.create({
    job_id:            jobId,
    title,
    meeting_type:      meetingType    || 'progress',
    scheduled_at:      scheduledAt    || now,
    ended_at:          endedAt        || undefined,
    duration_min:      durationMin    || undefined,
    location:          location       || undefined,
    attendees:         Array.isArray(attendees) ? attendees : [],
    external_attendees:externalAttendees || undefined,
    transcript_url:    finalTranscriptUrl || undefined,
    recording_url:     recordingUrl   || undefined,
    summary:           summary        || undefined,
    action_items:      actionItems ? JSON.stringify(actionItems) : undefined,
    attachments:       attachmentEvidenceIds.map(id => ({ evidence_id: id })),
    status:            'completed',
    sync_status:       'synced',
  });

  // ── 2. Activity rows for linked evidence ───────────────────────────
  const linkPromises = attachmentEvidenceIds.map(evId =>
    base44.asServiceRole.entities.Activity.create({
      event_type:    'upload',
      user_id:       actorEmail,
      work_order_id: jobId,
      timestamp:     now,
      meta: { evidence_id: evId, note: `Linked to meeting: ${title}`, app_version: '2.4.1' },
    }).catch(() => {})
  );
  await Promise.all(linkPromises);

  // ── 3. Audit: meeting_created ──────────────────────────────────────
  await base44.asServiceRole.entities.AuditLog.create({
    action_type:     'meeting_created',
    entity_type:     'meeting',
    entity_id:       meeting.id,
    actor_email:     actorEmail,
    actor_role:      'admin',
    payload_summary: JSON.stringify({ title, meeting_type: meetingType, job_id: jobId }),
    result:          'success',
    client_ts:       now,
    server_ts:       now,
    job_id:          jobId,
  }).catch(() => {});

  // ── 4. Audit: transcript attached (if provided) ────────────────────
  if (finalTranscriptUrl) {
    await base44.asServiceRole.entities.AuditLog.create({
      action_type:     'meeting_transcript_attached',
      entity_type:     'meeting',
      entity_id:       meeting.id,
      actor_email:     actorEmail,
      actor_role:      'admin',
      payload_summary: JSON.stringify({ source: transcriptUrl ? 'url' : 'text_paste' }),
      result:          'success',
      client_ts:       now,
      server_ts:       now,
      job_id:          jobId,
    }).catch(() => {});
  }

  /*
   * Sample request:
   * {
   *   "jobId": "WO-2026-0001",
   *   "title": "AT&T Alpha-7 Progress Review",
   *   "meetingType": "progress",
   *   "scheduledAt": "2026-03-17T14:00:00Z",
   *   "externalAttendees": "Marcus Webb (AT&T), David Chu (RF Eng)",
   *   "transcriptText": "Jordan: Pre-survey complete. Marcus: Confirmed LOTO...",
   *   "actionItems": [{"owner":"j.smith@purpulse.com","task":"Upload OTDR traces","due_date":"2026-03-17T17:00:00Z"}],
   *   "attachmentEvidenceIds": ["550e8400-..."]
   * }
   *
   * Sample response:
   * {
   *   "success": true,
   *   "meeting": { "id": "uuid", "title": "AT&T Alpha-7 Progress Review", ... },
   *   "linkedEvidenceCount": 1
   * }
   */
  return Response.json({
    success:             true,
    meeting,
    linkedEvidenceCount: attachmentEvidenceIds.length,
  });
});