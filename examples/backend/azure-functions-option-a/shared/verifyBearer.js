/**
 * Bearer JWT verification: Entra (JWKS) when ENTRA_TENANT_ID + ENTRA_AUDIENCE are set;
 * otherwise HS256 with AUTH_JWT_SECRET (staging / dev).
 */
const { createRemoteJWKSet, jwtVerify } = require('jose');
const { verifyJwtHs256 } = require('./jwt');

let jwksRef = null;
let jwksTenantId = null;

function getJwks(tenantId) {
  if (jwksRef && jwksTenantId === tenantId) return jwksRef;
  jwksTenantId = tenantId;
  jwksRef = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
  );
  return jwksRef;
}

/**
 * @param {string} token
 * @returns {Promise<import('jose').JWTPayload | Record<string, unknown> | null>}
 */
async function verifyBearerJwt(token) {
  if (!token || typeof token !== 'string') return null;

  const tenantId = process.env.ENTRA_TENANT_ID || process.env.AZURE_TENANT_ID;
  const audience = process.env.ENTRA_AUDIENCE || process.env.AZURE_API_AUDIENCE;

  if (tenantId && audience) {
    try {
      const issuer =
        process.env.ENTRA_ISSUER || `https://login.microsoftonline.com/${tenantId}/v2.0`;
      const JWKS = getJwks(tenantId);
      const { payload } = await jwtVerify(token, JWKS, {
        issuer,
        audience,
        clockTolerance: 60,
      });
      return payload;
    } catch {
      /* try HS256 fallback below */
    }
  }

  const secret = process.env.AUTH_JWT_SECRET;
  if (secret) {
    return verifyJwtHs256(token, secret);
  }

  return null;
}

module.exports = { verifyBearerJwt };
