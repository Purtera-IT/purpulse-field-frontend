# Runbook provisioning — staging verification checklist

Use **test** subscription resources (`purpulse-test-rg`, `api-test.purpulse.app`) unless noted.

---

## Prerequisites

- [ ] Tester has JWT auth against test API (same mechanism as field app / admin tooling).
- [ ] `DATABASE_URL` for test Functions can run migrations (`scripts/sql/001_*` reviewed and applied to **test** DB only).
- [ ] Field Nation **sandbox** credentials available (see dev function app pattern in `docs/azure/REPO_TO_AZURE_DISCOVERY.md`).
- [ ] Field app build for test includes `VITE_AZURE_API_BASE_URL=https://api-test.purpulse.app` and, for telemetry tests, `VITE_TELEMETRY_INGESTION_URL` if the POST route exists on test.

---

## A. Schema & API

- [ ] Apply DDL (technicians, fieldnation_mapping, job columns or `job_assignments`, idempotency table) to test Postgres.
- [ ] Deploy Functions with new routes: `POST /api/webhooks/fieldnation`, `GET /api/assignments`, optional `POST /api/technicians`, extended `GET /api/jobs/{id}`.
- [ ] Smoke: `GET /api/assignments?assigned_to=<uuid>` returns 200 and JSON shape (may be empty array).

---

## B. Webhook path

- [ ] Send synthetic webhook with valid test signature (or internal bypass in staging only).
- [ ] Repeat same `X-Idempotency-Key` → second response indicates duplicate handling, no double assignment.
- [ ] Invalid signature → 401.

---

## C. Identity

- [ ] Create or map technician: `fieldnation_provider_id` → `technicians.id`.
- [ ] Log in to field app (or API-only) with user whose token includes claim mapping to `internal_technician_id` (or call assignments with that UUID).

---

## D. Assignment visibility

- [ ] After webhook, `GET /api/assignments?assigned_to=...` lists the job with non-empty `runbook_json` (or expected placeholder).
- [ ] Open job in FieldJobDetail; runbook renders (client change may be required to consume new API).

---

## E. Telemetry (optional but recommended)

- [ ] Set `VITE_TELEMETRY_INGESTION_URL` in test build to verified POST URL.
- [ ] Perform one lifecycle action that emits `dispatch_event` or `runbook_step_event`.
- [ ] Confirm 202/200 from ingestion OR row in App Insights / ingestion logs (confirm backend team’s sink).

---

## F. Rollback

- [ ] Document previous Function app version / Git tag.
- [ ] DB migration down script or backup restore plan for test DB.

---

## G. Sign-off

| Role | Name | Date |
|------|------|------|
| Engineer | | |
| Product | | |

---

## H. Field app repo (this repository) — Option A artifacts

Completed in-repo (does **not** replace Azure/backend work):

- Decisions: [`option-a-decisions.md`](option-a-decisions.md) (job_assignments path, telemetry verification steps).
- DB apply instructions: [`scripts/sql/README.md`](../../scripts/sql/README.md).
- Backend contract for API team: [`docs/backend-handoff/OPTION_A_ROUTES.md`](../../docs/backend-handoff/OPTION_A_ROUTES.md).
- Smoke curl examples: [`option-a-smoke-tests.md`](option-a-smoke-tests.md).
- Env template: [`.env.example`](../../.env.example) (`VITE_USE_ASSIGNMENTS_API`, `VITE_AZURE_API_BASE_URL`, `VITE_TELEMETRY_INGESTION_URL`).
- Client: `apiClient.getAssignments(internalTechnicianId)` in [`src/api/client.ts`](../../src/api/client.ts) when `VITE_USE_ASSIGNMENTS_API=true`.

Wire `internal_technician_id` from IdP/profile and call `getAssignments` where product wants the resolved list (e.g. after login). Until the API exists, leave the flag **false**.
