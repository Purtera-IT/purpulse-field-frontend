/**
 * GET /api/me — resolve logged-in user to technicians row (email + idp_subject).
 * Returns internal_technician_id for GET /api/assignments?assigned_to=...
 *
 * Env: same as assignments (JWKS or AUTH_JWT_SECRET).
 */
const { getPool } = require('../../shared/pool');
const { bearerToken, extractEmailFromPayload, extractSub } = require('../../shared/jwt');
const { verifyBearerJwt } = require('../../shared/verifyBearer');

module.exports = async function (context, req) {
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

  const email = extractEmailFromPayload(payload);
  const sub = extractSub(payload);
  if (!email && !sub) {
    context.res = { status: 400, body: { error: 'token_missing_email_and_sub' } };
    return;
  }

  const db = getPool();
  try {
    const r = await db.query(
      `SELECT t.id, t.email, t.first_name, t.last_name, t.display_name, fm.fieldnation_provider_id
       FROM technicians t
       LEFT JOIN fieldnation_mapping fm ON fm.internal_technician_id = t.id
       WHERE ($1::text IS NOT NULL AND t.idp_subject = $1)
          OR ($2::text IS NOT NULL AND t.email IS NOT NULL AND lower(t.email) = lower($2))
       ORDER BY
         CASE
           WHEN $1::text IS NOT NULL AND t.idp_subject = $1 THEN 0
           WHEN $2::text IS NOT NULL AND lower(t.email) = lower($2) THEN 1
           ELSE 2
         END
       LIMIT 1`,
      [sub, email]
    );

    if (r.rows.length === 0) {
      context.res = { status: 404, body: { error: 'technician_not_found' } };
      return;
    }

    const row = r.rows[0];
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        internal_technician_id: row.id,
        email: row.email,
        first_name: row.first_name ?? undefined,
        last_name: row.last_name ?? undefined,
        display_name: row.display_name ?? undefined,
        fieldnation_provider_id: row.fieldnation_provider_id ?? undefined,
      },
    };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, body: { error: 'server_error' } };
  }
};
