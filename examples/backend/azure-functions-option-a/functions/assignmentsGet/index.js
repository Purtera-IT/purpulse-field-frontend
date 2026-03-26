/**
 * GET /api/assignments?assigned_to=<uuid> — Option A boilerplate (Azure Functions v3).
 *
 * Env: DATABASE_URL or PG_CONN; Entra JWKS: ENTRA_TENANT_ID + ENTRA_AUDIENCE (or AZURE_*); or AUTH_JWT_SECRET (HS256).
 * Authorization: admin, or claim matches assigned_to, or JWT email/sub matches technicians row for that id
 * (see shared/assignmentAuth.js).
 */
const { getPool } = require('../../shared/pool');
const { bearerToken } = require('../../shared/jwt');
const { verifyBearerJwt } = require('../../shared/verifyBearer');
const { canReadAssignments } = require('../../shared/assignmentAuth');

module.exports = async function (context, req) {
  const assignedTo = (req.query && req.query.assigned_to && String(req.query.assigned_to).trim()) || '';
  if (!assignedTo) {
    context.res = { status: 400, body: { error: 'missing_assigned_to' } };
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    context.res = { status: 401, body: { error: 'missing_bearer' } };
    return;
  }

  const payload = await verifyBearerJwt(token);
  if (!payload) {
    context.res = { status: 401, body: { error: 'invalid_token' } };
    return;
  }

  const db = getPool();
  try {
    const allowed = await canReadAssignments(db, payload, assignedTo);
    if (!allowed) {
      context.res = { status: 403, body: { error: 'forbidden' } };
      return;
    }

    const r = await db.query(
      `SELECT job_id, title, scheduled_date, runbook_version, runbook_json, evidence_requirements
       FROM job_assignments
       WHERE assigned_to_internal_technician_id = $1::uuid
       ORDER BY updated_at DESC`,
      [assignedTo]
    );

    const assignments = r.rows.map((row) => ({
      job_id: row.job_id,
      title: row.title ?? undefined,
      scheduled_date: row.scheduled_date ?? undefined,
      runbook_version: row.runbook_version ?? undefined,
      runbook_json: row.runbook_json ?? undefined,
      evidence_requirements: row.evidence_requirements ?? undefined,
    }));

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { assignments },
    };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, body: { error: 'server_error' } };
  }
};
