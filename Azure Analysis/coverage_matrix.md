# Coverage matrix

## Scope used for this audit

- ZIP/package scanned from `/mnt/data/TechPulse_Full_Lineage_Atlas_Package.zip`.
- Repo code scanned from the accessible local checkout of `functions/`, `public/openapi.yaml`, and `src/` files listed in `repo_datapoint_mapping.csv`, plus manual review notes previously captured for:
  - `functions/registerEvidence.ts`
  - `functions/runbookStepResult.ts`
  - `functions/submitLabel.ts`
  - `functions/uploadToken.ts`
- Raw token universe: **260** unique raw datapoints from `TechPulse_Raw_DataPoint_Dictionary_Exploded.csv` (`TechPulse_Full_Data_Lineage_Atlas.md:47-57`).
- Features/lineage rows: **3187** rows from `TechPulse_Full_Feature_DataPoint_Lineage.csv` (`TechPulse_Full_Data_Lineage_Atlas.md:60-73`).

## Raw datapoint coverage summary

| Scope | Count | Percent |
|---|---:|---:|
| Total atlas raw tokens | 260 | 100.0% |
| Backend-owned / out of field-app scope | 88 | 33.8% |
| Field-app or either-owned tokens | 172 | 66.2% |
| Fully present in repo | 6 | 3.5% of field-app scope |
| Partial implementation | 56 | 32.6% of field-app scope |
| Missing in field app | 110 | 64.0% of field-app scope |
| Present + partial | 62 | 36.0% of field-app scope |

### Interpretation

- The current app exposes **some** of the right user journeys (dispatch/check-in, evidence upload, time entries, QC, runbook results), but most raw tokens still do **not** reach Azure in canonical atlas shape.
- Practical coverage for model-relevant field-app data is **62/172 = 36.0%** when partials are included, but only **6/172 = 3.5%** is already strong enough to call “present”.
- Because nearly every field-app token in scope is model-linked, the current gaps directly block training/serving fidelity.

## Feature coverage summary

| Feature coverage bucket | Count | Meaning |
|---|---:|---|
| BLOCKED_BY_MISSING | 1963 | At least one required field-app raw token is missing. |
| PARTIAL_ONLY | 291 | No required field-app token is totally missing, but one or more are only partial/non-canonical. |
| BACKEND_ONLY | 933 | Feature depends only on backend-owned/raw non-field-app sources. |

## Event-family coverage (token occurrence basis)

> Note: one raw token can feed multiple event families, so totals below are by family occurrence, not a de-duplicated global denominator.

| family                  |   total_tokens |   present |   partial |   missing |   coverage_pct |
|:------------------------|---------------:|----------:|----------:|----------:|---------------:|
| fact_dispatch_event     |             42 |         4 |         9 |        29 |           31   |
| fact_travel_event       |             33 |         2 |        14 |        17 |           48.5 |
| fact_arrival_event      |             28 |         3 |        12 |        13 |           53.6 |
| fact_runbook_step_event |             73 |         2 |        23 |        48 |           34.2 |
| fact_qc_event           |             33 |         2 |        25 |         6 |           81.8 |
| fact_artifact_event     |             54 |         3 |        30 |        21 |           61.1 |
| fact_closeout_event     |             23 |         1 |         7 |        15 |           34.8 |
| fact_escalation_event   |             20 |         1 |         9 |        10 |           50   |
| fact_feedback_event     |             22 |         1 |         3 |        18 |           18.2 |
| fact_domain_tool_log    |             35 |         2 |        21 |        12 |           65.7 |
| fact_tool_check_event   |             60 |         1 |        10 |        49 |           18.3 |
| fact_job_context_field  |              0 |         0 |         0 |         0 |            0   |

## Highest-priority missing raw tokens

These are the best first fixes because they fan out into many features/models and are still absent as canonical app telemetry.

| raw_datapoint               |   mapped_model_count | recommended_raw_objects                                                                                                                                                                               |
|:----------------------------|---------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| planned_step_duration_min   |                   12 | fact_artifact_event / fact_domain_tool_log; fact_dispatch_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event |
| customer_notes_review_flag  |                    9 | fact_arrival_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                             |
| required_docs_opened_flag   |                    9 | fact_arrival_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                             |
| risk_flag_ack_flag          |                    9 | fact_arrival_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                             |
| site_constraint_ack_flag    |                    9 | fact_arrival_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                             |
| step_sequence_preview_flag  |                    9 | fact_arrival_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                             |
| defect_exception_flag       |                    8 | fact_qc_event / fact_domain_tool_log                                                                                                                                                                  |
| eta_ack_timestamp           |                    8 | fact_dispatch_event; fact_travel_event                                                                                                                                                                |
| eta_update_timestamp        |                    7 | fact_arrival_event; fact_dispatch_event; fact_escalation_event; fact_travel_event                                                                                                                     |
| inventory_variance_pct      |                    7 | fact_closeout_event; fact_qc_event; fact_runbook_step_event; fact_tool_check_event; fact_travel_event                                                                                                 |
| photo_accept_first_flag     |                    7 | fact_artifact_event; fact_dispatch_event                                                                                                                                                              |
| step_family                 |                    7 | fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                        |
| subdomain_id                |                    7 | fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                        |
| coaching_acceptance_flag    |                    6 | fact_artifact_event; fact_dispatch_event; fact_feedback_event; fact_runbook_step_event; fact_tool_check_event                                                                                         |
| coaching_feedback_timestamp |                    6 | fact_dispatch_event; fact_runbook_step_event                                                                                                                                                          |

## Highest-priority partial raw tokens

These exist in some form, but not as durable, idempotent, atlas-shaped telemetry.

| raw_datapoint             |   mapped_model_count | recommended_raw_objects                                                                                                                                                                                                                                                                                                                                                               |
|:--------------------------|---------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| technician_id             |                   17 | bronze_technician_profile_snapshot; fact_arrival_event; fact_artifact_event; fact_artifact_event / fact_domain_tool_log; fact_closeout_event; fact_dispatch_event; fact_escalation_event; fact_feedback_event; fact_qc_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event; fact_travel_event |
| step_end_timestamp        |                   12 | fact_artifact_event / fact_domain_tool_log; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                                                                                                                      |
| step_instance_id          |                   12 | fact_artifact_event / fact_domain_tool_log; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                                                                                                                      |
| step_start_timestamp      |                   12 | fact_artifact_event / fact_domain_tool_log; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                                                                                                                      |
| runbook_version           |                   11 | fact_arrival_event; fact_dispatch_event; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                                                                                                                                                               |
| actual_step_duration_min  |                   10 | fact_artifact_event / fact_domain_tool_log; fact_dispatch_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                        |
| defect_count              |                   10 | fact_artifact_event; fact_artifact_event / fact_domain_tool_log; fact_qc_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                                  |
| first_pass_flag           |                   10 | fact_artifact_event; fact_artifact_event / fact_domain_tool_log; fact_qc_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                                  |
| rework_cycle_count        |                   10 | fact_artifact_event; fact_artifact_event / fact_domain_tool_log; fact_qc_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                                  |
| actual_tool_scan          |                    9 | fact_arrival_event; fact_tool_check_event                                                                                                                                                                                                                                                                                                                                             |
| bom_review_flag           |                    9 | fact_arrival_event; fact_runbook_step_event / fact_domain_tool_log; fact_tool_check_event                                                                                                                                                                                                                                                                                             |
| defect_flag               |                    9 | fact_artifact_event / fact_domain_tool_log; fact_qc_event; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                                                       |
| evidence_complete_flag    |                    9 | fact_artifact_event / fact_domain_tool_log; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                                                                      |
| execution_flag            |                    9 | fact_artifact_event / fact_domain_tool_log; fact_qc_event / fact_domain_tool_log; fact_runbook_step_event / fact_domain_tool_log                                                                                                                                                                                                                                                      |
| required_tool_manifest_id |                    9 | fact_arrival_event; fact_tool_check_event                                                                                                                                                                                                                                                                                                                                             |

## Unit / type consistency mismatches found

| Area | Current repo behavior | Atlas requirement | Audit finding |
|---|---|---|---|
| Event envelope | `client_event_id`, `device_ts`, `assignee_id` in queue/openapi drafts | `event_id`, `schema_version`, `event_ts_utc`, `technician_id`, `source_system`, `session_id`, `project_id` | **Mismatch**; add canonical envelope wrapper before ingest. |
| Technician identity | Email strings such as `assignee_id` / `assigned_to` | Stable `technician_id` | **PII + join risk**; resolve technician_id server-side or from authenticated session. |
| Timestamps | Mostly `new Date().toISOString()` | ISO8601 UTC | **Good baseline**; keep UTC everywhere and avoid local-only timestamps in storage. |
| Time units | `durationSeconds`, `file_size_kb`, local derived seconds | Atlas frequently expects minutes, bytes, or explicit unit names | **Mismatch**; convert `seconds -> minutes` for `*_duration_min`, keep file sizes in bytes, document unit columns. |
| Travel/arrival | `travel_end` is treated as “Arrived on site” in UI | Separate `travel_event` and `arrival_event` facts | **Mismatch**; split route departure, geofence arrival, check-in, and work start into separate emits. |
| GPS/privacy | `telemetry.js` globally scrubs lat/lon, but evidence upload stores geo lat/lon directly | Consent-gated location fields | **Inconsistent**; centralize consent policy so location is either included canonically or omitted consistently. |
| Offline sync | localStorage + Dexie + repository stubs | durable queue with retries and idempotent flush | **Partial**; current queues exist, but not all paths actually flush to a canonical ingestion route. |

## Search scope for “NOT FOUND”

When an item is marked **MISSING** or **NOT FOUND**, the search scope was:

- accessible local repo files under `src/`, `public/openapi.yaml`, and `functions/` present in the checkout
- manual review notes already captured from `functions/registerEvidence.ts`, `functions/runbookStepResult.ts`, `functions/submitLabel.ts`, and `functions/uploadToken.ts`
- string/alias searches across those files for exact tokens and conservative equivalents

Anything outside that scope is called out explicitly in `missing_items.md`.
