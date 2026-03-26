/**
 * HTTP handler: verify HMAC (same as fieldnation webhook), optional event-type gate,
 * load technicians row, send Graph invitation, update entra_* columns.
 *
 * Deploy: App Service, Container, or run behind HTTPS reverse proxy. Do not expose without TLS.
 */
'use strict';

const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT, 10) || 8787;

let pool;
function getPool() {
  if (!pool) {
    const conn = process.env.DATABASE_URL || process.env.PG_CONN;
    if (!conn) throw new Error('DATABASE_URL or PG_CONN required');
    pool = new Pool({ connectionString: conn, max: 4, ssl: { rejectUnauthorized: true } });
  }
  return pool;
}

function verifySignature(body, secret, headerVal) {
  if (!secret) return true;
  if (!headerVal || typeof headerVal !== 'string') return false;
  const trimmed = headerVal.trim();
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return false;
  const algorithm = trimmed.slice(0, eq).trim().toLowerCase();
  const providedHex = trimmed.slice(eq + 1).trim().toLowerCase();
  if (algorithm !== 'sha256') return false;
  if (!/^[0-9a-f]{64}$/i.test(providedHex)) return false;
  const expectedHex = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(providedHex, 'hex'));
  } catch {
    return false;
  }
}

async function getGraphAccessToken(tenantId, clientId, clientSecret) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text).access_token;
}

async function graphInvite(accessToken, email, redirectUrl) {
  const res = await fetch('https://graph.microsoft.com/v1.0/invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      invitedUserEmailAddress: email,
      inviteRedirectUrl: redirectUrl,
      sendInvitationMessage: true,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Graph invitation ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

function allowedEventType(fieldnationEventType) {
  const raw = process.env.ACCEPT_EVENT_TYPES || 'work_order.accepted,work_order_accepted';
  const allow = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const ft = String(fieldnationEventType || '').trim().toLowerCase();
  return allow.includes(ft);
}

async function handleProvision(body) {
  const internalId = body.internal_technician_id;
  if (!internalId) {
    return { status: 400, json: { error: 'missing_internal_technician_id' } };
  }

  const db = getPool();
  const r = await db.query(
    `SELECT id, email, idp_subject, entra_invite_sent_at
     FROM technicians WHERE id = $1::uuid`,
    [internalId]
  );
  if (r.rows.length === 0) {
    return { status: 404, json: { error: 'technician_not_found' } };
  }
  const row = r.rows[0];
  if (!row.email) {
    return { status: 422, json: { error: 'technician_email_required' } };
  }
  if (row.idp_subject) {
    return { status: 200, json: { skipped: 'already_has_idp_subject' } };
  }
  if (row.entra_invite_sent_at && process.env.ALLOW_REPEAT_INVITE !== 'true') {
    return { status: 200, json: { skipped: 'entra_invite_already_sent' } };
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    return { status: 503, json: { error: 'graph_credentials_not_configured' } };
  }

  const redirect = process.env.GRAPH_INVITE_REDIRECT_URL || 'https://localhost';
  const token = await getGraphAccessToken(tenantId, clientId, clientSecret);
  const inv = await graphInvite(token, row.email, redirect);
  const invitedUserId = inv.invitedUser?.id || null;

  await db.query(
    `UPDATE technicians SET
       entra_invite_sent_at = now(),
       entra_object_id = COALESCE($1::text, entra_object_id),
       entra_invite_last_error = NULL,
       updated_at = now()
     WHERE id = $2::uuid`,
    [invitedUserId, internalId]
  );

  return {
    status: 200,
    json: { ok: true, entra_object_id: invitedUserId, email: row.email },
  };
}

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (req.method !== 'POST' || (path !== '/' && path !== '/provision')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const bodyStr = Buffer.concat(chunks).toString('utf8');

  const secret = process.env.USER_PROVISIONING_HMAC_SECRET || '';
  const sig = req.headers['x-provisioning-signature'];
  if (!verifySignature(bodyStr, secret, sig)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_signature' }));
    return;
  }

  let body;
  try {
    body = JSON.parse(bodyStr || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_json' }));
    return;
  }

  if (!allowedEventType(body.fieldnation_event_type)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        skipped: 'event_type_not_for_invite',
        fieldnation_event_type: body.fieldnation_event_type || null,
      })
    );
    return;
  }

  try {
    const out = await handleProvision(body);
    res.writeHead(out.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.json));
  } catch (e) {
    console.error(e);
    const internalId = body.internal_technician_id;
    if (internalId) {
      try {
        await getPool().query(
          `UPDATE technicians SET entra_invite_last_error = $1, updated_at = now() WHERE id = $2::uuid`,
          [String(e.message).slice(0, 2000), internalId]
        );
      } catch (err) {
        console.error(err);
      }
    }
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_error', message: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[entra-technician-invite-handler] listening on :${PORT}`);
});
