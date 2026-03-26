# Field Nation webhook → field app user account

**Hybrid Entra (technicians only):** see [`hybrid-entra-technicians.md`](hybrid-entra-technicians.md) and [`examples/backend/entra-technician-invite-handler/README.md`](../../examples/backend/entra-technician-invite-handler/README.md).

## Two different “users”

| Layer | What happens today | Purpose |
|--------|-------------------|---------|
| **Azure Postgres** (`technicians`, `fieldnation_mapping`, `job_assignments`) | Created/updated by **`POST /api/webhooks/fieldnation`** | Internal UUID, FN id, email, runbook payload for **`GET /api/assignments`** and **`GET /api/me`**. |
| **Field app login** (Base44) | **Not** created by the Postgres webhook alone | Sign-in, sessions, roles — users are invited or self-register through Base44. |

So: **the hook already “registers” the technician in your Azure DB.** It does **not** by itself create a **Base44 account**. That requires an **invite** (or equivalent) against Base44’s identity layer.

## How invites work in this repo

Admins can invite from the UI:

```36:36:src/pages/AdminUsers.jsx
      await base44.users.inviteUser(email.trim(), role);
```

That uses the **Base44 SDK** with an **authenticated admin** session. Server-side automation needs either:

1. **A backend you control** (PM console, API app) that holds **Base44 admin credentials / API** and calls the same capability, or  
2. **Microsoft Entra ID B2C** (or similar) if you later move auth off Base44 — invite via **Graph**, then store **`idp_subject`** on `technicians`.

## Recommended pattern: optional “provisioning webhook” from Azure

After the Field Nation handler **commits** the DB transaction, the Function can **POST** to an **internal HTTPS URL** you implement (e.g. on your project management API):

- **Payload:** `email`, `internal_technician_id`, `fieldnation_provider_id`, `job_id`, event name.  
- **Auth:** shared secret **HMAC** header (or API key) — never expose Base44 secrets inside the Field Nation Function.

**Your PM service** then:

1. Validates the signature.  
2. Calls **Base44 invite** (or your user-provisioning API) **once per email** (idempotent: “already invited” OK).  
3. Optionally assigns role `technician`.

This keeps **Field Nation ↔ Azure** simple and puts **Base44 credentials** only in the PM / identity service.

Boilerplate support: **`USER_PROVISIONING_WEBHOOK_URL`** + optional **`USER_PROVISIONING_HMAC_SECRET`** in [`examples/backend/azure-functions-option-a/functions/fieldnationWebhook/index.js`](../../examples/backend/azure-functions-option-a/functions/fieldnationWebhook/index.js).

## Demo (PurTeraIT provider)

1. Ensure **`provider1@test-pureteraitprovider.com`** exists on `technicians` (webhook or [`scripts/sql/examples/seed_purterait_provider1.sql`](../../scripts/sql/examples/seed_purterait_provider1.sql)).  
2. **Invite** that email in Base44 (Admin Users) **or** implement the PM provisioning URL and trigger it from the Function.  
3. User accepts invite, logs in with the **same email** → **`GET /api/me`** resolves the row → assignments/runbook line up.

## If you must call Base44 from Azure Functions directly

Possible only if Base44 documents a **server-side** invite API and you store **short-lived** credentials in Key Vault. Prefer the **PM webhook** indirection above for separation of duties and easier rotation.

---

## Can we avoid Base44 for login / invites? Is that better?

**Yes, you can use something that isn’t Base44** — typically **Microsoft Entra ID** (workforce tenant) or **Entra External ID** (B2C-style consumer/technician login). Many teams find that **better** for this stack because:

| Topic | Base44 auth | Entra (or similar IdP) |
|--------|-------------|-------------------------|
| **Alignment** | Separate BaaS vendor | Same ecosystem as **Azure** Functions, Postgres, Key Vault, App Insights |
| **Enterprise / compliance** | Depends on Base44’s posture | **Familiar** to IT: conditional access, MFA, audit, DLP-style patterns |
| **Invites** | `inviteUser` / vendor flow | **Microsoft Graph** `invite` / self-service sign-up policies — **no Base44** in the path |
| **Link to `technicians`** | Match **email** or custom claim | Store **`idp_subject`** = Entra **`sub`/`oid`** on `technicians` (already in DDL) |

Your **Field Nation webhook + Postgres** path stays the same. What changes is **only the app’s login layer**: replace Base44 auth with **MSAL** (or similar) and validate **JWTs from Entra** on **`GET /api/me`** / **`GET /api/assignments`** (your Functions already assume Bearer tokens; production should use **JWKS**, not long-lived HS256 secrets).

**Tradeoff:** This repo’s UI and data paths are **tightly coupled to Base44** today (`base44.auth`, `base44.entities.*`). Moving **off** Base44 is a **real product/engineering project** (auth swap, entity APIs, migration), not a toggle. A **hybrid** phase is common: keep Base44 for legacy screens while **new** technician flows use **Entra + Azure API** only.

**Practical “no Base44” provisioning flow**

1. Webhook commits **`technicians`** (+ optional **`USER_PROVISIONING_WEBHOOK_URL`**).  
2. PM service (or Azure Automation) calls **Graph** to invite the technician email into **Entra**.  
3. On first sign-in, backfill **`technicians.idp_subject`** (or map in **`GET /api/me`** by email until `idp_subject` is set).  
4. Field app uses **Entra tokens** for Azure APIs — **no Base44 account** required for that path.
