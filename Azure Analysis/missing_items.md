# Missing / partial items with code pointers

This file groups the biggest field-app gaps by event family and explains **why** each item is missing or partial, where the nearest existing code lives, and what should change next.

> **Document status (March 2026):** The **P0 / P1 / P2** sections in the collapsible block below were written as a **pre-canonical** gap inventory. The field app **now** implements the canonical path: envelope + IndexedDB queue + per-family emitters and JSON Schemas (see [CURSOR_FIELD_APP_ITERATIONS.md](../CURSOR_FIELD_APP_ITERATIONS.md) **Implemented** blocks, [canonical_event_loader_mapping.md](./canonical_event_loader_mapping.md), and [audit_command_results.md](./audit_command_results.md)). **Do not** read the opening historical P0s as “the app still has no envelope.”
>
> **Live backlog (verify in code + [coverage_matrix.md](./coverage_matrix.md)):** e.g. `domain_tool_log` / advanced geofence tokens, atlas fields not yet on a schema, and observability dashboards — not a missing telemetry spine.

<details>
<summary><strong>Historical gap inventory (superseded narratives for envelope / dispatch / travel / runbook / etc.)</strong></summary>

## P0 — canonical event envelope missing across the app

**Problem**  
The atlas minimum contract requires `event_id`, `schema_version`, `event_ts_utc`, `technician_id`, `job_id`, `site_id` (when applicable), `source_system`, and recommended fields like `session_id`, `device_id`, `connectivity_state`, `event_sequence_no`, and `payload_version` (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:61-81`).

**Current code pointers**
- `src/lib/telemetry.js:81-99` sends Base44 analytics events with `telemetry_version` and `timestamp`, but not the atlas envelope.
- `src/hooks/useJobQueue.js:112-122` stores `client_event_id`, `job_id`, `event_type`, `assignee_id`, `device_ts`, and `device_meta`.
- `public/openapi.yaml:474-499` defines `JobEventCreate` with `client_event_id`, `event_type`, `device_ts`, `device_meta`, optional `geo`, and `notes`.

**Why partial**
- Identity uses email-ish fields (`assignee_id`, `assigned_to`) instead of stable `technician_id`.
- No global `schema_version`.
- No canonical `event_id`.
- No single reusable wrapper around consent, device identity, connectivity, and idempotency.
- Some flows hit Base44 entities directly instead of immutable telemetry endpoints.

**Required fix**
1. Add a canonical telemetry helper shared by every field/mgr screen.
2. Emit immutable event envelopes before mutating Base44 entities.
3. Flush queued envelopes to a dedicated ingestion route with idempotency on `event_id`.

---

## P0 — dispatch lifecycle is only partially captured

**Atlas fields at risk**
`accept_flag`, `decline_flag`, `offer_timestamp`, `response_timestamp`, `cancel_timestamp`, `reschedule_flag`, `planned_eta_timestamp`, `eta_ack_timestamp`, `eta_update_timestamp`, `assignment_id`, `technician_id`, `scheduled_start_timestamp`, `status_change_log_flag`, `route_departure_timestamp` (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:87-110`).

**Current code pointers**
- `src/hooks/useJobQueue.js:97-148` only differentiates `check_in` vs `work_start`.
- `src/hooks/useJobQueue.js:65-67,132-134` flushes by calling `base44.entities.Job.update(...)`.
- `src/lib/telemetry.js:116-120` emits only `job_check_in`.

**Why missing / partial**
- The current queue updates mutable job state instead of writing immutable dispatch facts.
- No “offer shown / accepted / declined / cancelled / rescheduled / ETA updated” event family.
- `assignee_id` is an email, not a stable technician key.
- `scheduled_date` / `scheduled_time` exist in `src/lib/types/index.ts`, but are not normalized into `scheduled_start_timestamp` on emitted events.

**Recommended fix**
- Introduce a dedicated `dispatch_event` emitter and `/telemetry/dispatch-events` endpoint.
- Normalize job lifecycle actions into a status enum aligned with `core.fact_dispatch_event`.
- Resolve `technician_id` from the authenticated principal or a server lookup, never from email.

---

## P0 — travel and arrival are conflated

**Atlas fields at risk**
`route_departure_timestamp`, `planned_eta_timestamp`, `eta_ack_timestamp`, `eta_update_timestamp`, `radius_30_timestamp`, `radius_15_timestamp`, `geofence_arrival_timestamp`, `checkin_timestamp`, `access_granted_timestamp`, `site_contact_reached_timestamp`, `permit_or_mop_flag`, `required_docs_opened_flag`, `required_tool_manifest_id`, `work_start_timestamp` (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:113-138`).

**Current code pointers**
- `src/pages/TimeLog.jsx:226-246` writes `travel_start`, `travel_end`, `work_start`, `work_stop`.
- `src/pages/TimeLog.jsx:240-243` labels `travel_end` as “Arrived on site”.
- `src/hooks/useJobQueue.js:22-23` updates `check_in_time` and `work_start_time`.

**Why missing / partial**
- TimeLog gives you coarse timestamps but not a separate arrival fact.
- No geofence timestamps or concentric radius events.
- No access-delay, site-contact, permit/MOP, or required-doc/tool acknowledgements.
- `travel_end` is a UI shorthand, not a geofence or arrival canonical fact.

**Recommended fix**
- Emit `travel_event` for route departure / ETA / geofence progression.
- Emit `arrival_event` for check-in, site contact, access granted, and work start.
- Keep travel and arrival events immutable and ordered with `event_sequence_no`.

---

## P0 — runbook events exist, but not in atlas shape

**Atlas fields at risk**
`runbook_version`, `step_instance_id`, `step_family`, `step_start_timestamp`, `step_end_timestamp`, `actual_step_duration_min`, `planned_step_duration_min`, `execution_flag`, `evidence_complete_flag`, `defect_flag`, `rework_flag` (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:142-166`).

**Current code pointers**
- `src/lib/telemetry.js:183-188` emits `runbook_step_complete`.
- Manual review: `functions/runbookStepResult.ts` accepts `{ stepId, workOrderId, techId, result, notes, evidenceIds, durationSeconds }` and writes Activity/AuditLog.

**Why missing / partial**
- Existing step completion is a generic analytics/audit action, not a canonical `core.fact_runbook_step_event`.
- Duration is recorded in seconds, while the atlas uses minute-based fields.
- No stable `step_instance_id`.
- No planned step duration, preview/constraint acknowledgements, or structured step-family dimension.

**Recommended fix**
- Add a reusable runbook emitter with explicit `step_instance_id`.
- Convert `durationSeconds / 60.0` into `actual_step_duration_min`.
- Attach `runbook_version` and `step_family` from the assigned job/runbook payload.

---

## P0 — artifact/evidence capture is richer than telemetry, but still incomplete

**Atlas fields at risk**
`artifact_id`, `documentation_artifact_id`, `serial_value`, `asset_tag_capture_flag`, `photo_uploaded_count`, `photo_required_count`, `customer_signature_flag`, `closeout_submit_timestamp`, `invoice_support_docs_flag`, `portal_update_flag` (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:191-215`).

**Current code pointers**
- `src/hooks/useUploadQueue.js:143-158` creates `Evidence` with `job_id`, `evidence_type`, `file_url`, `captured_at`, `geo_lat`, `geo_lon`, `content_type`, `size_bytes`.
- `src/hooks/useUploadQueue.js:261-268` stores client-side upload metadata including `client_event_id`, `job_id`, `capture_ts`, `face_blur`, and custom metadata.
- Manual review: `functions/registerEvidence.ts` writes `Evidence`, `UploadManifest`, `Activity(upload)`, and `AuditLog(evidence_upload)`.
- `public/openapi.yaml:143-217,509-584` already has a workable evidence upload contract.

**Why missing / partial**
- Upload metadata is good, but the atlas expects immutable artifact lifecycle events, not just entity creation.
- Serial/part numbers are concatenated into `notes` instead of structured fields.
- Required-photo counts live in job context / requirements but are not emitted with artifact events.
- No explicit closeout artifact sub-events for invoice support, portal updates, punchlist closure, or timecard submission.

**Recommended fix**
- Emit `artifact_event` on upload start, upload complete, upload error, replace, and attach-to-step.
- Promote serial / asset-tag / signature capture into structured fields.
- Join required-photo counts from job context into the artifact envelope before sending.

---

## P0 — QC and labeling are close, but still non-canonical

**Atlas fields at risk**
`qc_task_id`, `reviewer_id`, `review_timestamp`, `validation_result`, `confidence`, `bbox`, `approved_for_training`, `defect_flag`, `retest_flag`, `defect_exception_flag` (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:168-189`).

**Current code pointers**
- `src/pages/AdminQC.jsx:193-204` updates `qc_status`, `qc_fail_reasons`, `face_redacted`, and resets failures.
- Manual review: `functions/submitLabel.ts` captures `confidence`, `bbox`, `labelerId`, `approvedForTraining`.
- `src/lib/types/index.ts:219-238` includes `approved_for_training`, `reviewed_by`, and `reviewed_at` on `LabelRecord`.

**Why missing / partial**
- Evidence verdicts are being mutated in place; there is no immutable `fact_qc_event`.
- `reviewer_id` / `review_timestamp` exist conceptually but were not found wired end-to-end in the accessible repo subset.
- Retry/rework loops are UI behaviors, not canonical retest/rework event facts.

**Recommended fix**
- Emit one immutable `qc_event` for every review, override, rework request, and training approval decision.
- Keep `evidence.qc_status` as denormalized current state only.
- Carry `confidence`, `bbox`, `approved_for_training`, and reviewer identity in the event envelope.

---

## P1 — closeout is modeled in types, but not operationalized

**Current code pointers**
- `src/lib/types/index.ts:42-48` defines `signoff_signature_url`, `signoff_csat`, `signoff_notes`.
- `src/lib/telemetry.js:194-199` emits a minimal `job_closeout`.

**Why missing / partial**
- Closeout exists as loose status plus signoff fields, not an auditable closeout event family.
- Customer signoff time, punchlist closure, invoice support docs, and timecard workflow are not wired in the accessible UI/API subset.

**Recommended fix**
- Add a dedicated closeout screen or submission workflow that emits `closeout_event`.
- Split signoff capture, documentation completion, timecard submission, and final closeout approval into separate transitions.

---

## P1 — blocker/escalation coverage is too shallow

**Current code pointers**
- `src/lib/telemetry.js:204-209` emits `blocker_created`.
- `src/lib/types/index.ts:368-380` models a `Blocker` entity.

**Why missing / partial**
- The current code logs blocker creation but not structured escalation lifecycle.
- Safety flags such as `near_miss_flag`, `unsafe_condition_escalation_flag`, `jsa_completed_flag`, `loto_flag`, `ppe_compliance_flag`, etc. were **NOT FOUND** in the accessible repo subset.
- No `incident_id` / safety-report pipeline was found.

**Recommended fix**
- Build a structured escalation modal / workflow with operational and safety dimensions.
- Emit an immutable event whenever blocker severity, status, or incident linkage changes.

---

## P1 — structured customer feedback is mostly absent

**Current code pointers**
- `src/lib/types/index.ts:45-46` has `signoff_csat` and `signoff_notes`.

**Why missing / partial**
- No structured screen or endpoint for `complaint_count`, `compliment_count`, `repeat_request_flag`, `professionalism_score`, `expectation_setting_score`, or `clean_leave_behind_score`.
- Feedback is likely to be captured, if at all, in free text or after-the-fact systems.

**Recommended fix**
- Add a closeout feedback form or supervisor follow-up screen that emits `feedback_event`.
- Keep free text separately from structured model inputs.

---

## P1 — tool / readiness telemetry is effectively missing

**Why missing**
- `tool_check_event` and `domain_tool_log` families are called out in the atlas (`TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:266-289`), but no dedicated checklist UI or ingestion path was found in the accessible repo subset.
- The nearest equivalents are generic runbook/audit actions and evidence uploads.

**Recommended fix**
- Add readiness checklists for tools, PPE, BOM/docs, and required manifests.
- Emit immutable checklist events before work start.

---

## P2 — job context snapshots are modeled, but not emitted as facts

**Current code pointers**
- `src/lib/types/index.ts:7-53,71-103` models `Job`, `RunbookPhase`, `EvidenceRequirement`, and custom fields.
- `src/pages/FieldJobDetail.jsx` reads job, evidence, labels, and meetings.

**Why partial**
- The app clearly has job context in memory, but no explicit `fact_job_context_field` emission was found.
- That means downstream pipelines may only see the latest mutable job document rather than the historical context visible to the technician at event time.

**Recommended fix**
- Emit a job-context snapshot at assignment sync, job refresh, and server-approved job mutation.
- Include runbook version, requirement counts, key site constraints, and selected domain fields.

</details>

---

## Observability / reliability issues that cut across all families

**Update:** Canonical atlas families share **`telemetryQueue`** + **`telemetryIngestion`** (Iterations 1 & 13). The bullets below still apply to **non-canonical** paths (e.g. legacy analytics, upload queue) and to **missing** ingestion SLO dashboards in Azure.

**Current code pointers**
- `src/hooks/useUploadQueue.js` has concurrency, retry limits, and backoff.
- `src/lib/repositories/jobRepository.ts:150-215` contains explicit stubs where “real implementation” would call the API.
- `src/lib/telemetry.js` and `src/lib/fieldAdapters.js` split analytics vs audit responsibilities.

**Why this matters**
- Different subsystems queue and flush differently (localStorage, Dexie, direct Base44 writes, analytics, audit logs).
- Several “offline-ready” pieces do not currently flush to a canonical Azure-compatible ingestion route.
- Partial failures are visible locally, but not exposed as an ingestion SLO dashboard.

**Recommended fix**
- Use one telemetry queue abstraction for all atlas event families.
- Write all event envelopes idempotently to a dedicated ingestion API.
- Track queue age, queue depth, per-family success/failure, schema mismatch counts, and duplicate-event rates in AppInsights / Azure Monitor.
