/**
 * POST /api/webhooks/fieldnation — Option A boilerplate (Azure Functions v3).
 * Field Nation: X-FN-Signature = sha256=<hex> over raw body (see shared/fieldnationSignature.js).
 *
 * Env: DATABASE_URL or PG_CONN; FIELDNATION_WEBHOOK_SECRET or FN_WEBHOOK_SECRET (omit only in dev)
 * Optional: USER_PROVISIONING_WEBHOOK_URL + USER_PROVISIONING_HMAC_SECRET — POST after successful DB commit
 * (see docs/plans/fieldnation-webhook-user-provisioning.md).
 */
const crypto = require('crypto');
const { getPool } = require('../../shared/pool');
const { verifyFieldNationWebhook, getRawBodyBuffer } = require('../../shared/fieldnationSignature');

/** Map common Field Nation / partner payload keys to first_name, last_name, display_name. */
function nameParts(payload) {
  const wo = payload.workorder || {};
  const prov = wo.provider || wo.assignee || {};
  const firstRaw =
    payload.provider_first_name ?? payload.first_name ?? payload.given_name ?? prov.first_name ?? prov.firstName;
  const lastRaw =
    payload.provider_last_name ?? payload.last_name ?? payload.family_name ?? prov.last_name ?? prov.lastName;
  const first = firstRaw != null && String(firstRaw).trim() ? String(firstRaw).trim() : null;
  const last = lastRaw != null && String(lastRaw).trim() ? String(lastRaw).trim() : null;
  let display = [first, last].filter(Boolean).join(' ').trim() || null;
  if (!display && (payload.provider_name || prov.name)) {
    display = String(payload.provider_name || prov.name).trim() || null;
  }
  return { first, last, display };
}

/**
 * Resolve ids from Field Nation’s nested JSON (workorder.*) and legacy flat test payloads.
 */
function extractWebhookFields(payload) {
  const wo = payload.workorder || {};
  const ev = payload.event || {};
  const params = ev.params || {};

  const woId = String(
    params.work_order_id ?? payload.work_order_id ?? wo.id ?? wo.work_order_id ?? ''
  ).trim();

  const prov =
    payload.fieldnation_provider_id ??
    payload.provider_id ??
    wo.provider?.userId ??
    wo.provider?.id ??
    wo.assignee?.userId ??
    wo.assignee?.id ??
    payload.triggered_by_user?.id;

  const providerId = prov != null && String(prov).trim() ? String(prov).trim() : '';

  const jobId = String(
    payload.external_ref ||
      payload.job_id ||
      params.job_id ||
      wo.customFields?.ticketNumber ||
      woId
  ).trim();

  const email = String(
    payload.provider_email || wo.provider?.email || wo.assignee?.email || ''
  )
    .trim()
    .toLowerCase();

  return { woId, providerId, jobId, email };
}

/** Normalize event type from Field Nation DX shape (event.name) and legacy flat keys. */
function getFieldNationEventType(payload) {
  const ev = payload.event;
  if (ev && typeof ev.name === 'string' && ev.name.trim()) {
    return ev.name.trim().toLowerCase();
  }
  const e = payload.event_type ?? payload.event ?? payload.type ?? '';
  return String(e).trim().toLowerCase();
}

/**
 * Only call USER_PROVISIONING_WEBHOOK_URL for allowed events (default: work order accepted / assigned).
 * Set USER_PROVISIONING_EVENT_TYPES=* for all events (not recommended).
 */
function shouldCallUserProvisioningWebhook(eventType) {
  const url = process.env.USER_PROVISIONING_WEBHOOK_URL;
  if (!url || !String(url).trim()) return false;

  const allowMissing = process.env.USER_PROVISIONING_ALLOW_MISSING_EVENT_TYPE === 'true';
  if (!eventType) {
    return allowMissing;
  }

  const raw = process.env.USER_PROVISIONING_EVENT_TYPES;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    const defaultList =
      'work_order.accepted,work_order_accepted,workorder.status.assigned,workorder.assigned,workorder.status.working';
    const list = defaultList.split(',').map((s) => s.trim().toLowerCase());
    return list.includes(eventType);
  }
  if (String(raw).trim() === '*') return true;

  const list = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes('*')) return true;
  return list.includes(eventType);
}

/**
 * Notify PM / Entra invite handler / Base44. Best-effort; failures are logged only.
 */
async function notifyUserProvisioningIfConfigured(context, payload) {
  const url = process.env.USER_PROVISIONING_WEBHOOK_URL;
  if (!url || typeof url !== 'string' || !url.trim()) return;

  const secret = process.env.USER_PROVISIONING_HMAC_SECRET;
  const body = JSON.stringify({
    event: 'fieldnation.job_accepted',
    fieldnation_event_type: payload.fieldnationEventType || null,
    email: payload.email,
    internal_technician_id: payload.technicianId,
    fieldnation_provider_id: payload.providerId,
    job_id: payload.jobId,
    first_name: payload.firstName,
    last_name: payload.lastName,
    display_name: payload.displayName,
  });

  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Provisioning-Signature'] = `sha256=${sig}`;
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url.trim(), {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      context.log.warn(
        `[fieldnationWebhook] USER_PROVISIONING_WEBHOOK_URL returned ${res.status} ${text.slice(0, 500)}`
      );
    }
  } catch (err) {
    context.log.warn('[fieldnationWebhook] USER_PROVISIONING_WEBHOOK_URL failed', err.message || err);
  } finally {
    clearTimeout(t);
  }
}

function headerString(req, name) {
  const h = req.headers;
  if (!h) return undefined;
  const lower = name.toLowerCase();
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === lower) {
      const v = h[k];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

module.exports = async function (context, req) {
  const secret = process.env.FIELDNATION_WEBHOOK_SECRET || process.env.FN_WEBHOOK_SECRET;
  const rawBuf = getRawBodyBuffer(req);

  if (secret) {
    if (!rawBuf) {
      context.res = {
        status: 401,
        body: {
          error: 'invalid_signature',
          detail:
            'raw_body_required_for_hmac — configure the HTTP trigger so the handler receives the raw body (Field Nation signs exact bytes). Parsed JSON cannot be verified.',
        },
      };
      return;
    }
    const { ok } = verifyFieldNationWebhook(rawBuf, secret, req.headers);
    if (!ok) {
      context.res = { status: 401, body: { error: 'invalid_signature' } };
      return;
    }
  }

  let payload;
  try {
    if (rawBuf) {
      payload = JSON.parse(rawBuf.toString('utf8'));
    } else if (typeof req.body === 'object' && req.body !== null) {
      payload = req.body;
    } else {
      payload = JSON.parse(String(req.body ?? '{}'));
    }
  } catch (e) {
    context.res = { status: 400, body: { error: 'invalid_json' } };
    return;
  }

  const idempotencyKey =
    headerString(req, 'x-fn-delivery-id') ||
    headerString(req, 'x-idempotency-key') ||
    payload.webhook_event_id ||
    payload.work_order_id ||
    null;
  if (!idempotencyKey) {
    context.res = { status: 400, body: { error: 'missing_idempotency_key' } };
    return;
  }

  const extracted = extractWebhookFields(payload);
  const providerId = extracted.providerId;
  const jobId = extracted.jobId;
  const email = extracted.email;
  const woId = extracted.woId;
  const names = nameParts(payload);
  const fieldnationEventType = getFieldNationEventType(payload);

  if (!providerId || !jobId) {
    context.res = { status: 400, body: { error: 'missing_provider_or_job' } };
    return;
  }

  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const dup = await client.query(
      'SELECT 1 FROM webhook_idempotency WHERE idempotency_key = $1',
      [String(idempotencyKey)]
    );
    if (dup.rows.length > 0) {
      await client.query('COMMIT');
      context.res = { status: 200, body: { status: 'duplicate_ignored' } };
      return;
    }

    await client.query(
      `INSERT INTO webhook_idempotency (idempotency_key, payload_hash, result_status)
       VALUES ($1, $2, $3)`,
      [String(idempotencyKey), null, 'processing']
    );

    let techRes = await client.query(
      'SELECT internal_technician_id FROM fieldnation_mapping WHERE fieldnation_provider_id = $1',
      [providerId]
    );
    let technicianId;
    if (techRes.rows.length > 0) {
      technicianId = techRes.rows[0].internal_technician_id;
    } else {
      let byEmail = null;
      if (email) {
        byEmail = await client.query('SELECT id FROM technicians WHERE lower(email) = $1', [email]);
      }
      if (byEmail && byEmail.rows.length > 0) {
        technicianId = byEmail.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO technicians (email, first_name, last_name, display_name, status, metadata)
           VALUES ($1, $2, $3, $4, 'active', '{}'::jsonb)
           RETURNING id`,
          [email || null, names.first, names.last, names.display]
        );
        technicianId = ins.rows[0].id;
      }
      await client.query(
        `INSERT INTO fieldnation_mapping (fieldnation_provider_id, internal_technician_id)
         VALUES ($1, $2)
         ON CONFLICT (fieldnation_provider_id) DO NOTHING`,
        [providerId, technicianId]
      );
    }

    if (names.first || names.last || names.display) {
      await client.query(
        `UPDATE technicians SET
           first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           display_name = COALESCE($3, display_name),
           updated_at = now()
         WHERE id = $4::uuid`,
        [names.first, names.last, names.display, technicianId]
      );
    }

    await client.query(
      `INSERT INTO job_assignments (job_id, title, scheduled_date, assigned_to_internal_technician_id,
        runbook_version, runbook_json, evidence_requirements, fieldnation_work_order_id, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, 'assigned', now())
       ON CONFLICT (job_id) DO UPDATE SET
         assigned_to_internal_technician_id = EXCLUDED.assigned_to_internal_technician_id,
         runbook_version = COALESCE(EXCLUDED.runbook_version, job_assignments.runbook_version),
         runbook_json = COALESCE(EXCLUDED.runbook_json, job_assignments.runbook_json),
         evidence_requirements = COALESCE(EXCLUDED.evidence_requirements, job_assignments.evidence_requirements),
         fieldnation_work_order_id = COALESCE(EXCLUDED.fieldnation_work_order_id, job_assignments.fieldnation_work_order_id),
         status = 'assigned',
         updated_at = now()`,
      [
        jobId,
        payload.title || payload.workorder?.title || null,
        payload.scheduled_date || null,
        technicianId,
        payload.runbook_version || null,
        JSON.stringify(payload.runbook_json || {}),
        JSON.stringify(payload.evidence_requirements || []),
        woId || null,
      ]
    );

    await client.query(
      `UPDATE webhook_idempotency SET result_status = $1 WHERE idempotency_key = $2`,
      ['ok', String(idempotencyKey)]
    );

    await client.query('COMMIT');

    const namesForNotify = nameParts(payload);
    const provisioningUrlConfigured = Boolean(
      process.env.USER_PROVISIONING_WEBHOOK_URL && String(process.env.USER_PROVISIONING_WEBHOOK_URL).trim()
    );
    const provisioningEligible = shouldCallUserProvisioningWebhook(fieldnationEventType);

    let provisioningSkippedReason = null;
    if (provisioningUrlConfigured && !provisioningEligible) {
      provisioningSkippedReason = fieldnationEventType
        ? `event_type_not_in_allowlist:${fieldnationEventType}`
        : 'missing_event_type';
    }

    if (provisioningUrlConfigured && provisioningEligible) {
      await notifyUserProvisioningIfConfigured(context, {
        fieldnationEventType,
        email: email || null,
        technicianId,
        providerId,
        jobId,
        firstName: namesForNotify.first,
        lastName: namesForNotify.last,
        displayName: namesForNotify.display,
      });
    }

    context.res = {
      status: 200,
      body: {
        status: 'ok',
        job_id: jobId,
        technician_id: technicianId,
        fieldnation_event_type: fieldnationEventType || null,
        provisioning_webhook_configured: provisioningUrlConfigured,
        provisioning_notified: provisioningUrlConfigured && provisioningEligible,
        provisioning_skipped_reason: provisioningSkippedReason,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    context.log.error(e);
    context.res = { status: 500, body: { error: 'server_error' } };
  } finally {
    client.release();
  }
};
