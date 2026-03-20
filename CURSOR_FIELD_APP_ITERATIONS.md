# Cursor build iterations — Field app (TechPulse + Azure)

This README breaks **[FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md)** into **ordered Cursor prompts** so each session has a tight scope, clear acceptance criteria, and fewer regressions. Use it as the **implementation playbook** alongside [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [Azure Analysis/ingestion_strategy.md](Azure%20Analysis/ingestion_strategy.md).

**Auditing / QA against this checklist:** see [CURSOR_FIELD_APP_ITERATION_AUDIT_README.md](CURSOR_FIELD_APP_ITERATION_AUDIT_README.md) (how to cross-check TechPulse Atlas + Azure Analysis + code).

---

## How to use this doc

1. Run iterations **in order** unless you explicitly skip a family (e.g. defer geofence).
2. For **each** Cursor task, copy the **prompt template** at the bottom and fill in iteration number, files, event family, and acceptance bullets.
3. Always cite **local paths** from this repo (see [Source paths quick reference](#source-paths-quick-reference)).

**Primary spec:** [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md)  
**Sequencing detail:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (especially Phase 5.x, emit-before-mutate)

---

## Principles (every iteration)

| Principle | Why |
|-----------|-----|
| **One vertical slice** | Prefer one *event family* end-to-end (UI → envelope → queue → POST → idempotency) over “wire everything at once.” |
| **Emit-before-mutate** | Enqueue the canonical event, then mutate Base44/app state ([IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)). |
| **Define “done”** | Each prompt lists 3–5 checkable outcomes (offline survives refresh, duplicate `event_id` safe, no GPS if consent off). |
| **Split repos if needed** | Field app client vs Azure ingestion API / Event Hubs may live in different repos—same JSON contract, separate prompts. |
| **Field Nation boundary** | Model ingestion is **in-app canonical events** → `core.fact_*`. FN REST is buyer/Purpulse.app; see [FieldnationInstructions/README.md](FieldnationInstructions/README.md). |

---

## Iteration 0 — Baseline alignment (read-only)

**Goal:** No production behavior change; produce a short alignment artifact.

**Activities:**

- Read `FIELD_APP_TECHPULSE_AZURE_README.md` end-to-end.
- Skim TechPulse [TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md](TechPulse_Full_Lineage_Atlas_Package/TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md) §3–5 (contract + required Day-1).
- Skim [Azure Analysis/coverage_matrix.md](Azure%20Analysis/coverage_matrix.md) and [Azure Analysis/missing_items.md](Azure%20Analysis/missing_items.md) for top gaps.
- Optional: [Azure Analysis/dispatch_event.json](Azure%20Analysis/dispatch_event.json) (and related schemas).

**Output:** A 1-page checklist mapping **screen/file → `event_name` → `core.fact_*`** (can live in a comment block or `docs/` note).

**Done:** Team agrees on iteration order and first implementation target (usually Iteration 1–3).

---

## Iteration 1 — Telemetry spine

**Goal:** Canonical **envelope** + persistent **queue** + **flush** + dev visibility.

**Scope:**

- `telemetryEnvelope` (TechPulse §3 fields + `schema_version`).
- `telemetryQueue`: offline-capable, retention/backoff per [ingestion_strategy.md](Azure%20Analysis/ingestion_strategy.md).
- `ingestionClient`: `Authorization: Bearer`, `X-Client-Request-ID: event_id` (or equivalent).

**Defer:** Map UI, all event families, full server.

**Done:**

- Enqueue from a **single** test surface (e.g. dev button or one existing action).
- Survives tab refresh / short offline; retries with backoff; logs or UI for queue depth optional.

**Implemented (this repo):** [src/lib/telemetryEnvelope.js](src/lib/telemetryEnvelope.js), [src/lib/telemetryQueue.js](src/lib/telemetryQueue.js), [src/api/telemetryIngestion.js](src/api/telemetryIngestion.js), dev panel [src/components/dev/TelemetryIngestDebugPanel.jsx](src/components/dev/TelemetryIngestDebugPanel.jsx) on Profile; see [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.1 and [.env.example](.env.example).

---

## Iteration 2 — Consent + location policy

**Goal:** **One** consent gate; no GPS in payloads when disallowed.

**Scope:**

- [src/lib/telemetry.js](src/lib/telemetry.js), [src/components/onboarding/LocationConsentStep.jsx](src/components/onboarding/LocationConsentStep.jsx) (or equivalent).
- Policy alignment: [Azure Analysis/audit_report.md](Azure%20Analysis/audit_report.md) (security / minimization).

**Done:**

- Consent **off** → outbound payloads contain **no** precise lat/lon (and coarse policy documented if used).

**Implemented (this repo):** [src/lib/locationConsent.js](src/lib/locationConsent.js); [telemetryEnvelope.js](src/lib/telemetryEnvelope.js) gates `context.location` and finalizes envelopes; [telemetryQueue.js](src/lib/telemetryQueue.js) re-finalizes on enqueue; [LocationConsentStep.jsx](src/components/onboarding/LocationConsentStep.jsx) persists `purpulse_location_consent_ts`; dev QA in [TelemetryIngestDebugPanel.jsx](src/components/dev/TelemetryIngestDebugPanel.jsx). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §3.1.

---

## Iteration 3 — Dispatch events

**Goal:** `dispatch_event` → shape for `core.fact_dispatch_event`.

**UI / hooks (typical):**

- [src/pages/ActiveJob.jsx](src/pages/ActiveJob.jsx), [src/pages/FieldJobs.jsx](src/pages/FieldJobs.jsx), [src/pages/JobDetail.jsx](src/pages/JobDetail.jsx), [src/hooks/useJobQueue.js](src/hooks/useJobQueue.js)

**Done:**

- Offer / accept / decline / cancel / reschedule / ETA updates emit **before** entity mutation where applicable.
- Validates against dispatch schema (local or server); idempotent by `event_id`.

**Refs:** Azure Analysis `dispatch_event*.json`, optional patches [Azure Analysis/](Azure%20Analysis/) `0001*`.

**Implemented (this repo):** [src/lib/dispatchEvent.js](src/lib/dispatchEvent.js) (`mapAppJobStatusToDispatchStatus`, allowlist + `assertDispatchEventRequired`, `emitDispatchEventForJobStatusChange`); [src/lib/connectivityState.js](src/lib/connectivityState.js) (`normalizeConnectivityState`); [src/lib/technicianId.js](src/lib/technicianId.js); schema extensions in [Azure Analysis/dispatch_event.json](Azure%20Analysis/dispatch_event.json) (`location_consent_state`, `location_precise_allowed`); [telemetryQueue.js](src/lib/telemetryQueue.js) `enqueueCanonicalEvent(..., { allowlistKeys })`. Wired emit-before-`Job.update` in [JobStateTransitioner.jsx](src/components/fieldv2/JobStateTransitioner.jsx), [QuickActionsBar.jsx](src/components/field/QuickActionsBar.jsx), [CheckInFlow.jsx](src/components/field/CheckInFlow.jsx), [JobOverview.jsx](src/components/fieldv2/JobOverview.jsx), [CloseoutPreview.jsx](src/components/field/CloseoutPreview.jsx), [AdminJobs.jsx](src/pages/AdminJobs.jsx) (status-only updates), and [useJobQueue.js](src/hooks/useJobQueue.js) (`startTimer` only). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.2.

---

## Iteration 4 — Travel + arrival (timestamps first)

**Goal:** `travel_event` / `arrival_event` **without** geofence/radius (baseline).

**UI (typical):**

- [src/pages/TimeLog.jsx](src/pages/TimeLog.jsx), [src/components/fieldv2/FieldTimeTracker.jsx](src/components/fieldv2/FieldTimeTracker.jsx), [src/components/field/TimerPanel.jsx](src/components/field/TimerPanel.jsx)

**Done:**

- Explicit “start travel,” “arrive,” “check-in” (or equivalent) produce distinct events with `job_id`, `technician_id`, `event_ts_utc`, `schema_version`.

**Implemented (this repo):** [Azure Analysis/travel_event.json](Azure%20Analysis/travel_event.json), [Azure Analysis/arrival_event.json](Azure%20Analysis/arrival_event.json); [src/lib/travelArrivalEvent.js](src/lib/travelArrivalEvent.js) (`buildTravelEventPayload`, `buildArrivalEventPayload`, `emitCanonicalEventsForTimeEntry`, `emitArrivalForClockIn`, `computeOpenTravelMinutesForJob`); wired before `TimeEntry.create` in [TimeLog.jsx](src/pages/TimeLog.jsx) and [TimerPanel.jsx](src/components/field/TimerPanel.jsx); `clock_in` in [FieldTimeTracker.jsx](src/components/fieldv2/FieldTimeTracker.jsx). Tests: [src/tests/travelArrivalEvent.test.js](src/tests/travelArrivalEvent.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.3.

---

## Iteration 5 — Map layer (phased)

**Goal:** Geospatial UX per `FIELD_APP_TECHPULSE_AZURE_README.md` §5.

| Sub-iteration | Scope |
|---------------|--------|
| **5a (P0)** | Site pin / job map + keep external Maps fallback ([src/components/field/JobCard.jsx](src/components/field/JobCard.jsx)). |
| **5b (P1)** | On “start travel,” optional periodic GPS **if consent** → fields on `travel_event`. |
| **5c (P2+)** | Geofence / `radius_30` / etc. — **only after** 4 + 5b stable. |

**Done:** Map-derived samples only appear on `travel_event` / `arrival_event` as spec’d; never without consent.

**Implemented (this repo):** [src/components/field/JobSiteMap.jsx](src/components/field/JobSiteMap.jsx) (react-leaflet, OSM tiles, Vite marker fix); [JobDetailOverview.jsx](src/components/field/JobDetailOverview.jsx) embedded map; [JobCard.jsx](src/components/field/JobCard.jsx) lazy-loaded map in dialog + existing swipe-to-Maps; [src/lib/travelGps.js](src/lib/travelGps.js); `travel_start` wiring in [TimeLog.jsx](src/pages/TimeLog.jsx) + [TimerPanel.jsx](src/components/field/TimerPanel.jsx); `leaflet` dependency + CSS in [main.jsx](src/main.jsx). **5c** (geofence / radius timestamps) deferred — see [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §5.1 P2 and §6.4.

---

## Iteration 6 — Runbook steps

**Goal:** `runbook_step_event` with model-relevant metadata.

**UI (typical):**

- [src/components/field/TaskCard.jsx](src/components/field/TaskCard.jsx), [src/components/fieldv2/RunbookSteps.jsx](src/components/fieldv2/RunbookSteps.jsx), [src/components/field/RunbookStepModal.jsx](src/components/field/RunbookStepModal.jsx)

**Done:**

- `step_instance_id`, duration in **minutes**, `runbook_version`; `step_family` when job provides it; blockers/rework paths emit events.

**Implemented (this repo):** [Azure Analysis/runbook_step_event.json](Azure%20Analysis/runbook_step_event.json); [src/lib/runbookStepEvent.js](src/lib/runbookStepEvent.js); emit-before-`Job.update` in [RunbookView.jsx](src/components/field/RunbookView.jsx); [RunbookSteps.jsx](src/components/fieldv2/RunbookSteps.jsx) (timer → minutes); [TaskCard.jsx](src/components/field/TaskCard.jsx) + [TasksTab.jsx](src/components/field/TasksTab.jsx); escalation path via [BlockerForm.jsx](src/components/field/BlockerForm.jsx) `onSubmitted` + `escalated`. Tests: [src/tests/runbookStepEvent.test.js](src/tests/runbookStepEvent.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.5.

---

## Iteration 7 — Artifacts

**Goal:** `artifact_event` on upload completion + metadata.

**UI / hooks (typical):**

- [src/hooks/useUploadQueue.js](src/hooks/useUploadQueue.js), [src/components/field/EvidenceMetadataForm.jsx](src/components/field/EvidenceMetadataForm.jsx), [src/pages/EvidenceHub.jsx](src/pages/EvidenceHub.jsx)

**Done:** One canonical event after successful upload; ties to `job_id` / evidence identifiers per guide.

**Implemented (this repo):** [Azure Analysis/artifact_event.json](Azure%20Analysis/artifact_event.json); [src/lib/artifactEvent.js](src/lib/artifactEvent.js); after `Evidence.create` in [useUploadQueue.js](src/hooks/useUploadQueue.js), [QuickActionsBar.jsx](src/components/field/QuickActionsBar.jsx), [fieldAdapters.js](src/lib/fieldAdapters.js). [EvidenceMetadataForm.jsx](src/components/field/EvidenceMetadataForm.jsx) / [EvidenceHub.jsx](src/pages/EvidenceHub.jsx) flow through the upload queue. Tests: [src/tests/artifactEvent.test.js](src/tests/artifactEvent.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.6.

---

## Iteration 8 — QC

**Goal:** Immutable `qc_event` from QC UI.

**UI (typical):** [src/pages/AdminQC.jsx](src/pages/AdminQC.jsx)

**Done:** Structured pass/fail, reviewer, defect/first-pass fields per TechPulse + Azure patches if applied (`0002`/`0003` in [Azure Analysis/](Azure%20Analysis/)).

**Implemented (this repo):** [Azure Analysis/qc_event.json](Azure%20Analysis/qc_event.json); [src/lib/qcEvent.js](src/lib/qcEvent.js); **emit-before-`Evidence.update`** on manual override in [AdminQC.jsx](src/pages/AdminQC.jsx) (`useAuth` → `reviewer_id` / `technician_id`); **emit-after** `LabelRecord.create` in [fieldAdapters.js](src/lib/fieldAdapters.js) (`Base44LabelAdapter.createLabel`, used by [LabelerModal.jsx](src/components/fieldv2/LabelerModal.jsx)). Redaction toggle and bulk retry in AdminQC do not emit `qc_event` in this iteration. Tests: [src/tests/qcEvent.test.js](src/tests/qcEvent.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.7.

---

## Iteration 9 — Closeout, escalation, feedback

**Goal:** `closeout_event`, `escalation_event`, `feedback_event`.

**UI (typical):**

- Closeout flows + [src/components/field/CloseoutPreview.jsx](src/components/field/CloseoutPreview.jsx)
- [src/components/field/BlockerModal.jsx](src/components/field/BlockerModal.jsx), [src/components/chat/PMChatView.jsx](src/components/chat/PMChatView.jsx)
- Dedicated or embedded **feedback** step (rating / complaint / compliment flags—not only free text)

**Done:** Each flow emits the correct family; closeout signoff/docs/timecard flags where required.

**Implemented (this repo):** [Azure Analysis/closeout_event.json](Azure%20Analysis/closeout_event.json), [escalation_event.json](Azure%20Analysis/escalation_event.json), [feedback_event.json](Azure%20Analysis/feedback_event.json); [closeoutEvent.js](src/lib/closeoutEvent.js), [escalationEvent.js](src/lib/escalationEvent.js), [feedbackEvent.js](src/lib/feedbackEvent.js). **Closeout:** [CloseoutPreview.jsx](src/components/field/CloseoutPreview.jsx) — `emitCloseoutEvent` (optional checkboxes → `timecard_submitted_flag`, `invoice_support_docs_flag`, `portal_update_flag` when checked), then optional `emitFeedbackEvent`, then dispatch + `Job.update`. **Escalation:** [BlockerForm.jsx](src/components/field/BlockerForm.jsx) after `Blocker.create` (`blocker_create`); [TasksTab.jsx](src/components/field/TasksTab.jsx) task escalate sheet → second row `runbook_escalation` (after same create; shares `escalation_record_id`); [PMChatView.jsx](src/components/chat/PMChatView.jsx) PM escalate (`pm_chat`). **Feedback:** [SignoffCapture.jsx](src/components/field/SignoffCapture.jsx) after sign-off `Job.update` (`signoff`). **`escalation_resolved_timestamp`:** supported on payload; no field-app “resolve blocker” UI yet—emit when that flow exists. Tests: [src/tests/iteration9Events.test.js](src/tests/iteration9Events.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.8.

---

## Iteration 10 — Tool check + job context

**Goal:** Close coverage gaps for `tool_check_event` and `job_context_field`.

**Scope:**

- **New** pre-job checklist screen(s) → `tool_check_event` (today mostly missing in UI).
- Job load / refresh → snapshot `job_context_field` ([src/pages/FieldJobDetail.jsx](src/pages/FieldJobDetail.jsx), sync points).

**Done:** Checklist blocks or warns before “start job” per product decision; context snapshot deduped (version or hash per README strategy).

**Implemented (this repo):** [Azure Analysis/tool_check_event.json](Azure%20Analysis/tool_check_event.json), [job_context_field.json](Azure%20Analysis/job_context_field.json); [toolCheckEvent.js](src/lib/toolCheckEvent.js), [jobContextField.js](src/lib/jobContextField.js) (`computeJobContextFingerprint`, `shouldEmitJobContextSnapshot` / `markJobContextSnapshotEmitted` via `localStorage` key `purpulse_jcf_fp_v1_${jobId}`; fingerprint includes job context + stable technician key). **Tool check:** [PreJobToolCheckModal.jsx](src/components/fieldv2/PreJobToolCheckModal.jsx) — blocks until four acknowledgements; **`emitToolCheckEvent`** before start (enqueue failure blocks with toast). Wired from [JobOverview.jsx](src/components/fieldv2/JobOverview.jsx) **Start Job** (skips checklist when resuming from `paused`) and [JobStateTransitioner.jsx](src/components/fieldv2/JobStateTransitioner.jsx) when transitioning to `in_progress` (not from `paused` resume; overrides unchanged). **Job context:** [FieldJobDetail.jsx](src/pages/FieldJobDetail.jsx) — **`emitJobContextFieldIfChanged`** when canonical context string changes; enqueue failure logged only. Tests: [iteration10Events.test.js](src/tests/iteration10Events.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.9.

---

## Iteration 11 — Coverage-driven micro-UI

**Goal:** Batch **acknowledgement** flags from [coverage_matrix.md](Azure%20Analysis/coverage_matrix.md) / [missing_items.md](Azure%20Analysis/missing_items.md).

**Examples:** `required_docs_opened_flag`, `risk_flag_ack_flag`, `customer_notes_review_flag`, ETA ack timestamps.

**UX:** Pre-arrival or pre-step **sheets**, not one giant form.

**Done:** Each flag maps to an explicit payload field on the correct event family.

**Implemented (this repo):** Shared constants [scopeAcknowledgements.js](src/constants/scopeAcknowledgements.js). **Schemas:** [arrival_event.json](Azure%20Analysis/arrival_event.json) and [tool_check_event.json](Azure%20Analysis/tool_check_event.json) — five optional boolean flags (`required_docs_opened_flag`, `risk_flag_ack_flag`, `customer_notes_review_flag`, `site_constraint_ack_flag`, `step_sequence_preview_flag`). **Travel:** [travelArrivalEvent.js](src/lib/travelArrivalEvent.js) — `planned_eta_timestamp` from job schedule; `eta_ack_timestamp` only when caller passes it (after **EtaAcknowledgementSheet**). **Sheets:** [AcknowledgementSheets.jsx](src/components/field/AcknowledgementSheets.jsx) (`PreArrivalAckSheet`, `EtaAcknowledgementSheet`). **Wired:** [TimeLog.jsx](src/pages/TimeLog.jsx), [TimerPanel.jsx](src/components/field/TimerPanel.jsx) — `travel_start` → ETA sheet; `travel_end` → pre-arrival scope sheet → `arrival_event` flags. [FieldTimeTracker.jsx](src/components/fieldv2/FieldTimeTracker.jsx) — clock-in → pre-arrival sheet. [PreJobToolCheckModal.jsx](src/components/fieldv2/PreJobToolCheckModal.jsx) — same five flags on **`tool_check_event`**. [JobStateTransitioner.jsx](src/components/fieldv2/JobStateTransitioner.jsx) — transition to **`en_route`** → ETA sheet → `dispatch_event` **`eta_ack_timestamp`** via `emitDispatchEventForJobStatusChange` overrides. Tests: [iteration11Events.test.js](src/tests/iteration11Events.test.js), [travelArrivalEvent.test.js](src/tests/travelArrivalEvent.test.js). See [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.10.

---

## Iteration 12 — Azure mapping hardening

**Goal:** Loader-ready **field-level** mapping; optional patches.

**Activities:**

- Align payloads with `core.fact_*` columns per [TechPulse_Azure_Database_Master_Documentation.md](TechPulse_Full_Lineage_Atlas_Package/TechPulse_Azure_Database_Master_Documentation.md).
- Note `feature.fact_technician_*` and `serving.*` consumers ([TechPulse_Azure_Model_Catalog.csv](TechPulse_Full_Lineage_Atlas_Package/TechPulse_Azure_Model_Catalog.csv)).
- Cherry-pick [Azure Analysis/](Azure%20Analysis/) patches `0001`–`0003` if not already applied.

**Done:** Document or codegen mapping table; ingestion service accepts all families implemented in 3–11.

**Implemented (this repo):** [canonical_event_loader_mapping.md](Azure%20Analysis/canonical_event_loader_mapping.md) (human table + contract + silver key alignment), [canonical_event_families.manifest.json](Azure%20Analysis/canonical_event_families.manifest.json) (machine index for all 11 field-app families + `ingestion_pipeline` + `additional_emit_exports` for shared travel/arrival lib), [PATCHES_STATUS.md](Azure%20Analysis/PATCHES_STATUS.md) (`0001`–`0003` superseded). [Azure Analysis/README.md](Azure%20Analysis/README.md) points to mapping + validation. `npm run validate:canonical-manifest` — [scripts/validate-canonical-manifest.mjs](scripts/validate-canonical-manifest.mjs) (schema `event_name` const, envelope ⊆ `required`, export names, TechPulse paths). [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.11. `dispatch_event.json` uses `event_name` **const** like other families.

---

## Iteration 13 — QA / validation pass

**Goal:** [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §10 + cross-cutting checks.

**Checklist:**

- [x] Same `event_id` twice → duplicate handled (no double fact row). **Client:** idempotent 200/202 clears queue; pending rows keyed by `event_id`. **Server:** must still dedupe inserts. Tests: [iteration13TelemetryQueue.test.js](src/tests/iteration13TelemetryQueue.test.js).
- [x] Offline queue → flush after reconnect. **Client:** `registerTelemetryQueueListeners` + IndexedDB. Test: `iteration13TelemetryQueue.test.js` (listener wiring).
- [x] Consent off → no GPS in payload. Tests: [iteration13Qa.test.js](src/tests/iteration13Qa.test.js), [travelGps.test.js](src/tests/travelGps.test.js).
- [x] 400 schema → no infinite retry of same body. **Client:** non-retryable → drop row. Tests: `iteration13Qa.test.js`, `iteration13TelemetryQueue.test.js`.
- [x] No Field Nation REST on handset for **model** facts (boundary). **Repo:** no `fieldnation` matches under `src/`; documented in [iteration13_client_qa.md](Azure%20Analysis/iteration13_client_qa.md) + FIELD_APP §10.

**Implemented (this repo):** [Azure Analysis/iteration13_client_qa.md](Azure%20Analysis/iteration13_client_qa.md), Vitest files above, FIELD_APP §10 table updated. Dev dependency: `fake-indexeddb` (queue tests in jsdom).

---

## Parallel tracks (optional)

| Track | Repo | Focus |
|-------|------|--------|
| **A** | purpulse-fieldapp | Iterations 1–2, then 3–11 (UI + client queue). |
| **B** | Ingestion / Azure service | JSON Schema validation, idempotency store, Event Hubs → `core.fact_*` loaders. |

**Contract:** Identical minimum envelope and per-family payloads as documented in TechPulse guide + Azure Analysis schemas.

---

## Source paths quick reference

| Topic | Path |
|--------|------|
| Execution spec (UI, map, pipeline, Azure) | [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) |
| Phased engineering plan | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| Ingestion SLOs, queue, rollout order | [Azure Analysis/ingestion_strategy.md](Azure%20Analysis/ingestion_strategy.md) |
| Coverage / gaps | [Azure Analysis/coverage_matrix.md](Azure%20Analysis/coverage_matrix.md), [missing_items.md](Azure%20Analysis/missing_items.md) |
| Loader mapping (Iteration 12) | [Azure Analysis/canonical_event_loader_mapping.md](Azure%20Analysis/canonical_event_loader_mapping.md), [canonical_event_families.manifest.json](Azure%20Analysis/canonical_event_families.manifest.json) |
| QA / validation (Iteration 13) | [Azure Analysis/iteration13_client_qa.md](Azure%20Analysis/iteration13_client_qa.md), [src/tests/iteration13Qa.test.js](src/tests/iteration13Qa.test.js), [src/tests/iteration13TelemetryQueue.test.js](src/tests/iteration13TelemetryQueue.test.js) |
| Audit / security | [Azure Analysis/audit_report.md](Azure%20Analysis/audit_report.md) |
| Repo ↔ datapoint | [Azure Analysis/repo_datapoint_mapping.csv](Azure%20Analysis/repo_datapoint_mapping.csv) |
| TechPulse guide + CSVs | [TechPulse_Full_Lineage_Atlas_Package/](TechPulse_Full_Lineage_Atlas_Package/) |
| Field Nation (assignment context only) | [FieldnationInstructions/](FieldnationInstructions/) |
| Canonical location consent (Iteration 2) | [src/lib/locationConsent.js](src/lib/locationConsent.js), [src/components/onboarding/LocationConsentStep.jsx](src/components/onboarding/LocationConsentStep.jsx) |
| Field pages / components | [src/pages/](src/pages/), [src/components/field/](src/components/field/), [src/components/fieldv2/](src/components/fieldv2/) |

---

## Cursor prompt template (copy per iteration)

```text
Context: Implement ONLY Iteration [N] from CURSOR_FIELD_APP_ITERATIONS.md
in the purpulse-fieldapp repo (/Users/max/Desktop/FieldApp/purpulse-fieldapp).

Primary spec: FIELD_APP_TECHPULSE_AZURE_README.md — section(s): [e.g. §4 dispatch, §6 ingestion]

Scope:
- Event family(es): [dispatch | travel | arrival | runbook_step | artifact | qc | closeout | escalation | feedback | tool_check | job_context]
- Files you may change: [list concrete paths under src/]
- Out of scope for this task: [other families, geofence, FN API, bronze ETL, …]

Requirements:
- [Bullet from iteration “Done” list]
- [Bullet]
- [Bullet]

References (read first):
- /Users/max/Desktop/FieldApp/purpulse-fieldapp/CURSOR_FIELD_APP_ITERATIONS.md — Iteration [N]
- /Users/max/Desktop/FieldApp/purpulse-fieldapp/FIELD_APP_TECHPULSE_AZURE_README.md
- /Users/max/Desktop/FieldApp/purpulse-fieldapp/IMPLEMENTATION_PLAN.md — [section]
- /Users/max/Desktop/FieldApp/purpulse-fieldapp/Azure Analysis/[specific file]

Acceptance / how to verify:
- [ ] …
- [ ] …
```

---

*This document is the canonical **iteration index** for Cursor-assisted implementation. Update it if you reorder phases or add new event families.*
