# Option A — staging playbook (operators)

Executable sequence for **test**: `purpulse-test-rg`, Postgres `purpulse-test-pg-eus2`, Function App `purpulse-test-api-eus2`, Web App `purpulse-test-app-eus2`.

**Long-form Azure / ops steps (DDL, Key Vault, deploy, smoke SQL, rollback):** [`option-a-azure-ops-playbook.md`](option-a-azure-ops-playbook.md).

**Do not paste secrets into tickets.** Use Key Vault and `az` with redacted output.

## 1. Roles

| Role | Responsibility |
|------|------------------|
| DBA / ops | Run DDL on test Postgres |
| Backend | Deploy Functions from API repo; wire `DATABASE_URL`, FN secret |
| Platform | App settings, restarts, CI build env for Vite |
| QA | [`runbook-staging-test-checklist.md`](runbook-staging-test-checklist.md) |

## 2. API base URL (prefer custom host)

Use **`https://api-test.purpulse.app`** for `VITE_AZURE_API_BASE_URL` (matches App Config in [`docs/azure/REPO_TO_AZURE_DISCOVERY.md`](../azure/REPO_TO_AZURE_DISCOVERY.md)). The `*.azurewebsites.net` hostname may still resolve to the same app; prefer the custom domain for consistency with TLS and docs.

## 3. Apply DDL

See [`scripts/sql/README.md`](../../scripts/sql/README.md). Apply [`001_create_technicians_and_assignments.sql`](../../scripts/sql/001_create_technicians_and_assignments.sql) only after reading [`option-a-ddl-reconciliation.md`](option-a-ddl-reconciliation.md).

Verify:

```sql
\d job_assignments
SELECT COUNT(*) FROM technicians;
```

## 4. Backend deploy

Copy boilerplate from [`examples/backend/azure-functions-option-a/`](../../examples/backend/azure-functions-option-a/) into your **API repository**, wire `pg`, deploy to `purpulse-test-api-eus2`, then smoke:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "https://api-test.purpulse.app/api/assignments?assigned_to=00000000-0000-0000-0000-000000000000"
```

Expect **200** (empty `assignments` array OK).

## 5. Front-end build env (Vite)

Set at **build time** (pipeline or local):

| Variable | Example |
|----------|---------|
| `VITE_USE_ASSIGNMENTS_API` | `true` |
| `VITE_AZURE_API_BASE_URL` | `https://api-test.purpulse.app` |
| `VITE_TELEMETRY_INGESTION_URL` | Full URL to single-event POST — **confirm path with backend** |

See [`.env.example`](../../.env.example).

## 6. Webhook smoke

After handler is live, send a signed test payload per [`examples/webhooks/fieldnation_webhook_handler.md`](../../examples/webhooks/fieldnation_webhook_handler.md). Confirm rows in `fieldnation_mapping` and `job_assignments`.

## 7. Rollback

- DB: restore snapshot taken before DDL.
- API: redeploy previous artifact / Git tag.
- Web: redeploy previous build; unset `VITE_USE_ASSIGNMENTS_API` if needed.

## 8. Risks (short)

1. Telemetry URL wrong → client queues only (`telemetryIngestion` skip).
2. DDL fork → two schemas; use reconciliation doc.
3. JWT audience mismatch on `GET /api/assignments`.
4. FN signature verification wrong → security gap or false 401s.
