/**
 * GET /mock/api/exports/manifest?since=ISO8601&jobId=optional
 *
 * Returns a UTF-8 CSV of UploadManifest rows with exact columns:
 *   manifest_id, object_id, old_url, new_url, sha256,
 *   work_order_id, created_at, migrated
 *
 * Also writes an AuditLog entry:
 *   action_type: 'manifest_exported'
 *   payload_summary: { export_type: 'manifest', since, job_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function escapeCell(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

const COLUMNS = ['manifest_id', 'object_id', 'old_url', 'new_url', 'sha256', 'work_order_id', 'created_at', 'migrated'];

function toManifestRow(r) {
  const azureUrl = r.azure_blob_url || '';
  const migrated = !!(azureUrl && !azureUrl.startsWith('http://mock') && azureUrl !== r.file_url);
  return {
    manifest_id:   r.id         ?? '',
    object_id:     r.evidence_id ?? '',
    old_url:       r.file_url   ?? '',
    new_url:       azureUrl,
    sha256:        r.sha256     ?? '',
    work_order_id: r.job_id     ?? '',
    created_at:    r.created_date ? new Date(r.created_date).toISOString() : '',
    migrated:      migrated ? 'true' : 'false',
  };
}

function rowsToCSV(rows) {
  const header = COLUMNS.join(',');
  const body   = rows.map(r => COLUMNS.map(k => escapeCell(r[k])).join(',')).join('\n');
  return rows.length ? `${header}\n${body}` : header;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url   = new URL(req.url);
  const since = url.searchParams.get('since');
  const jobId = url.searchParams.get('jobId');

  let records = jobId
    ? await base44.asServiceRole.entities.UploadManifest.filter({ job_id: jobId }, '-created_date', 2000)
    : await base44.asServiceRole.entities.UploadManifest.list('-created_date', 2000);

  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) {
      records = records.filter(r => r.created_date && new Date(r.created_date).getTime() >= sinceMs);
    }
  }

  const rows     = records.map(toManifestRow);
  const csv      = rowsToCSV(rows);
  const today    = new Date().toISOString().slice(0, 10);
  const filename = `purpulse-manifest-${today}.csv`;

  // Write audit log
  await base44.asServiceRole.entities.AuditLog.create({
    action_type:     'manifest_exported',
    entity_type:     'UploadManifest',
    actor_email:     user.email,
    actor_role:      user.role === 'admin' ? 'admin' : 'technician',
    payload_summary: JSON.stringify({ export_type: 'manifest', since: since || null, job_id: jobId || null, row_count: rows.length }),
    result:          'success',
    client_ts:       new Date().toISOString(),
    server_ts:       new Date().toISOString(),
  }).catch(() => {});

  return new Response('\uFEFF' + csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Row-Count':         String(rows.length),
    },
  });
});