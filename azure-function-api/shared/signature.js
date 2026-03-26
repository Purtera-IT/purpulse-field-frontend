/**
 * Field Nation webhook verification — use with the **raw** HTTP body only.
 *
 * Supports (in priority order when multiple secrets/headers apply):
 * 1. **X-FN-Signature** — `sha256=<hex>` (HMAC-SHA256 over raw body). Current Field Nation DX.
 * 2. **X-Signature** — 64-char hex = HMAC-SHA256(secret, rawBody), or same `sha256=<hex>` form.
 * 3. **Fn-Hash** — legacy MD5 hex( secret concatenated with body UTF-8 string ).
 *
 * @see https://developer.fieldnation.com/docs/webhooks/concepts/payload-structure/
 */
'use strict';

const crypto = require('crypto');

/**
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string} name - header name (matched case-insensitively)
 */
function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) {
      const v = headers[k];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

/**
 * @param {{ rawBody?: Buffer | string, body?: unknown }} req
 * @returns {Buffer | null}
 */
function getRawBodyBuffer(req) {
  if (!req) return null;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  return null;
}

function timingSafeHexEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/** X-FN-Signature: sha256=<64 hex> */
function verifyXFnSignatureSha256(rawBody, secret, headerVal) {
  if (!headerVal || typeof headerVal !== 'string') return false;
  const trimmed = headerVal.trim();
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return false;
  const algorithm = trimmed.slice(0, eq).trim().toLowerCase();
  const providedHex = trimmed.slice(eq + 1).trim().toLowerCase();
  if (algorithm !== 'sha256') return false;
  if (!/^[0-9a-f]{64}$/i.test(providedHex)) return false;
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeHexEqual(expectedHex, providedHex);
}

/** X-Signature: bare 64-char hex (HMAC-SHA256) or sha256=<hex> */
function verifyXSignature(rawBody, secret, headerVal) {
  if (!headerVal || typeof headerVal !== 'string') return false;
  const trimmed = headerVal.trim();
  if (trimmed.toLowerCase().startsWith('sha256=')) {
    return verifyXFnSignatureSha256(rawBody, secret, trimmed);
  }
  if (!/^[0-9a-f]{64}$/i.test(trimmed)) return false;
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeHexEqual(expectedHex, trimmed.toLowerCase());
}

/** Fn-Hash: MD5(secret + bodyString) as 32-char hex */
function verifyFnHash(rawBody, secret, headerVal) {
  if (!headerVal || typeof headerVal !== 'string') return false;
  const provided = headerVal.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/i.test(provided)) return false;
  const bodyStr = rawBody.toString('utf8');
  const expected = crypto.createHash('md5').update(secret + bodyStr, 'utf8').digest('hex');
  return timingSafeHexEqual(expected, provided);
}

/**
 * Verify using any supported header. Priority: X-FN-Signature → X-Signature → Fn-Hash.
 *
 * @param {Buffer} rawBody
 * @param {string|undefined} secret
 * @param {Record<string, string | string[] | undefined>} headers
 * @returns {{ ok: boolean, method?: 'x-fn-signature' | 'x-signature' | 'fn-hash' }}
 */
function verifyFieldNationWebhook(rawBody, secret, headers) {
  if (!secret) {
    return { ok: true, method: undefined };
  }
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return { ok: false };
  }

  const xFn = getHeader(headers, 'x-fn-signature');
  if (xFn != null && String(xFn).trim() !== '') {
    const ok = verifyXFnSignatureSha256(rawBody, secret, xFn);
    return { ok, method: ok ? 'x-fn-signature' : undefined };
  }

  const xSig = getHeader(headers, 'x-signature');
  if (xSig != null && String(xSig).trim() !== '') {
    const ok = verifyXSignature(rawBody, secret, xSig);
    return { ok, method: ok ? 'x-signature' : undefined };
  }

  const fnHash = getHeader(headers, 'fn-hash');
  if (fnHash != null && String(fnHash).trim() !== '') {
    const ok = verifyFnHash(rawBody, secret, fnHash);
    return { ok, method: ok ? 'fn-hash' : undefined };
  }

  return { ok: false };
}

/** @deprecated Use verifyFieldNationWebhook; kept for callers that only implement DX format */
function verifyFieldNationSignature(rawBody, signatureHeader, secret) {
  if (!secret) return true;
  return verifyXFnSignatureSha256(rawBody, secret, signatureHeader || '');
}

/** @deprecated Use getHeader(req.headers, 'x-fn-signature') */
function getXFnSignature(headers) {
  return getHeader(headers, 'x-fn-signature');
}

module.exports = {
  getHeader,
  getRawBodyBuffer,
  verifyFieldNationWebhook,
  verifyFieldNationSignature,
  getXFnSignature,
  verifyXFnSignatureSha256,
  verifyXSignature,
  verifyFnHash,
};
