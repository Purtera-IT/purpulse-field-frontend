/**
 * provisionTechnician — Azure → Base44 user provisioning endpoint
 *
 * Called by an Azure Function (or any trusted server-side caller) to ensure
 * a technician who exists in public.technicians is already a member of this
 * Base44 app. Idempotent: safe to call multiple times for the same email.
 *
 * Auth: caller must supply the PROVISION_SECRET in the Authorization header.
 *   Authorization: Bearer <PROVISION_SECRET>
 *
 * Request body (JSON):
 * {
 *   "technicians": [
 *     {
 *       "email": "jane.smith@purtera.com",
 *       "role": "user"               // optional, defaults to "user"
 *     }
 *   ]
 * }
 *
 * Response body (JSON):
 * {
 *   "processed": 2,
 *   "results": [
 *     { "email": "jane.smith@purtera.com", "status": "invited" },
 *     { "email": "already.here@purtera.com", "status": "already_member" },
 *     { "email": "bad-email", "status": "error", "error": "..." }
 *   ]
 * }
 *
 * ── Design notes ──────────────────────────────────────────────────────────
 * • PROVISION_SECRET  — set this in Base44 → Dashboard → Code → Environment
 *   Variables. Store the same value in Azure Key Vault / Function App settings.
 * • base44.asServiceRole.auth.inviteUser() does NOT re-send if the user is
 *   already a member; Base44 treats it as a no-op and we catch + label it
 *   "already_member" so callers can distinguish the two cases.
 * • Rate limits: process ≤ 25 technicians per call; loop with small delays
 *   if you need to sync hundreds at once.
 * • Audit: every call result is logged; caller should store the response
 *   payload in their own audit table (Azure Table Storage, Postgres, etc.).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PROVISION_SECRET = Deno.env.get('PROVISION_SECRET');

Deno.serve(async (req) => {
  // ── 1. Shared-secret auth ─────────────────────────────────────────────
  if (!PROVISION_SECRET) {
    return Response.json(
      { error: 'PROVISION_SECRET env var is not configured on this function.' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  const callerSecret = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (callerSecret !== PROVISION_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const technicians = body?.technicians;
  if (!Array.isArray(technicians) || technicians.length === 0) {
    return Response.json(
      { error: '`technicians` must be a non-empty array' },
      { status: 400 }
    );
  }

  if (technicians.length > 100) {
    return Response.json(
      { error: 'Max 100 technicians per call. Batch your requests.' },
      { status: 400 }
    );
  }

  // ── 3. Provision via Base44 service role ──────────────────────────────
  const base44 = createClientFromRequest(req);
  const results = [];

  for (const tech of technicians) {
    const email = (tech.email || '').trim().toLowerCase();
    const role  = tech.role || 'user';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ email, status: 'error', error: 'Invalid email address' });
      continue;
    }

    try {
      await base44.asServiceRole.auth.inviteUser(email, role);
      results.push({ email, status: 'invited' });
    } catch (err) {
      // Base44 returns an error if the user is already a member.
      // Treat that as a success (idempotent).
      const msg = err?.message || String(err);
      if (/already|member|exist/i.test(msg)) {
        results.push({ email, status: 'already_member' });
      } else {
        results.push({ email, status: 'error', error: msg });
      }
    }

    // Small back-off to stay within Base44 rate limits when processing large batches
    await new Promise((r) => setTimeout(r, 120));
  }

  const invited  = results.filter(r => r.status === 'invited').length;
  const existing = results.filter(r => r.status === 'already_member').length;
  const errors   = results.filter(r => r.status === 'error').length;

  return Response.json({
    processed: results.length,
    invited,
    already_member: existing,
    errors,
    results,
  });
});