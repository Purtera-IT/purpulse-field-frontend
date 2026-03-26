# Option A — decision gate (recorded)

**Date:** Staging execution track for runbook provisioning.

## 1. Job / assignment storage (staging)

**Decision:** Use the **parallel `job_assignments` table** path from [`scripts/sql/001_create_technicians_and_assignments.sql`](../scripts/sql/001_create_technicians_and_assignments.sql) for **Option A staging**, rather than `ALTER` on a production `jobs` table that may be owned by Base44 sync.

**Rationale:** Avoids schema conflict until product defines sync from Purpulse API → Base44 (or a single read path). Webhook + `GET /api/assignments` read from `job_assignments` joined to job identifiers as needed.

**Follow-up:** If the backend team confirms a single `jobs` table under their control, migrate to `ALTER TABLE jobs` + columns per the SQL file comments.

## 2. Telemetry ingestion URL (test)

**Decision:** The field app posts canonical envelopes to whatever URL is set in **`VITE_TELEMETRY_INGESTION_URL`** (full URL including path). See [`src/api/telemetryIngestion.js`](../../src/api/telemetryIngestion.js).

**Verification required (operators / backend):**

1. Confirm the deployed route on **`https://api-test.purpulse.app`** (or APIM in front of it), e.g. `/v1/telemetry/events` — **exact path is owned by the API repo**, not this client.
2. Confirm JWT **audience** / scopes match what [`sendCanonicalEnvelope`](../../src/api/telemetryIngestion.js) sends (`Authorization: Bearer` from `authManager`).
3. Set that full URL in the **test** Vite build pipeline (or Web App app settings if injected at build).

**Placeholder for staging (unverified until backend confirms):**  
`https://api-test.purpulse.app/v1/telemetry/events` — replace with the real path after API review.

## 3. Field app feature flag

**Decision:** Resolved assignments are fetched only when **`VITE_USE_ASSIGNMENTS_API=true`** and **`VITE_AZURE_API_BASE_URL`** is set. See [`src/api/client.ts`](../../src/api/client.ts) `getAssignments`.

This keeps production behavior unchanged until the API is live.
