# `azure-function-api` — portable Field Nation webhook helpers

This folder mirrors the layout used in the **purpulse.app API** repository (`azure-function-api/shared/signature.js`, `fieldnation-webhook/index.js`). The field app repo does not deploy this Function; copy or merge these files into your API repo and redeploy.

## Signature verification (`shared/signature.js`)

Validates the **raw** HTTP body (never re-stringified JSON).

| Header | Behavior |
|--------|----------|
| **`X-FN-Signature`** | If present and non-empty: `sha256=<hex>` only — HMAC-SHA256(secret, rawBody). **Field Nation DX / current.** |
| **`X-Signature`** | Used only when `X-FN-Signature` is absent: 64-char hex HMAC-SHA256, or `sha256=<hex>`. |
| **`Fn-Hash`** | Used when neither of the above: legacy MD5 hex of `secret + bodyUTF8`. |

Priority avoids downgrade: if Field Nation sends `X-FN-Signature`, legacy headers are ignored.

## Live merge (fast path)

1. Replace **`azure-function-api/shared/signature.js`** in the API repo with this file (or merge exports).
2. In **`fieldnation-webhook/index.js`**, after reading raw body, call:

   ```javascript
   const { verifyFieldNationWebhook } = require('../shared/signature');
   const { ok, method } = verifyFieldNationWebhook(rawBuf, secret, req.headers);
   if (!ok) return 401;
   ```

3. Ensure **`FIELDNATION_WEBHOOK_SECRET`** matches the secret configured on the Field Nation webhook.
4. Redeploy the Function App.

## Option A boilerplate in this repo

[`examples/backend/azure-functions-option-a`](../examples/backend/azure-functions-option-a) re-exports `shared/fieldnationSignature.js` from **`azure-function-api/shared/signature.js`** so both stay aligned.
