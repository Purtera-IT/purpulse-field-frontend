/**
 * Field Nation HTTP webhook — **merge signature checks** into your live handler.
 *
 * This file is a **minimal** reference: verify raw body + parse JSON + 200.
 * Production code on purpulse.app should keep your DB logic (`webhook_events_raw`, etc.)
 * and replace only the signature block with `../shared/signature.js` (`verifyFieldNationWebhook`).
 *
 * Route: `webhooks/fieldnation` → POST /api/webhooks/fieldnation
 */
'use strict';

const { getRawBodyBuffer, verifyFieldNationWebhook } = require('../shared/signature');

module.exports = async function fieldnationWebhook(context, req) {
  const secret = process.env.FIELDNATION_WEBHOOK_SECRET || process.env.FN_WEBHOOK_SECRET;
  const rawBuf = getRawBodyBuffer(req);

  if (secret) {
    if (!rawBuf) {
      context.res = {
        status: 401,
        body: {
          error: 'invalid_signature',
          detail:
            'raw_body_required — Field Nation HMAC is over exact request bytes; enable raw body (e.g. Functions v4 request.text()).',
        },
      };
      return;
    }
    const { ok, method } = verifyFieldNationWebhook(rawBuf, secret, req.headers);
    if (!ok) {
      context.res = { status: 401, body: { error: 'invalid_signature' } };
      return;
    }
    context.log.info(`[fieldnation-webhook] signature ok via ${method || 'none'}`);
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
  } catch {
    context.res = { status: 400, body: { error: 'invalid_json' } };
    return;
  }

  context.res = {
    status: 200,
    body: { ok: true, event: payload.event?.name || null },
  };
};
