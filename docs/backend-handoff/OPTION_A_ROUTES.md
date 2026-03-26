# Option A — backend API contract (purpulse-test-api-eus2)

Implement in the **repository that deploys** `purpulse-test-api-eus2`. This field app repo only consumes **`GET /api/assignments`** when `VITE_USE_ASSIGNMENTS_API=true`.

**Source of truth (PurPulse PM):** Work orders, technicians, runbook templates, and **`job_runbook_instances`** live in **PurPulse Postgres** (Supabase). The Field Nation webhook worker must use the **same `DATABASE_URL`** as the API that serves `/api/me` and `/api/assignments`. See PurPulse repo: `docs/source-of-truth-database.md`.

**Reference implementation (Vite dev API):** `purpulse.app/src/server/routes/fieldTechnician.ts` + `purpulse.app/src/server/lib/fieldTechnicianAuth.ts`.

## Environment

- `DATABASE_URL` — PurPulse Postgres; includes `work_orders`, `technicians`, `artifact_versions`, **`job_runbook_instances`** (migration `20260327120000_job_runbook_instances.sql` in purpulse.app). Legacy Option A isolated DDL ([`scripts/sql/001_create_technicians_and_assignments.sql`](../../scripts/sql/001_create_technicians_and_assignments.sql)) applies only if you still run a **separate** Azure-only DB — avoid split-DB without replication (see source-of-truth doc).
- Field Nation signing secret — Key Vault, referenced from Function App settings.
- **Portable verifier (merge into API repo):** [`azure-function-api/shared/signature.js`](../../azure-function-api/shared/signature.js) implements **`X-FN-Signature: sha256=…`** (current Field Nation), plus legacy **`X-Signature`** and **`Fn-Hash`** when the newer header is absent. See [`azure-function-api/README.md`](../../azure-function-api/README.md). This repo’s root is ESM (`"type": "module"`); that folder includes a **`package.json`** with `"type": "commonjs"` so `require()` works.
- **JWT for `GET /api/me` and `GET /api/assignments`:** **Entra JWKS** when `ENTRA_TENANT_ID` + `ENTRA_AUDIENCE` are set; optional **`ENTRA_ISSUER`** (default `https://login.microsoftonline.com/<tenant>/v2.0`); otherwise **`AUTH_JWT_SECRET`** (HS256) for dev/staging. Same rules as [`examples/backend/azure-functions-option-a/shared/verifyBearer.js`](../../examples/backend/azure-functions-option-a/shared/verifyBearer.js) and `purpulse.app/src/server/lib/fieldTechnicianAuth.ts` (`jose` + HS256 fallback).

| Variable | Purpose |
| -------- | ------- |
| `ENTRA_TENANT_ID` | Azure AD tenant |
| `ENTRA_AUDIENCE` | API audience (app id URI or client id) |
| `ENTRA_ISSUER` | Optional issuer override |
| `AUTH_JWT_SECRET` | HS256 fallback when Entra env not set |

## Routes

### `POST /api/webhooks/fieldnation`

Deployed test app **`purpulse-test-api-eus2`** uses this path (Azure route `webhooks/fieldnation`). Validate using the **raw body** only; prefer **`verifyFieldNationWebhook`** in [`azure-function-api/shared/signature.js`](../../azure-function-api/shared/signature.js) so **`X-FN-Signature`** matches [Field Nation DX](https://developer.fieldnation.com/docs/webhooks/concepts/payload-structure/). Older handlers that only checked **`X-Signature`** / **`Fn-Hash`** must be extended or Field Nation will keep returning **401**.

- Idempotency: **`X-FN-Delivery-Id`** (preferred), `X-Idempotency-Key`, or payload fields → `webhook_idempotency` table.
- Upsert `fieldnation_mapping` and `technicians`; upsert `job_assignments` (or `jobs` if using ALTER path).

See [`examples/webhooks/fieldnation_webhook_handler.md`](../../examples/webhooks/fieldnation_webhook_handler.md).

### `GET /api/me`

**Auth:** Bearer JWT.

**Response (200):** maps the token to a `technicians` row by **`idp_subject` = JWT `sub`** (preferred) or **`technicians.email`** matching the email claim (`email`, `emails`, `preferred_username`, `upn`).

```json
{
  "internal_technician_id": "technician_uid_from_public_technicians",
  "email": "user@example.com",
  "first_name": "Pat",
  "last_name": "Smith",
  "display_name": "Pat Smith",
  "fieldnation_provider_id": "12345"
}
```

`internal_technician_id` is **`technicians.technician_uid`** (text PK), not necessarily a UUID.

**404:** no matching technician (e.g. webhook has not provisioned the row yet).

### `GET /api/assignments`

**Query:** `assigned_to=<technician_uid>` — must equal `internal_technician_id` from `/api/me` for that token.

**Response (200):**

```json
{
  "assignments": [
    {
      "job_id": "string",
      "title": "string",
      "scheduled_date": "2026-03-26",
      "status": "scheduled",
      "fieldnation_workorder_id": 92022,
      "runbook_version": "artifact_version_uuid_or_none",
      "runbook_json": {},
      "evidence_requirements": [],
      "project_name": "string",
      "site_name": "string",
      "debug": {
        "materialized_at": "2026-03-26T12:00:00.000Z",
        "snapshot_source": "webhook_pickup",
        "idempotency_key": "fn:92022:abc…",
        "reason_code": null,
        "work_order_status": "dispatched",
        "has_runbook_metadata": true
      }
    }
  ]
}
```

`debug.reason_code` may be `no_runbook_instance_yet` when the row is waiting on webhook materialization.

### `runbook_json` shape (`runbook_v2` technician snapshot)

Materialization (Field Nation webhook → `job_runbook_instances.runbook_snapshot_jsonb`) stores a **normalized, field-ready** JSON document, not raw PM authoring:

- **`schema`: `"runbook_v2"`** — technician-facing snapshot (includes **`assignment_context`**, **`program_context`**, **`execution`**, optional **`render_hints`**).
- PM may still save **`runbook_v1`** authoring in `artifact_versions`; the worker runs **`normalizeAuthoringToRunbookV2Snapshot`** before insert. Spec: PurPulse `purpulse.app/docs/schemas/runbook_v2.md` (and `examples/runbook_v2.example.json`).
- **Immutable vs mutable:** the snapshot defines steps, gates, and evidence **expectations**; step **completion**, uploads, and QC outcomes live on the **job** / execution state and are merged in the field app by **stable step ids** (see [`src/lib/runbook/runbookV2Snapshot.ts`](../../src/lib/runbook/runbookV2Snapshot.ts) — `parseRunbookJsonFromAssignment`, `mergeRunbookV2WithJobPhases`).
- **Large binaries** (PDFs, floor plans): **not** inlined in JSON; use attachment URIs (e.g. Azure Blob SAS) inside the snapshot. JSON-in-Postgres is the source of truth for structure; Blob is for bytes only.

**Auth:** Bearer JWT; **authorize** so callers only read rows for their own `assigned_to` (or admin role).

### Optional

- `POST /api/technicians` — provision internal row + IdP invite.
- `GET /api/jobs/{id}` — include assignment fields if unified.

## Reconciliation (missing runbook snapshot)

- **SQL report:** PurPulse `scripts/sql/reconcile_job_runbook_instances.sql` — lists work orders with a Field Nation id + assigned technician but no `job_runbook_instances` row (run after deploy or on a schedule).
- **Backfill inserts:** PurPulse `scripts/reconcile-job-runbook-snapshots.cjs` — reads `artifact_versions` / work order metadata, normalizes with `azure-function-api/shared/normalizeRunbookSnapshot.js`, inserts `job_runbook_instances` with `snapshot_source: 'reconciliation'`. Supports `--dry-run`. Requires `DATABASE_URL` (same PurPulse Postgres as the API).

### Azure host verification (CLI)

Before debugging JWTs, confirm the Function App is healthy: [`scripts/azure/verify-purpulse-api-host.sh`](../../scripts/azure/verify-purpulse-api-host.sh) — `npm run verify:azure-api-host` (requires `az login`). Prints `DATABASE_URL` presence, proxy route template, and HTTP probes for `/api/me` and `/api/data/planning/display`.

### Operational smoke script (field app repo)

Repeatable checks against a **deployed** API (real JWT). Implemented as `scripts/smoke-technician-assignments-api.mjs`; run:

```bash
cd purpulse-fieldapp
export PURPULSE_API_BASE_URL=https://your-deployed-api.example.com
export PURPULSE_API_BEARER_TOKEN="<JWT from Entra or dev HS256>"
# optional:
# export EXPECTED_TECHNICIAN_EMAIL=tech@company.com
# export EXPECTED_TECHNICIAN_ID=<technicians.technician_uid>  # must match internal_technician_id
# export MIN_ASSIGNMENT_COUNT=2
# export REQUIRE_RUNBOOK=true
# export DUMP_RAW=true   # print full /api/me and /api/assignments JSON

npm run smoke:technician-assignments-api
```

**Env aliases:** `AZURE_API_BASE_URL` for `PURPULSE_API_BASE_URL`; `BEARER_TOKEN` for `PURPULSE_API_BEARER_TOKEN`.

**Auth assumption:** the token must be acceptable to the same verifier as production (`Authorization: Bearer <token>`). For Entra, use an access token for the API app registration audience; for local dev, HS256 signed with `AUTH_JWT_SECRET` if configured.

Exits **non-zero** if `/api/me` fails, `internal_technician_id` is missing, `/api/assignments` fails, assignment objects fail shape checks, `EXPECTED_TECHNICIAN_EMAIL` / `EXPECTED_TECHNICIAN_ID` do not match, `MIN_ASSIGNMENT_COUNT` is not met, or `REQUIRE_RUNBOOK=true` but no assignment has non-empty `runbook_json`.

### Manual E2E checklist (field app)

1. Set `VITE_USE_ASSIGNMENTS_API=true`, `VITE_AZURE_API_BASE_URL=<origin serving /api/me>`, and (if using Entra for the API) `VITE_USE_ENTRA_TOKEN_FOR_AZURE_API=true` plus MSAL env from `TechnicianEntraSignIn` / app registration.
2. Sign in as a technician with `idp_subject` / email matching `technicians` in Postgres.
3. Call **`GET /api/me`** — expect `200` with `internal_technician_id`.
4. Call **`GET /api/assignments?assigned_to=<that id>`** — expect one row per open assignment; each row should include `runbook_json` when materialized, or `debug.reason_code` explaining gaps (`no_runbook_instance_yet`, `no_runbook_artifact_version_in_metadata`, etc.).
5. Open the field app **Jobs** screen — React Query key `['field-jobs','purpulse']` when assignments mode is on; list should mirror `/api/assignments` (not Base44).
6. Open a job runbook — steps render from `runbook_json` (`runbook_v2`); completion persists to Dexie when `assignment_source === 'purpulse_api'`.

## Client consumer

Set **`VITE_AZURE_API_BASE_URL`** to the API origin that serves `/api/me` (e.g. local Vite dev `http://localhost:5173` or deployed Function App URL).

[`src/api/client.ts`](../../src/api/client.ts) — `getTechnicianMe()`, `getResolvedAssignmentsForCurrentUser()`, and `getAssignments(assignedToInternalId)` use `fetch` + **`getBearerTokenForAzureApi()`** (Entra MSAL when `VITE_USE_ENTRA_TOKEN_FOR_AZURE_API=true`, else Base44 `authManager`). After login, [`AuthContext`](../../src/lib/AuthContext.jsx) loads `azureTechnicianProfile` when `VITE_USE_ASSIGNMENTS_API=true`. Technicians can open **`/technician-signin`** for MSAL popup ([`TechnicianEntraSignIn.tsx`](../../src/pages/TechnicianEntraSignIn.tsx)).
