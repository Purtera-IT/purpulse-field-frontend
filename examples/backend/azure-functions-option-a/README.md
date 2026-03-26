# Azure Functions boilerplate — Option A (webhook + assignments)

**Not wired into CI from this repo.** Copy the `functions/` folder, `host.json`, and merge `package.snippet.json` into the repository that builds **`purpulse-test-api-eus2`**. Also copy **[`azure-function-api/shared/signature.js`](../../azure-function-api/shared/signature.js)** (and its `package.json` if your API repo root is `"type": "module"`) into your API’s `azure-function-api/shared/` — that is the **live-aligned** verifier (`X-FN-Signature`, legacy `X-Signature` / `Fn-Hash`). Then:

1. `npm install pg` (or use your existing DB layer).
2. Set app settings: `DATABASE_URL` **or** `PG_CONN`; `FIELDNATION_WEBHOOK_SECRET` **or** `FN_WEBHOOK_SECRET` — **must match the secret configured on the Field Nation webhook** (or Key Vault reference); `AUTH_JWT_SECRET` for `assignmentsGet`.
3. **Field Nation signing:** `shared/fieldnationSignature.js` implements the official contract: header **`X-FN-Signature: sha256=<hex>`**, HMAC-SHA256 over the **raw** HTTP body bytes. The handler **must** receive the raw body (re-stringifying JSON will not match). If you use the **Azure Functions v3** programming model and `req.body` is only a parsed object, upgrade to the **v4** model and use `await request.text()` for verification, or otherwise ensure the runtime exposes the raw buffer (see [Field Nation payload structure](https://developer.fieldnation.com/docs/webhooks/concepts/payload-structure/)).
4. Align JWT validation with your existing API — the snippet uses HS256 + `AUTH_JWT_SECRET`; override or replace if your API differs.

Full contract: [`docs/backend-handoff/OPTION_A_ROUTES.md`](../../../docs/backend-handoff/OPTION_A_ROUTES.md).

## Routes (HTTP)

| File | Method | Route | Full URL prefix |
|------|--------|-------|-----------------|
| `fieldnationWebhook` | POST | `webhooks/fieldnation` | `{FUNCTION_APP_URL}/api/webhooks/fieldnation` |
| `meGet` | GET | `me` | `{FUNCTION_APP_URL}/api/me` |
| `assignmentsGet` | GET | `assignments` | `{FUNCTION_APP_URL}/api/assignments` |

Azure prepends `/api/` automatically for HTTP triggers.

## Database

Must match [`scripts/sql/001_create_technicians_and_assignments.sql`](../../../scripts/sql/001_create_technicians_and_assignments.sql): `technicians`, `fieldnation_mapping`, `job_assignments`, `webhook_idempotency`.

## Optional: auto-invite field app users (Base44) after FN webhook

The webhook **only** writes Postgres (`technicians`, `job_assignments`, …). **Base44 accounts** are separate; admins can invite via the field app UI (`inviteUser`), or you can set:

| App setting | Purpose |
|-------------|---------|
| `USER_PROVISIONING_WEBHOOK_URL` | HTTPS URL of **your** PM/API service to receive a POST after each successful job-accept commit |
| `USER_PROVISIONING_HMAC_SECRET` | Optional shared secret; request body is signed as `X-Provisioning-Signature: sha256=<hex>` |
| `USER_PROVISIONING_EVENT_TYPES` | Comma-separated allowlist (defaults include `work_order.accepted`, `workorder.status.assigned`, …). Use `*` for all events. |
| `USER_PROVISIONING_ALLOW_MISSING_EVENT_TYPE` | `true` = notify even if FN payload has no `event_type` / `event` (legacy only). |

Your service validates the signature and calls **Base44 invite** (or Entra) with credentials stored **there**, not in this Function.

See [`docs/plans/fieldnation-webhook-user-provisioning.md`](../../../docs/plans/fieldnation-webhook-user-provisioning.md).

## Security

- Do not commit secrets.
- Use parameterized queries only (included).
- Rate-limit webhook by IP in production.

## Assignments auth

`assignmentsGet` compares query `assigned_to` to the JWT claim named by `JWT_TECHNICIAN_CLAIM` (default `sub`). **Entra:** `ENTRA_ADMIN_ROLE_NAME` in `roles[]` grants admin read. **HS256:** `role: "admin"` in payload.

## JWT verification (`shared/verifyBearer.js`)

| Mode | When |
|------|------|
| **Entra JWKS** | `ENTRA_TENANT_ID` (or `AZURE_TENANT_ID`) **and** `ENTRA_AUDIENCE` (or `AZURE_API_AUDIENCE`) set |
| **HS256** | Else `AUTH_JWT_SECRET` |

Dependencies: **`jose`**, **`pg`** — see root `package.json` in this folder.
