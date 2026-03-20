# Field App → Azure Implementation Plan

This plan describes **what to add to the field app first** (UI and code so you can capture the right data), **how to wire that data into Azure**, and **steps that are easy to miss**. It follows the TechPulse lineage package and the Azure Analysis audit.

---

## Overview: Three Tracks

| Track | Goal |
|-------|------|
| **A. Foundation** | One canonical event envelope, stable technician identity, one telemetry queue, and a reusable ingestion client. Without this, no event is Azure-ready. |
| **B. Field app capture** | Emit the right events from the right screens/flows so every important technician action produces an immutable, schema-compliant event. |
| **C. Azure wiring** | Ingestion API, idempotency store, Event Hubs (or equivalent), observability, and (optionally) the P0 patches that implement A + part of B. |

Do **A** first, then **B** and **C** in parallel (app changes + backend/azure plumbing). The P0 patches in `Azure Analysis/` implement a large part of A and the first wave of B; you can apply them or re-implement in smaller steps using this plan.

---

## Phase 1 — Foundation (do this first)

### 1.1 Canonical event envelope and shared helper

**Goal:** Every event sent to Azure has the same minimum contract: `event_id`, `schema_version`, `event_ts_utc`, `technician_id`, `job_id`, `site_id` (when applicable), `source_system`, plus optional `device_id`, `connectivity_state`, `event_sequence_no`, and consent-aware location.

**Current state:**  
- `src/lib/telemetry.js` uses `telemetry_version` and `timestamp` and sends to Base44 analytics, not a canonical envelope.  
- `src/hooks/useJobQueue.js` uses `client_event_id`, `device_ts`, `assignee_id` and no `schema_version` or `technician_id`.

**Add:**

1. **Shared telemetry envelope builder** (e.g. `src/lib/telemetryEnvelope.js` or extend `telemetry.js`):
   - `buildCanonicalEnvelope(eventName, payload)` → returns object with:
     - `event_id`: UUID v4 (use existing `src/lib/uuid.js` or crypto.randomUUID).
     - `schema_version`: e.g. `"1.0.0"` (semver; one per event family if you version per-family).
     - `event_name`, `event_ts_utc` (ISO8601 UTC), `client_ts` (device time).
     - `source_system`: `"field_app"`.
     - `technician_id`, `job_id`, `site_id` (from context; see 1.2).
     - `device_id`, `connectivity_state`, `event_sequence_no` (optional but recommended).
     - Location only when telemetry/location consent is true (read from existing consent in `telemetry.js`).
   - Single place to read consent so location is never sent when consent is false.

2. **Schema version constant or config**  
   e.g. `CANONICAL_SCHEMA_VERSION = "1.0.0"` and document that MINOR = new optional fields, MAJOR = breaking.

**Files to touch:**  
- New: `src/lib/telemetryEnvelope.js` (or equivalent).  
- `src/lib/telemetry.js`: keep existing analytics; add or call into canonical builder only for events that will go to Azure.

---

### 1.2 Stable technician identity

**Goal:** Every event has a non-PII, stable `technician_id` (not email).

**Current state:**  
- `useJobQueue.js` and backend contracts use `assignee_id` / `assigned_to` (often email).  
- `src/lib/auth.ts` handles tokens; user/profile may live in Base44 or your auth provider.

**Add:**

1. **Resolve technician ID in one place:**
   - If your auth provider (e.g. Azure AD) gives a stable subject/object ID, use that as `technician_id` and store it in session or profile.
   - If you only have email, add a server-side or client-side lookup (e.g. from Base44 user/profile API) that returns a stable internal ID and cache it for the session.
2. **Expose `technician_id` to the envelope builder** (e.g. from React context, or from a small `useTechnicianId()` hook that reads from auth/session/profile).
3. **Never send email as `technician_id`** in the canonical payload; use it only for lookup.

**Files to touch:**  
- `src/lib/auth.ts` or profile/session type and usage.  
- New or existing: user profile store/API usage (e.g. where you load “current user”).  
- `telemetryEnvelope.js`: accept `technician_id` from caller or context.

---

### 1.3 Single telemetry queue for Azure events

**Goal:** One queue abstraction for all canonical events: persist locally, send when online, retry with backoff, respect consent and idempotency.

**Current state:**  
- Job events: `useJobQueue.js` uses localStorage key `purpulse_job_event_queue`, flushes via `base44.entities.Job.update`.  
- Other flows: `telemetry.js` sends to Base44 analytics; upload queue has its own queue.  
- No single place that queues canonical envelopes and sends them to a dedicated ingestion endpoint.

**Add:**

1. **Unified telemetry queue** (e.g. `src/lib/telemetryQueue.js` or a small module):
   - **Storage:** Same as or replace current job queue; consider Dexie/IndexedDB for larger volume and 7-day retention (per ingestion strategy). Store: `event_id`, `event_name`, payload JSON, `first_queued_utc`, `retry_count`, `last_error`, consent snapshot.
   - **Enqueue:** Accept a canonical envelope (from 1.1); persist; optionally attempt immediate send if online.
   - **Flush:** On: online, app focus/visibility change, before logout, on check-in/closeout (per ingestion strategy). Send to ingestion API (see Phase 3). On 202/200 (duplicate): remove from queue. On 4xx (e.g. 400 schema): optionally move to dead-letter or drop after N retries. On 5xx/network: retry with exponential backoff (e.g. 1s, 2s, 4s, 8s, 16s, 30s cap).
   - **Idempotency:** Send `event_id` in request (e.g. `X-Client-Request-ID` or body); server returns 200 for duplicate so client can remove from queue.
2. **Migration:** Either move job-queue events into this queue and have the job queue “emit canonical + enqueue” then call existing `Job.update`, or keep job queue but have it push the same event into this queue for Azure. Prefer one queue for all families.

**Files to touch:**  
- New: `src/lib/telemetryQueue.js` (or split: queue storage + flush client).  
- `src/hooks/useJobQueue.js`: after building canonical dispatch event (see 2.1), enqueue it and then run existing flush to Base44.

---

### 1.4 Reusable ingestion client

**Goal:** One place that sends a canonical event (or batch) to your Azure ingestion API (auth, headers, retries).

**Add:**

1. **Ingestion API client** (e.g. `src/api/telemetryIngestion.js` or `src/api/ingestionClient.ts`):
   - **Config:** Base URL for ingestion API (e.g. `VITE_TELEMETRY_INGESTION_URL`), getBearerToken from `auth.ts`.
   - **Send:** POST with `Authorization: Bearer <token>`, `X-Client-Request-ID: <event_id>`, optional `X-Device-ID` (consented device id). Body: the canonical envelope.
   - **Responses:** 202 accepted, 200 idempotent duplicate → success. 400 validation, 401/403 auth → don’t retry same payload. 429/5xx/network → retry with backoff (handled by queue flush).
   - Optionally support small batches (e.g. up to 50 events or 256 KB) for background events; ingestion strategy says foreground events (dispatch, arrival, qc, closeout) send immediately, others can be batched.

**Files to touch:**  
- New: `src/api/telemetryIngestion.js` (or `.ts`).  
- `telemetryQueue.js`: call this client on flush.

---

## Phase 2 — Field app: what to add so you can ingest the right data

Each subsection is “what to add in the UI/code so that the right event is emitted and queued.” Order matches recommended rollout (envelope first, then dispatch, travel/arrival, artifact, runbook, qc, closeout, etc.).

### 2.1 Dispatch lifecycle (`core.fact_dispatch_event`)

**Goal:** Every job status change (offer seen, accept, decline, check-in, work start, work stop, cancel, reschedule, ETA update) produces a `dispatch_event` with status and timestamps.

**Current state:**  
- `src/hooks/useJobQueue.js`: only `check_in`, `work_start`, `work_stop`; flush updates job via `base44.entities.Job.update`; no separate immutable event.  
- `src/lib/telemetry.js`: `telemetryJobCheckIn` sends analytics, not canonical.

**Add:**

1. **Dispatch status enum** aligned with TechPulse (e.g. offer_shown, accepted, declined, checked_in, work_started, work_stopped, cancelled, rescheduled, eta_updated). Map existing `check_in` → checked_in, `work_start` → work_started, etc.
2. **Emit before mutate:** In `useJobQueue.js`, when adding to the queue:
   - Build canonical envelope with `event_name: "dispatch_event"`, status, `job_id`, `scheduled_start_timestamp` (from job if available), `promised_eta_utc` if applicable, location only if consented.
   - Enqueue to the unified telemetry queue (1.3).
   - Then run existing logic (e.g. sync to Base44 `Job.update` when online).
3. **Optional UI:** If you don’t yet have “offer / accept / decline / cancel / reschedule” in the app, add minimal actions (e.g. from job detail or list) so those transitions exist and can emit the corresponding status.

**Files:**  
- `src/hooks/useJobQueue.js`  
- `src/lib/telemetryEnvelope.js` (or equivalent)  
- Any job detail/list screen where accept/decline/cancel/reschedule are triggered

**Reference:**  
- `Azure Analysis/dispatch_event.json`, `dispatch_event_client.ts`, `dispatch_event_server.py`  
- `Azure Analysis/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch` (if you apply it)

---

### 2.2 Travel and arrival (`core.fact_travel_event`, `core.fact_arrival_event`)

**Goal:** Separate events for “started travel”, “ETA updated”, “arrived / check-in”, “work started” so Azure can compute travel time, lateness, and access delay.

**Current state:**  
- `src/pages/TimeLog.jsx` (and possibly `FieldTimeTracker.jsx`): entries like `travel_start`, `travel_end`, `work_start`, `work_stop`.  
- `travel_end` is labeled “Arrived on site” but is not a separate arrival fact.  
- No geofence/radius timestamps in the audit; optional for v1.

**Add:**

1. **Travel events:** When technician starts travel (or updates ETA), emit `travel_event` with e.g. `route_departure_timestamp`, `planned_eta_utc` if you have it, and `event_sequence_no` for ordering.
2. **Arrival events:** When technician checks in or starts work, emit `arrival_event` with `checkin_timestamp` and/or `work_start_timestamp`. Don’t reuse the same event for both “arrived” and “work started” if the model expects two facts; use two events or two clear fields.
3. **Wire TimeLog (or equivalent):** On “travel start” → enqueue `travel_event`. On “arrived” / “work start” → enqueue `arrival_event`, then keep existing time-entry behavior.
4. **Optional later:** Geofence/radius timestamps, access delay reason, site contact reached — add when UI supports them.

**Files:**  
- `src/pages/TimeLog.jsx` and/or `src/components/fieldv2/FieldTimeTracker.jsx`  
- New or extended: travel/arrival envelope builders (can live in `telemetryEnvelope.js` or event-specific modules)

**Reference:**  
- `Azure Analysis/0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch`

---

### 2.3 Artifacts / evidence (`core.fact_artifact_event`)

**Goal:** Every evidence upload (start, complete, error, replace, attach-to-step) produces an `artifact_event` with artifact id, type, counts, and optional serial/asset/signature flags.

**Current state:**  
- `src/hooks/useUploadQueue.js` creates Evidence and stores metadata; `telemetry.js` has `telemetryEvidenceUploadStart/Complete/Error`.  
- No canonical artifact envelope with required/optional fields for `fact_artifact_event`.

**Add:**

1. **Artifact event on upload complete (and optionally start/error):** When an upload completes (and optionally on start or failure), build canonical envelope with `event_name: "artifact_event"`, `artifact_id` or evidence id, `evidence_type`, `photo_uploaded_count` / `photo_required_count` if available from job context, and optional `serial_value`, `customer_signature_flag`, etc. Enqueue to telemetry queue.
2. **Structured serial/asset/signature:** Where you have serial number, asset tag, or signature capture, add structured fields to the payload instead of only notes (see `missing_items.md`).
3. **Required photo count:** If job or runbook defines required photos, pass that into the artifact event so Azure can compute completeness.

**Files:**  
- `src/hooks/useUploadQueue.js`  
- `src/lib/telemetry.js` (optional: keep analytics; add canonical emit alongside)  
- Evidence metadata forms if you add structured serial/signature fields

**Reference:**  
- `Azure Analysis/0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch` (artifact part)

---

### 2.4 Runbook steps (`core.fact_runbook_step_event`)

**Goal:** Each runbook step start/complete produces an event with `step_instance_id`, `step_family`, durations (in minutes), blocker/rework flags.

**Current state:**  
- `src/lib/telemetry.js`: `telemetryRunbookStepComplete(jobId, stepName, durationSeconds)`.  
- `src/components/field/TaskCard.jsx` calls it.  
- Backend `functions/runbookStepResult.ts` accepts stepId, durationSeconds, etc., but no canonical event from app.

**Add:**

1. **Runbook event builder:** Emit `runbook_step_event` with: `step_instance_id` (stable id for this step instance), `step_family` or step code from runbook, `step_start_timestamp` / `step_end_timestamp`, `actual_step_duration_min` = durationSeconds/60, optional `planned_step_duration_min`, `execution_flag`, `evidence_complete_flag`, `defect_flag`, `rework_flag` if you have them.
2. **Wire step completion (and optionally start):** In TaskCard or wherever steps are completed, build envelope and enqueue. If you track step start time, include it; otherwise at least end time and duration.
3. **Runbook version:** If job/runbook has a version, include it in the payload.

**Files:**  
- `src/components/field/TaskCard.jsx` (and any other step-completion entry points)  
- `src/lib/telemetry.js` or new runbook event helper  
- Types/runbook payload for step_family, runbook_version

**Reference:**  
- `Azure Analysis/missing_items.md` (runbook section)

---

### 2.5 QC outcomes (`core.fact_qc_event`)

**Goal:** Every QC review (pass/fail, defect, first-pass, retest, training approval) produces an immutable `qc_event`.

**Current state:**  
- `src/pages/AdminQC.jsx` updates `qc_status`, `qc_fail_reasons`, etc.  
- `functions/submitLabel.ts` has confidence, bbox, approvedForTraining.  
- No canonical qc_event emitted from app.

**Add:**

1. **On QC submit (AdminQC or equivalent):** Build `qc_event` with `review_timestamp`, `validation_result` (pass/fail), `defect_flag`, `retest_flag`, `approved_for_training` if applicable, `reviewer_id` (stable id), optional `confidence`, `qc_task_id`. Enqueue to telemetry queue.
2. **Keep existing UI/API:** Continue updating evidence QC status in app/backend; treat the event as an immutable fact in addition.

**Files:**  
- `src/pages/AdminQC.jsx`  
- Any API client that calls submitLabel or QC update

**Reference:**  
- `Azure Analysis/0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch` (qc part)

---

### 2.6 Closeout (`core.fact_closeout_event`)

**Goal:** Job closeout (signoff, documentation complete, timecard, etc.) produces a `closeout_event`.

**Current state:**  
- `src/lib/types/index.ts`: signoff fields; `telemetry.js`: `telemetryJobCloseout`.  
- No canonical closeout event.

**Add:**

1. **On closeout submit:** Build `closeout_event` with `closeout_submit_timestamp`, signoff completion, customer_signature_flag, invoice_support_docs_flag, etc., from your closeout form. Enqueue.
2. **Optional:** Split into sub-steps (signoff captured, docs complete, timecard submitted) if your UI has distinct actions; each can emit or you can emit one event with flags.

**Files:**  
- Closeout screen or component (e.g. closeout preview / submit flow)  
- `src/lib/telemetry.js`

---

### 2.7 Escalation / blockers (`core.fact_escalation_event`)

**Goal:** When a blocker is created or resolved (or escalation status changes), emit `escalation_event` with reason category and timestamps.

**Current state:**  
- `telemetry.js`: `telemetryBlockerCreated`.  
- Blocker type/severity in UI; no canonical escalation envelope.

**Add:**

1. **On blocker create/resolve:** Build `escalation_event` with e.g. `escalation_created_timestamp` / `escalation_resolved_timestamp`, `reason_category`, optional `response_lag`. Enqueue.
2. **Structured reason taxonomy:** If you have a fixed set of reasons, use them in the payload for downstream models.

**Files:**  
- Where blockers are created/updated (e.g. chat or blocker modal)  
- `src/lib/telemetry.js`

---

### 2.8 Feedback (`core.fact_feedback_event`)

**Goal:** Customer feedback (rating, complaint, compliment) produces `feedback_event`.

**Current state:**  
- Signoff CSAT/notes in types; no structured feedback event.

**Add:**

1. **Feedback form or closeout step:** When user submits rating or complaint/compliment, build `feedback_event` with `rating_value`, `complaint_flag`, `compliment_flag`, etc. Enqueue.
2. **Optional:** Separate screen for post-job feedback if you don’t want it only at closeout.

**Files:**  
- Closeout or feedback screen; types for feedback payload

---

### 2.9 Tool check / domain tool (`core.fact_tool_check_event`, `core.fact_domain_tool_log`)

**Goal:** Tool readiness checks and domain tool usage produce events for eligibility and skill models.

**Current state:**  
- No dedicated checklist UI or ingestion path found in audit.

**Add:**

1. **Tool/readiness checklist (optional but valuable):** Before work start or per job, a small checklist: tools, PPE, BOM/docs. On submit, emit `tool_check_event` with checklist result.
2. **Domain tool log:** If you have domain-specific tools that produce outputs or validations, emit `domain_tool_log` when those actions occur.

**Files:**  
- New or existing “readiness” or “pre-start” screen; any domain tool integration points.

---

### 2.10 Job context snapshot (`core.fact_job_context_field`)

**Goal:** When job is assigned or refreshed, optionally emit a snapshot of key job context (runbook version, requirement counts, site constraints) so Azure has “context at event time.”

**Current state:**  
- Job/runbook/evidence requirements in memory; no explicit job_context_field emission.

**Add:**

1. **On job load/refresh or assignment sync:** Build a payload with structured fields (e.g. runbook_version, required_photo_count, key site/domain fields). Emit as `job_context_field` or similar. Can be lower priority and batched.

**Files:**  
- Job fetch/detail or sync logic; types for job context

---

## Phase 3 — Wiring into Azure

### 3.1 Ingestion API (backend)

**Goal:** Accept POSTs of canonical events; validate schema and auth; enforce idempotency; write to Event Hubs (or Service Bus) and optionally to dead-letter for invalid messages.

**Add:**

1. **Endpoint(s):** e.g. `POST /api/v1/telemetry/events` or per-family `POST /api/v1/telemetry/dispatch-events`, etc. Request body: canonical envelope. Headers: `Authorization: Bearer <token>`, `X-Client-Request-ID: <event_id>`.
2. **Auth:** Validate JWT (Azure AD / Entra or your IdP); resolve `technician_id` from token or server-side user map; reject 401/403 if invalid.
3. **Validation:** Validate payload against JSON Schema (e.g. `Azure Analysis/dispatch_event.json` and equivalents for other families). Return 400 with details if invalid.
4. **Idempotency:** Store key = `event_id` (partition by event family if you like). TTL e.g. 72 hours–7 days. If already seen, return 200 and same outcome metadata; do not write again to transport.
5. **Transport:** Publish to Azure Event Hubs (one hub with `event_name` partition key, or one per family). On success return 202. Optionally write invalid payloads to a dead-letter store and return 400.
6. **Response contract:** 202 accepted, 200 idempotent duplicate, 400 validation, 401/403 auth.

**Where:**  
- New Azure Function, App Service, or Container App (e.g. Node or Python).  
- Reference: `Azure Analysis/dispatch_event_server.py`, `dispatch_event_openapi.yaml`, `ingestion_strategy.md` (sections 2 Auth, 5 Idempotency, 12 Dead-letter).

---

### 3.2 Idempotency store

**Goal:** Remember `event_id` so duplicate requests don’t double-write to Event Hubs.

**Add:**

- Azure Table Storage or Cosmos DB: partition key = event family (or `event_id` hash), row key = `event_id`. Store: `first_seen_utc`, `auth_subject`, `status` (accepted/duplicate). TTL 72 hours minimum; 7 days if offline replay is common.

---

### 3.3 Event Hubs and downstream

**Goal:** Events flow into bronze/silver/gold and into TechPulse core tables.

**Add:**

- Event Hubs namespace and hub(s). Producer: ingestion API. Consumer: existing or new pipeline that writes to `core.fact_*` tables (and then feature/serving layers). Ensure schema version and event_name are available for routing.

---

### 3.4 Observability

**Goal:** Know how many events are accepted, duplicate, invalid; latency; queue depth on client.

**Add:**

1. **Server:** Application Insights (or equivalent): log accepted, duplicate, invalid counts; ingest latency; optional per-family metrics. Alerts on schema mismatch spike, dead-letter spike, or zero accepts during business hours (see `ingestion_strategy.md` SLOs and alert thresholds).
2. **Client:** Optional: send telemetry_flush_result (success/fail, queue depth) to AppInsights or your analytics so you can see queue health and failure rates.

---

### 3.5 Environment and secrets

**Goal:** App knows ingestion URL and auth; backend has Event Hubs connection and idempotency store.

**Add:**

- **App:** `VITE_TELEMETRY_INGESTION_URL` (or per-env). Auth: use existing MSAL/Azure AD or app auth; ensure ingestion client gets a bearer token.
- **Backend:** Event Hubs connection string; idempotency store connection; Application Insights connection. No secrets in client.

---

## Phase 4 — Optional but important

### 4.1 Offline and consent

- **Queue persistence:** Prefer one store (e.g. IndexedDB/Dexie) with 7-day retention; encrypt at rest if required.
- **Consent:** Single place for telemetry and location consent; envelope builder and queue respect it (no location when consent false).
- **Ordering:** Per `job_id` or `session_id`, preserve order (e.g. `event_sequence_no`) so replay order is clear.

### 4.2 Schema versioning and migration

- **Versioning:** Semantic version on envelopes; document MINOR = optional new fields, MAJOR = breaking. Server supports current and previous MINOR.
- **Migration:** When adding fields, add as optional first; backfill or accept both old/new; then tighten validation.

### 4.3 Security and privacy

- **PII:** Never put email/phone in canonical event payload as technician identifier; use stable id only.
- **Location:** Only when consented; consider coarse geohash for some analytics.
- **Retention:** Align with ingestion strategy (e.g. raw coords 30–90 days; derived longer). See `audit_report.md` security table.

---

## Phase 5 — Validation and rollout

### 5.1 Before going live

- [ ] Run lint and tests (including any new tests for envelope and queue).
- [ ] Apply or re-implement P0 patches; run focused tests: `npm test -- dispatchEvent`, `travelArrivalEvents`, `artifactQcEvents` (if you keep those test names).
- [ ] Test idempotency: send same `event_id` twice; second returns 200 and only one row in Event Hubs / core table.
- [ ] Test offline: queue events, go offline, come back; confirm flush and no duplicate writes.
- [ ] Test consent: with location consent off, confirm no lat/lon in payloads.
- [ ] Staging: run a few full job flows (dispatch, travel, arrival, artifact, QC, closeout) and confirm events in Event Hubs and core tables.

### 5.2 Rollout order (recommended)

1. Foundation (envelope, technician_id, queue, ingestion client).  
2. Ingestion API + idempotency + Event Hubs (can be stub that accepts and logs).  
3. Dispatch events (useJobQueue + ingestion).  
4. Travel + arrival events.  
5. Artifact + QC events.  
6. Runbook, closeout, escalation, feedback.  
7. Tool check / domain tool / job context (as needed).  
8. Observability dashboards and alerts.  
9. Production rollout with feature flag or percentage rollout if desired.

### 5.3 Steps that are easy to miss

- **Technician ID:** It’s easy to keep using email in the app; make sure one place resolves and caches stable `technician_id` and every envelope uses it.
- **Emit before mutate:** Always enqueue (and optionally send) the canonical event *before* calling `Job.update` or other state changes so you never “forget” to emit.
- **Idempotency on client too:** If the app retries after a timeout, it may send the same `event_id` again; server must return 200 and client must treat as success and remove from queue.
- **Location consent:** Centralize consent check; if you add new location fields later, use the same check.
- **Schema version in payload:** Always include so server and downstream can route and migrate.
- **Runbook duration in minutes:** Atlas uses `actual_step_duration_min`; convert from seconds when emitting.
- **Two events for travel vs arrival:** Don’t send one “travel_end” that doubles as arrival; send `travel_event` and `arrival_event` (or one event with both timestamps if your schema allows, but two events match the model tables).

---

## Quick reference: files to add or change

| Area | Files |
|------|--------|
| Envelope | New: `src/lib/telemetryEnvelope.js` (or in telemetry.js) |
| Identity | `src/lib/auth.ts`, profile/session, `useTechnicianId` or equivalent |
| Queue + client | New: `src/lib/telemetryQueue.js`, `src/api/telemetryIngestion.js` |
| Dispatch | `src/hooks/useJobQueue.js` |
| Travel/arrival | `src/pages/TimeLog.jsx`, `FieldTimeTracker.jsx` |
| Artifact | `src/hooks/useUploadQueue.js`, evidence metadata |
| Runbook | `src/components/field/TaskCard.jsx`, runbook helpers |
| QC | `src/pages/AdminQC.jsx` |
| Closeout | Closeout submit flow, `telemetry.js` |
| Escalation | Blocker create/resolve flow |
| Feedback | Feedback/closeout form |
| Backend | New: ingestion API (Function/App Service), idempotency store, Event Hubs |

---

Using this plan, you can implement **foundation first**, then **event-by-event in the app**, and **wire ingestion and Azure** in parallel. The P0 patches in `Azure Analysis/` give you a fast path for dispatch, travel/arrival, and artifact/QC; use this document to fill in the rest and to avoid missing steps like technician_id, idempotency, and consent.
