/**
 * GET /mock/api/exports/audit-logs?since=ISO8601
 *
 * Returns a UTF-8 CSV of AuditLog rows.
 * Query params:
 *   since - ISO8601 datetime; only rows where client_ts >= since (optional)
 *
 * Writes an AuditLog entry:
 *   action_type: 'audit_exported'
 *   payload_summary: { export_type: 'audit_log', since }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function escapeCell(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

const COLUMNS = [
  'id', 'job_id', 'action_type', 'entity_type', 'entity_id',
  'actor_email', 'actor_role', 'result', 'client_ts', 'server_ts',
  'duration_ms', 'session_id', 'device_id', 'ip_address',
  'error_message', 'payload_summary',
];

function toAuditRow(r) {
  return {
    id:              r.id              ?? '',
    job_id:          r.job_id          ?? '',
    action_type:     r.action_type     ?? '',
    entity_type:     r.entity_type     ?? '',
    entity_id:       r.entity_id       ?? '',
    actor_email:     r.actor_email     ?? '',
    actor_role:      r.actor_role      ?? '',
    result:          r.result          ?? '',
    client_ts:       r.client_ts  ? new Date(r.client_ts).toISOString()  : '',
    server_ts:       r.server_ts  ? new Date(r.server_ts).toISOString()  : '',
    duration_ms:     r.duration_ms     ?? '',
    session_id:      r.session_id      ?? '',
    device_id:       r.device_id       ?? '',
    ip_address:      r.ip_address      ?? '',
    error_message:   r.error_message   ?? '',
    payload_summary: r.payload_summary ?? '',
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

  let records = await base44.asServiceRole.entities.AuditLog.list('-client_ts', 5000);

  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) {
      records = records.filter(r => {
        const ts = r.client_ts || r.server_ts;
        return ts && new Date(ts).getTime() >= sinceMs;
      });
    }
  }

  const rows     = records.map(toAuditRow);
  const csv      = rowsToCSV(rows);
  const today    = new Date().toISOString().slice(0, 10);
  const filename = `purpulse-audit-logs-${today}.csv`;

  // Write audit log for this export (don't include itself — fire-and-forget after response)
  base44.asServiceRole.entities.AuditLog.create({
    action_type:     'audit_exported',
    entity_type:     'AuditLog',
    actor_email:     user.email,
    actor_role:      user.role === 'admin' ? 'admin' : 'technician',
    payload_summary: JSON.stringify({ export_type: 'audit_log', since: since || null, row_count: rows.length }),
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