# Option A — Azure / backend / ops playbook

Hand this to a backend or platform engineer to finish Option A after the repo DDL and Functions boilerplate are in place. **Do not paste secrets into tickets.** Prefer Key Vault references and redacted CLI output.

**Canonical names in this repo:** tables `technicians`, `fieldnation_mapping`, `job_assignments`, `webhook_idempotency` — see [`scripts/sql/001_create_technicians_and_assignments.sql`](../../scripts/sql/001_create_technicians_and_assignments.sql). Internal technician UUID is **`technicians.id`** (referenced as `internal_technician_id` only inside `fieldnation_mapping`).

**Boilerplate env:** DB connection uses **`DATABASE_URL`** or **`PG_CONN`**. Field Nation signing uses **`FIELDNATION_WEBHOOK_SECRET`** or **`FN_WEBHOOK_SECRET`**. See [`examples/backend/azure-functions-option-a/README.md`](../../examples/backend/azure-functions-option-a/README.md).

**Resources (test):** resource group `purpulse-test-rg`, Postgres `purpulse-test-pg-eus2`, **Function App** `purpulse-test-api-eus2`, Web App `purpulse-test-app-eus2`. Prefer API base URL **`https://api-test.purpulse.app`** for the field client; `*.azurewebsites.net` still works if that is what is deployed.

---

## Summary checklist

1. Apply DDL to `purpulse-test-pg-eus2`.
2. Provision Key Vault secrets: `AUTH_JWT_SECRET` (or JWKS path in production), Field Nation webhook secret, Postgres connection string, ingestion key if required.
3. Deploy Function code to `purpulse-test-api-eus2`.
4. Set Function App settings (Key Vault references or direct values for test only).
5. Restart the Function App.
6. Configure Field Nation webhook (URL + secret).
7. Run smoke tests (curl + SQL + client login).
8. Verify telemetry ingestion for a test `runbook_step` (or equivalent) event.
9. Roll back if needed.

---

## 1) Apply DDL to staging Postgres

**File:** [`scripts/sql/001_create_technicians_and_assignments.sql`](../../scripts/sql/001_create_technicians_and_assignments.sql)

**Run with psql** (machine with network access and firewall rules allowing the client):

```bash
export PGPASSWORD="<PG_ADMIN_PASSWORD>"
psql "host=<server>.postgres.database.azure.com port=5432 user=<admin_user>@<server> dbname=<db>" \
  -c "SELECT version();"
psql "host=<server>.postgres.database.azure.com port=5432 user=<admin_user>@<server> dbname=<db>" \
  -f scripts/sql/001_create_technicians_and_assignments.sql
```

**Verify:**

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('technicians', 'fieldnation_mapping', 'job_assignments', 'webhook_idempotency');

SELECT * FROM technicians LIMIT 5;
SELECT * FROM job_assignments LIMIT 5;
```

For repeatable deploys, run the same script from a migration pipeline (Flyway, Liquibase, CI job).

---

## 2) Key Vault and Function App settings

**Typical secrets:**

| Purpose | Suggested Key Vault name | App setting name |
|--------|---------------------------|------------------|
| JWT HS256 (staging) | `AUTH_JWT_SECRET` | `AUTH_JWT_SECRET` |
| Field Nation webhook | `FN_WEBHOOK_SECRET` or `FIELDNATION_WEBHOOK_SECRET` | `FIELDNATION_WEBHOOK_SECRET` or `FN_WEBHOOK_SECRET` |
| Postgres | `PG_CONN` or `DATABASE_URL` | `DATABASE_URL` or `PG_CONN` |
| Telemetry ingest | `INGESTION_API_KEY` | if your ingest requires it |

**Example — store secrets:**

```bash
az keyvault secret set --vault-name purpulse-test-kv --name AUTH_JWT_SECRET --value "<redacted>"
az keyvault secret set --vault-name purpulse-test-kv --name FN_WEBHOOK_SECRET --value "<redacted>"
az keyvault secret set --vault-name purpulse-test-kv --name PG_CONN --value "<postgres-connection-string>"
```

**Example — Function App settings with Key Vault references** (managed identity must have `get` on secrets):

```bash
az functionapp config appsettings set -g purpulse-test-rg -n purpulse-test-api-eus2 \
  --settings \
    AUTH_JWT_SECRET="@Microsoft.KeyVault(VaultName=purpulse-test-kv;SecretName=AUTH_JWT_SECRET)" \
    FIELDNATION_WEBHOOK_SECRET="@Microsoft.KeyVault(VaultName=purpulse-test-kv;SecretName=FN_WEBHOOK_SECRET)" \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=purpulse-test-kv;SecretName=PG_CONN)"
```

**Test-only (no Key Vault):**

```bash
az functionapp config appsettings set -g purpulse-test-rg -n purpulse-test-api-eus2 \
  --settings AUTH_JWT_SECRET="<secret>" FIELDNATION_WEBHOOK_SECRET="<secret>" DATABASE_URL="<conn>"
```

**Restart:**

```bash
az functionapp restart -g purpulse-test-rg -n purpulse-test-api-eus2
```

Use **`az functionapp`** (not `az webapp`) for a Function App’s settings and restart.

---

## 3) Deploy Functions code

- **Zip deploy (quick):** package the built Function App (from your API repo after copying boilerplate from [`examples/backend/azure-functions-option-a/`](../../examples/backend/azure-functions-option-a/)), then deploy with your team’s standard path (`az functionapp deployment` / GitHub Actions / Azure DevOps).

- **CI (recommended):** push to the backend repo and use existing pipelines.

**Sanity check:**

```bash
az functionapp show -g purpulse-test-rg -n purpulse-test-api-eus2 \
  --query "{name:name,state:state,defaultHostName:defaultHostName}" -o table
```

**Logs:** stream from the Function App (portal) or:

```bash
az webapp log tail -g purpulse-test-rg -n purpulse-test-api-eus2
```

(`az webapp log tail` applies to Function Apps hosted on App Service.)

---

## 4) Front-end staging (Vite build env)

Set at **build time** (pipeline variables or App Service build settings), not only as runtime app settings for a static site unless your hosting injects them:

| Variable | Example |
|----------|---------|
| `VITE_USE_ASSIGNMENTS_API` | `true` |
| `VITE_AZURE_API_BASE_URL` | `https://api-test.purpulse.app` |
| `VITE_TELEMETRY_INGESTION_URL` | Staging ingest URL — confirm path with backend |

Example if your Web App uses application settings that a build step reads:

```bash
az webapp config appsettings set -g purpulse-test-rg -n purpulse-test-app-eus2 \
  --settings VITE_USE_ASSIGNMENTS_API=true \
             VITE_AZURE_API_BASE_URL="https://api-test.purpulse.app" \
             VITE_TELEMETRY_INGESTION_URL="https://<your-staging-ingest-host>/..."
az webapp restart -g purpulse-test-rg -n purpulse-test-app-eus2
```

Rebuild the SPA after changing Vite env vars.

---

## 5) Field Nation webhook (sandbox)

- **URL:** `https://api-test.purpulse.app/api/webhooks/fieldnation` (or `https://purpulse-test-api-eus2.azurewebsites.net/api/webhooks/fieldnation`)
- **Secret:** same value as `FIELDNATION_WEBHOOK_SECRET` / Key Vault
- **Events:** align with [`examples/webhooks/fieldnation_webhook_handler.md`](../../examples/webhooks/fieldnation_webhook_handler.md)

**Archives:** Test and prod use **different** storage accounts for the `webhooks` blob container; validating ingestion requires checking the account tied to **that** environment (do not infer prod from test-only listings). See [`webhook-blob-archives-test-vs-prod.md`](webhook-blob-archives-test-vs-prod.md).

Replace the boilerplate **`verifySignaturePlaceholder`** with Field Nation’s real HMAC verification before production.

---

## 6) IdP / JWT

| Topic | Guidance |
|-------|----------|
| Staging | HS256 + `AUTH_JWT_SECRET` matches the assignments boilerplate. |
| Production | Prefer **RS256 + JWKS** from your IdP; replace the HS256 verifier in `assignmentsGet` with JWKS validation. |
| Claims | Assignments handler compares `assigned_to` to claim `JWT_TECHNICIAN_CLAIM` (default `sub`) or allows `role: "admin"`. Map **`technicians.id`** into the claim your API checks. |

---

## 7) Smoke tests

### A) Webhook (must include idempotency)

The handler requires **`X-Idempotency-Key`** (or `webhook_event_id` / `work_order_id` in the body). Example:

```bash
curl -sS -X POST "https://api-test.purpulse.app/api/webhooks/fieldnation" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: smoke-$(date +%s)" \
  -H "X-FN-Signature: placeholder" \
  -d '{
    "fieldnation_provider_id": "fnpr-555",
    "external_ref": "job-abc-123",
    "provider_email": "tech@example.com",
    "work_order_id": "fn-987",
    "title": "Smoke job"
  }'
```

After the placeholder is replaced with real signing, use the correct header and signature.

**DB checks:**

```sql
SELECT * FROM fieldnation_mapping WHERE fieldnation_provider_id = 'fnpr-555';
SELECT id, email FROM technicians WHERE lower(email) = 'tech@example.com';
SELECT job_id, assigned_to_internal_technician_id, runbook_json
FROM job_assignments
WHERE job_id = 'job-abc-123';
```

**Join sanity:**

```sql
SELECT fm.fieldnation_provider_id, fm.internal_technician_id, t.email
FROM fieldnation_mapping fm
JOIN technicians t ON t.id = fm.internal_technician_id
WHERE fm.fieldnation_provider_id = 'fnpr-555';
```

### B) Assignments API

```bash
curl -sS -H "Authorization: Bearer <tech-or-admin-jwt>" \
  "https://api-test.purpulse.app/api/assignments?assigned_to=<technicians.id-uuid>"
```

Expect `200` and `assignments` array (shape in [`docs/backend-handoff/OPTION_A_ROUTES.md`](../backend-handoff/OPTION_A_ROUTES.md)).

### C) Client

Sign in to staging as the technician; confirm assignments/runbook UI when wired.

### D) Telemetry

POST a test envelope to `VITE_TELEMETRY_INGESTION_URL`; confirm App Insights / ingestion logs.

---

## 8) Rollback

- **DB:** restore pre-DDL snapshot or follow DBA procedure; do not drop production-linked data without a plan.
- **Webhook:** rotate secret; disable or pause webhook in Field Nation if flooded.
- **Deploy:** redeploy last known-good artifact or swap deployment slot if used.

---

## 9) Edge cases (short)

| Issue | Mitigation |
|-------|------------|
| Duplicate FN deliveries | `webhook_idempotency` + idempotency key (already in boilerplate). |
| No provider email | Create technician with `email` null; reconcile later (see webhook handler doc). |
| JWT claim ≠ `technicians.id` | Custom claim + `JWT_TECHNICIAN_CLAIM`, or map `sub` → `technicians.idp_subject` in DB. |
| User opens app before webhook | UX for “no assignments yet”; optional push later. |

---

## Hybrid Entra (technicians) — deploy checklist

1. **SQL:** run [`scripts/sql/003_technicians_entra_hybrid.sql`](../../scripts/sql/003_technicians_entra_hybrid.sql) (or fresh `001`) — see [`scripts/sql/OPERATOR_RUNBOOK.md`](../../scripts/sql/OPERATOR_RUNBOOK.md).
2. **Function App settings:** `ENTRA_TENANT_ID`, `ENTRA_AUDIENCE` (API app id URI), optional `ENTRA_ISSUER`; **`USER_PROVISIONING_WEBHOOK_URL`** + **`USER_PROVISIONING_HMAC_SECRET`** to your invite service; **`USER_PROVISIONING_EVENT_TYPES`** aligned with Field Nation.
3. **Deploy:** Function app package must **`npm install`** (dependencies **`jose`**, **`pg`**) in [`examples/backend/azure-functions-option-a/package.json`](../../examples/backend/azure-functions-option-a/package.json).
4. **Field app build:** `VITE_USE_ENTRA_TOKEN_FOR_AZURE_API`, MSAL vars, `VITE_USE_ASSIGNMENTS_API`, `VITE_AZURE_API_BASE_URL` — technicians use **`/technician-signin`**.

Full details: [`hybrid-entra-technicians.md`](hybrid-entra-technicians.md).

## Related docs

- [`option-a-staging-playbook.md`](option-a-staging-playbook.md) — short operator sequence  
- [`option-a-ddl-reconciliation.md`](option-a-ddl-reconciliation.md) — schema naming vs alternates  
- [`runbook-staging-test-checklist.md`](runbook-staging-test-checklist.md) — end-to-end checklist  
