const crypto = require('crypto');

function base64UrlToBuffer(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  return Buffer.from(pad ? b64 + '='.repeat(4 - pad) : b64, 'base64');
}

/** Verify HS256 JWT and return payload object, or null. */
function verifyJwtHs256(token, secret) {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sigB64] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest();
  let sig;
  try {
    sig = base64UrlToBuffer(sigB64);
  } catch {
    return null;
  }
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
  try {
    const json = base64UrlToBuffer(p).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function bearerToken(req) {
  const a = req.headers && req.headers.authorization;
  if (!a || typeof a !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(a.trim());
  return m ? m[1] : null;
}

/** Best-effort email from common JWT claims (IdP / Base44–style). */
function extractEmailFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.email && typeof payload.email === 'string') return payload.email.trim().toLowerCase();
  if (Array.isArray(payload.emails) && payload.emails[0]) {
    return String(payload.emails[0]).trim().toLowerCase();
  }
  const pref = payload.preferred_username;
  if (typeof pref === 'string' && pref.includes('@')) return pref.trim().toLowerCase();
  const upn = payload.upn;
  if (typeof upn === 'string' && upn.includes('@')) return upn.trim().toLowerCase();
  return null;
}

function extractSub(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.sub != null) return String(payload.sub);
  return null;
}

/** HS256 dev tokens use role; Entra may use roles[] or app roles. */
function isAdminPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.role === 'admin') return true;
  const name = process.env.ENTRA_ADMIN_ROLE_NAME;
  if (name && Array.isArray(payload.roles) && payload.roles.includes(name)) return true;
  return false;
}

module.exports = {
  verifyJwtHs256,
  bearerToken,
  extractEmailFromPayload,
  extractSub,
  isAdminPayload,
};
