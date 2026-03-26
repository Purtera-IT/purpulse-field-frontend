# Hybrid identity: Entra for technicians only

**Goal:** Keep **Base44** for dispatchers/admins and existing app flows, while **field technicians** sign in with **Microsoft Entra** (External ID / B2C or workforce tenant) and call **Azure Functions** (`/api/me`, `/api/assignments`) with **Entra-issued JWTs**.

**Business rule:** Send an **Entra invitation only** when Field Nation signals a **work order accepted** event and the **`technicians`** row exists (created by the same webhook). Do not invite on unrelated FN events.

---

## Architecture

```mermaid
sequenceDiagram
  participant FN as Field Nation
  participant FA as Azure Function (fieldnation webhook)
  participant PG as Postgres technicians
  participant EH as Entra invite handler (your API)
  participant Graph as Microsoft Graph
  participant Tech as Technician browser (MSAL)

  FN->>FA: POST webhook (event_type=work_order.accepted, ...)
  FA->>PG: upsert technician + job_assignments
  FA->>EH: POST USER_PROVISIONING_WEBHOOK_URL (HMAC), only if event matches
  EH->>PG: SELECT technician by id; skip if idp_subject set or no email
  EH->>Graph: POST /invitations
  EH->>PG: entra_invite_sent_at, entra_object_id
  Tech->>FA: GET /api/me, /api/assignments (Bearer Entra JWT)
```

---

## 1) Field Nation → webhook

- Configure payloads to include an **event type** (e.g. `event_type`, `event`, or `type`) for **work order accepted**.
- Function App env:
  - **`USER_PROVISIONING_WEBHOOK_URL`** — HTTPS endpoint of the invite handler (below).
  - **`USER_PROVISIONING_HMAC_SECRET`** — shared secret for `X-Provisioning-Signature`.
  - **`USER_PROVISIONING_EVENT_TYPES`** — comma-separated allowlist (default: `work_order.accepted,work_order_accepted`). Use `*` to notify on every event (**not** recommended).
  - **`USER_PROVISIONING_ALLOW_MISSING_EVENT_TYPE`** — `true` only if legacy payloads lack event type (weak).

---

## 2) Entra invite handler (PM / API)

Reference implementation: [`examples/backend/entra-technician-invite-handler/`](../../examples/backend/entra-technician-invite-handler/README.md).

- Verifies **HMAC** body signature (same algorithm as the Field Nation Function).
- **`SELECT` from `technicians`** by `internal_technician_id` from the JSON body.
- **Skips** if `idp_subject` already set (user already linked) or `entra_invite_sent_at` is set (idempotent; optional re-invite policy in your code).
- **Skips** if `email` is null.
- Calls **Microsoft Graph** `POST /invitations` (app-only; **User.Invite.All** or guest invite permissions).
- Updates **`entra_invite_sent_at`**, **`entra_object_id`**, clears **`entra_invite_last_error`** on success.

---

## 3) Field app (this repo)

- **Base44** remains default for shell, entities, admin.
- Technicians using Entra set:
  - **`VITE_USE_ENTRA_TOKEN_FOR_AZURE_API=true`**
  - **`VITE_ENTRA_CLIENT_ID`**, **`VITE_ENTRA_TENANT_ID`**, **`VITE_ENTRA_AUTHORITY`** (or tenant-derived authority)
  - **`VITE_ENTRA_API_SCOPE`** — API scope your Functions validate (e.g. `api://<app-id>/access_as_user`)

[`src/lib/entraTechnicianMsal.ts`](../../src/lib/entraTechnicianMsal.ts) acquires tokens; [`src/api/client.ts`](../../src/api/client.ts) uses them for **`getTechnicianMe`** / **`getAssignments`** when the flag is on.

**Technician UI entry:** public route [`/technician-signin`](../../src/pages/TechnicianEntraSignIn.tsx) — “Sign in with Microsoft” calls **`loginEntraTechnicianInteractive()`** (MSAL popup).

### Azure Functions — JWT validation (implemented in repo)

[`examples/backend/azure-functions-option-a/shared/verifyBearer.js`](../../examples/backend/azure-functions-option-a/shared/verifyBearer.js) verifies tokens in this order:

1. **Entra JWKS** if **`ENTRA_TENANT_ID`** (or **`AZURE_TENANT_ID`**) **and** **`ENTRA_AUDIENCE`** (or **`AZURE_API_AUDIENCE`**) are set — uses `https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys` and issuer `https://login.microsoftonline.com/{tenant}/v2.0` (override with **`ENTRA_ISSUER`** for B2C/custom).
2. Else **HS256** with **`AUTH_JWT_SECRET`** (dev/staging).

| App setting | Purpose |
|-------------|---------|
| `ENTRA_TENANT_ID` or `AZURE_TENANT_ID` | Directory id for JWKS + issuer |
| `ENTRA_AUDIENCE` or `AZURE_API_AUDIENCE` | API `aud` claim (e.g. `api://<api-app-id>`) |
| `ENTRA_ISSUER` | Optional issuer override |
| `ENTRA_ADMIN_ROLE_NAME` | App role name for admin bypass on assignments (optional) |
| `AUTH_JWT_SECRET` | Fallback HS256 when Entra vars not set |

Deploy updated **`assignmentsGet`**, **`meGet`**, **`shared/`**, and run **`npm install`** (adds **`jose`**) in the Function App artifact.

---

## 4) Linking `technicians.idp_subject`

After first Entra sign-in, set **`technicians.idp_subject`** = token **`sub`** (or **`oid`**) so **`GET /api/me`** resolves by subject. Options:

- **Invitation redemption** callback / your PM job updates Postgres.
- **First successful `/api/me`** with email match: optional backend migration endpoint (not in this repo by default).

---

## Postgres

Apply [`003_technicians_entra_hybrid.sql`](../../scripts/sql/003_technicians_entra_hybrid.sql) (or a fresh [`001`](../../scripts/sql/001_create_technicians_and_assignments.sql)) on the same database the Functions use.

**Azure CLI + workstation:** firewall for your IP and `ENTRA_TENANT_ID` on the test Function App were applied via CLI (see [`scripts/azure/README.md`](../../scripts/azure/README.md)). Run the migration with admin password:

```bash
export PGPASSWORD='<admin-password>'
./scripts/azure/apply-migration-003-test.sh
```

Or: `psql "$DATABASE_URL" -f scripts/sql/003_technicians_entra_hybrid.sql` when you have a connection string.

## Related

- [`fieldnation-webhook-user-provisioning.md`](fieldnation-webhook-user-provisioning.md)
- [`option-a-azure-ops-playbook.md`](option-a-azure-ops-playbook.md)
