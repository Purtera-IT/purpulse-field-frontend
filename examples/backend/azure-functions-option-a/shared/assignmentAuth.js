const { extractEmailFromPayload, extractSub, isAdminPayload } = require('./jwt');

/**
 * Authorize GET /api/assignments for assigned_to UUID:
 * - admin role, or
 * - JWT claim JWT_TECHNICIAN_CLAIM (default sub) equals assigned_to, or
 * - technician row id matches and (email or idp_subject) matches token.
 */
async function canReadAssignments(db, payload, assignedTo) {
  if (!payload || typeof payload !== 'object') return false;
  if (isAdminPayload(payload)) return true;

  const claimName = process.env.JWT_TECHNICIAN_CLAIM || 'sub';
  const claim = payload[claimName] != null ? String(payload[claimName]) : '';
  if (claim && claim === assignedTo) return true; // internal UUID in custom claim (rare)

  const email = extractEmailFromPayload(payload);
  const sub = extractSub(payload);

  const r = await db.query(
    `SELECT 1 FROM technicians
     WHERE id = $1::uuid
       AND (
         ($2::text IS NOT NULL AND lower(email) = lower($2))
         OR ($3::text IS NOT NULL AND idp_subject IS NOT NULL AND idp_subject = $3)
       )`,
    [assignedTo, email, sub]
  );
  return r.rows.length > 0;
}

module.exports = { canReadAssignments };
