/**
 * GET /mock/api/exports/manifest?since=ISO8601&jobId=optional
 *
 * Returns a CSV blob of UploadManifest rows.
 * Writes an AuditLog entry (action_type: 'manifest_exported').
 *
 * Query params:
 *   since  - ISO8601 datetime; only rows captured_at >= since (optional)
 *   jobId  - filter to a single job (optional)
 *
 * Response: text/csv attachment
 *           Content-Disposition: attachment; filename="purpulse-manifest-YYYY-MM-DD.csv"
 *
 * Sample request:
 *   GET /mock/api/exports/manifest?since=2026-03-01T00:00:00Z&jobId=WO-2026-0001
 *
 * Sample response (CSV):
 *   id,job_id,evidence_id,filename,sha256,content_type,size_bytes,...
 *   uuid,WO-2026-0001,uuid,before_photo_001.jpg,a3f1c2...,image/jpeg,4218880,...
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── CSV helper ─────────────────────────────────────────────────────────
function escapeCell(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function rowsToCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.map(escapeCell).join(',');
  const body   = rows.map(r => keys.map(k => escapeCell(r[k])).join(',')).join('\n');
  return `${header}\n${body}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url    = new URL(req.url);
  const since  = url.searchParams.get('since');
  const jobId  = url.searchParams.get('jobId');

  // ── Fetch manifest rows ────────────────────────────────────────────
  let rows = jobId
    ? await base44.asServiceRole.entities.UploadManifest.filter({ job_id: jobId }, '-capture_ts', 2000)
    : await base44.asServiceRole.entities.UploadManifest.list('-capture_ts', 2000);

  // Filter by since (client-side — Base44 doesn't support gte filter on date fields)
  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) {
      rows = rows.filter(r => r.capture_ts && new Date(r.capture_ts).getTime() >= sinceMs);
    }
  }

  const csv      = rowsToCSV(rows);
  const today    = new Date().toISOString().slice(0, 10);
  const filename = `purpulse-manifest-${today}.csv`;

  // ── Audit log ──────────────────────────────────────────────────────
  await base44.asServiceRole.entities.AuditLog.create({
    action_type:     'manifest_exported',
    entity_type:     'upload_manifest',
    actor_email:     user.email,
    actor_role:      user.role === 'admin' ? 'admin' : 'technician',
    payload_summary: JSON.stringify({ rows: rows.length, since: since || 'all', job_id: jobId || 'all', filename }),
    result:          'success',
    client_ts:       new Date().toISOString(),
    server_ts:       new Date().toISOString(),
  }).catch(() => {});

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Row-Count':         String(rows.length),
    },
  });
});