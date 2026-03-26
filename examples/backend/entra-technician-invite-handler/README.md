# Entra technician invite handler (hybrid)

Small **Node 18+** HTTP service that:

1. Accepts **`POST /`** or **`POST /provision`** with the same JSON body the Field Nation Function sends to **`USER_PROVISIONING_WEBHOOK_URL`**.
2. Verifies **`X-Provisioning-Signature: sha256=<hex>`** (HMAC-SHA256 over raw body, same secret as **`USER_PROVISIONING_HMAC_SECRET`** on the Function).
3. Invites only when **`fieldnation_event_type`** matches **`ACCEPT_EVENT_TYPES`** (default: work order accepted — aligned with [`fieldnationWebhook`](../azure-functions-option-a/functions/fieldnationWebhook/index.js)).
4. **`SELECT` from `technicians`** by **`internal_technician_id`**; skips if **`idp_subject`** is set or invite already sent (unless **`ALLOW_REPEAT_INVITE=true`**).
5. Calls **Microsoft Graph** **`POST /invitations`** using **client credentials**.
6. Updates **`entra_invite_sent_at`**, **`entra_object_id`**, **`entra_invite_last_error`**.

Copy into your **API / PM repo** or run as a separate App Service. **Use HTTPS** in production.

## App registration (Entra)

- Register an app in the tenant used for technicians.
- Add a **client secret** (or certificate).
- **Application** API permissions: **`User.Invite.All`** (or the minimum your tenant allows for guest invitation) — admin consent.
- Redirect URL **`GRAPH_INVITE_REDIRECT_URL`** must match a registered redirect URI for your SPA / My Apps (often your field app or `https://myapps.microsoft.com`).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` or `PG_CONN` | Yes | Same Postgres as `technicians` |
| `USER_PROVISIONING_HMAC_SECRET` | Recommended | Must match Function App |
| `AZURE_TENANT_ID` | Yes | Directory tenant id |
| `AZURE_CLIENT_ID` | Yes | App registration client id |
| `AZURE_CLIENT_SECRET` | Yes | Client secret |
| `GRAPH_INVITE_REDIRECT_URL` | Yes | Invitation redemption landing URL |
| `ACCEPT_EVENT_TYPES` | No | Default `work_order.accepted,work_order_accepted` |
| `ALLOW_REPEAT_INVITE` | No | Set `true` to invite again if `entra_invite_sent_at` is set |
| `PORT` | No | Default `8787` |

## Run locally

```bash
cd examples/backend/entra-technician-invite-handler
npm install
export DATABASE_URL="postgresql://..."
export USER_PROVISIONING_HMAC_SECRET="same-as-function"
export AZURE_TENANT_ID=...
export AZURE_CLIENT_ID=...
export AZURE_CLIENT_SECRET=...
export GRAPH_INVITE_REDIRECT_URL=https://your-field-app.azurewebsites.net
node server.js
```

Point **`USER_PROVISIONING_WEBHOOK_URL`** on **`purpulse-test-api-eus2`** to `https://<your-host>/provision` (HTTPS).

## Field Nation Function app settings

Set on the Function App (same resource group pattern as other docs):

- `USER_PROVISIONING_WEBHOOK_URL` = this service URL  
- `USER_PROVISIONING_HMAC_SECRET` = shared secret  
- `USER_PROVISIONING_EVENT_TYPES` = align with FN payloads (default allowlist is work-order accepted only)

See [`docs/plans/hybrid-entra-technicians.md`](../../../docs/plans/hybrid-entra-technicians.md).
