# Option A execution status (field app repository)

This document records what **this repo** completed for the **Option A staging execution plan** (see `.cursor/plans/option_a_staging_execution_*.plan.md` if present) versus what remains **outside** this repository.

## Completed in this repo

| Track | Deliverable |
|-------|-------------|
| Decision gate | [`option-a-decisions.md`](option-a-decisions.md) |
| Phase 1 (instructions) | [`scripts/sql/README.md`](../../scripts/sql/README.md) — how to run `001_create_technicians_and_assignments.sql` on test Postgres |
| Phase 2 (handoff) | [`docs/backend-handoff/OPTION_A_ROUTES.md`](../../docs/backend-handoff/OPTION_A_ROUTES.md) — routes for the Functions/API repository |
| Phase 3 (smoke) | [`option-a-smoke-tests.md`](option-a-smoke-tests.md) |
| Phase 4 (env) | [`.env.example`](../../.env.example) |
| Phase 5 (client) | `getAssignments` in [`src/api/client.ts`](../../src/api/client.ts); types in [`src/api/types.ts`](../../src/api/types.ts); tests in [`src/api/__tests__/client.assignments.test.ts`](../../src/api/__tests__/client.assignments.test.ts) |
| Phase 6 (checklist) | Section H in [`runbook-staging-test-checklist.md`](runbook-staging-test-checklist.md) |

## Reference — webhook blob archives (test vs prod)

Field Nation raw webhook JSON is archived per environment in Azure Blob Storage. **Test** and **prod** use different storage accounts; see [`webhook-blob-archives-test-vs-prod.md`](webhook-blob-archives-test-vs-prod.md) so audits do not mix them up.

## Manual / other repositories (not done here)

| Track | Owner | Action |
|-------|--------|--------|
| Phase 1 | DBA / ops | Connect to `purpulse-test-pg-eus2`, apply DDL, verify tables |
| Phase 2 | Backend API repo | Implement webhook + `GET /api/assignments` on `purpulse-test-api-eus2` |
| Phase 3 | CI/CD | Deploy backend to test Function App |
| Phase 4 | DevOps | Set pipeline/Web App env: `VITE_TELEMETRY_INGESTION_URL`, rebuild test UI |
| Phase 6 | QA | Run checklist sections A–G in Azure/test |

No live Azure resources were modified from this workspace.
