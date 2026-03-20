/**
 * Stable non-PII technician_id for canonical events (IMPLEMENTATION_PLAN §1.2).
 */

/** djb2-ish short fingerprint — not cryptographic; dev-only obfuscation of email */
function fingerprintEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  let h = 5381;
  for (let i = 0; i < email.length; i += 1) {
    h = (h * 33) ^ email.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * @param {Record<string, unknown> | null | undefined} user - Base44 / AuthContext user
 * @returns {string}
 */
export function getTechnicianIdForCanonicalEvents(user) {
  const envId = import.meta.env.VITE_DEV_TELEMETRY_TECHNICIAN_ID;
  if (typeof envId === 'string' && envId.trim()) {
    return envId.trim();
  }
  if (user?.id != null && String(user.id).trim()) {
    return String(user.id);
  }
  if (user?.sub != null && String(user.sub).trim()) {
    return String(user.sub);
  }
  if (user?.email && typeof user.email === 'string') {
    return `fieldapp:${fingerprintEmail(user.email)}`;
  }
  return 'fieldapp:anonymous';
}
