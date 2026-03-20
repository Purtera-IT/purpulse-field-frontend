# TechPulse Field App Data Collection and Model Mapping Guide

This is the field-app handoff document: what data to capture, where it lands, what it powers, and why it matters.

---

## 1) Goal

Capture structured field telemetry from technician work so TechPulse can:

1. compute reliable metrics and trust signals,
2. build U_* (universal) and D_* (domain) feature states,
3. run ranking/risk/calibration models,
4. improve model quality after initial operating period (for example after ~2 weeks of real jobs).

Rules enforced by design:

- `raw/core -> features -> metrics -> embeddings -> models -> API`
- business metrics are not embedding-derived unless explicitly similarity-based
- universal and domain signals remain separated (`U_*` vs `D_*`)
- point-in-time safety with event timestamps and as-of logic

---

## 2) Where data goes in Azure (runtime)

Primary runtime storage path in current implementation:

- `core.fact_dispatch_event`
- `core.fact_travel_event`
- `core.fact_arrival_event`
- `core.fact_runbook_step_event`
- `core.fact_qc_event`
- `core.fact_artifact_event`
- `core.fact_escalation_event`
- `core.fact_closeout_event`
- `core.fact_feedback_event`
- `core.fact_domain_tool_log`
- `core.fact_tool_check_event`
- `core.fact_job_context_field`

Identity/context dimensions:

- `core.dim_technician`
- `core.dim_job`
- `core.dim_site`
- `core.dim_technician_credential`
- `core.dim_technician_tool_inventory`

Feature and serving outputs:

- `feature.fact_technician_skill_state_daily` (U_*)
- `feature.fact_technician_domain_state_daily` (D_*)
- `serving.techpulse_metric_snapshot_long`
- `serving.fact_job_tech_fit_score`
- `serving.tech_ranking_score_snapshot`
- `serving.serving_model_explanation_cache`

---

## 3) Minimum data contract for field app events

Every event payload should include:

- `event_id` (UUID)
- `event_ts_utc` (UTC timestamp)
- `technician_id`
- `job_id`
- `site_id` (if applicable)
- `domain_code` / `subdomain_code` (if applicable)
- `source_system` (`field_app`)
- event-specific attributes

Recommended metadata for reliability:

- `device_ts_local`
- `app_version`
- `os_version`
- `connectivity_state`
- `event_sequence_no`
- `payload_version`

---

## 4) Exact event families to capture (and why)

## A) Dispatch lifecycle

Store in: `core.fact_dispatch_event`

Capture:

- offer shown
- accept / decline
- cancel / late cancel
- reschedule
- promised ETA

Powers:

- acceptance metrics
- no-show / cancellation risk
- schedule commitment and trust support evidence

Used by models:

- Acceptance Rate Aggregator
- No-Show / Cancellation Risk Model
- Trust Composer

---

## B) Travel + arrival

Store in:

- `core.fact_travel_event`
- `core.fact_arrival_event`

Capture:

- depart/start travel
- ETA updates
- geofence enter/exit
- arrival check-in timestamp
- access delay reason

Powers:

- lateness patterns
- access friction patterns
- time-window reliability

Used by models:

- Late Arrival Risk Model
- Access Delay / Site Friction Model
- Trust Composer

---

## C) Runbook step execution

Store in: `core.fact_runbook_step_event`

Capture:

- step start/end
- planned vs actual duration
- blocker flag + blocker time
- retry/rework count
- step family and step code

Powers:

- first-pass quality signals
- duration overrun signals
- domain skill depth

Used by models:

- QC Failure / First-Pass Model
- Duration Overrun Predictor
- Domain Expert Bank / Subdomain adapters

---

## D) QC outcomes

Store in: `core.fact_qc_event`

Capture:

- pass/fail
- defect count/type
- first-pass flag
- retest loop marker

Powers:

- quality risk metrics
- domain outcome labels

Used by models:

- QC Failure / First-Pass Model
- Risk/watchout projections

---

## E) Documentation/artifacts

Store in:

- `core.fact_artifact_event`
- `core.fact_closeout_event`

Capture:

- required photo/doc present/missing
- artifact quality score
- closeout completion state
- signoff completion

Powers:

- documentation risk
- evidence pack quality
- trust decomposition completeness/support

Used by models:

- Documentation Failure Model
- Trust Composer

---

## F) Escalations/blockers communications

Store in: `core.fact_escalation_event`

Capture:

- escalation created
- escalation resolved
- reason category
- response lag

Powers:

- blocker risk
- watchout explanations

Used by models:

- Escalation / Blocker Risk Model
- Operating conditions/watchout heads

---

## G) Feedback/experience

Store in: `core.fact_feedback_event`

Capture:

- rating value
- complaint flag
- compliment flag
- customer feedback class

Powers:

- rating aggregates
- customer experience risk
- trust calibration and confidence interpretation

Used by models:

- Rating Aggregator
- Customer Experience Risk Model
- Trust Composer

---

## H) Domain/tool telemetry

Store in:

- `core.fact_domain_tool_log`
- `core.fact_tool_check_event`

Capture:

- tool readiness checks
- calibration failures
- domain tool outputs/validation logs

Powers:

- domain skill depth and tool readiness
- credential/tool gating context

Used by models:

- Domain Expert Bank
- Tool readiness/eligibility logic
- skill/risk downstream heads

---

## I) Job context fields

Store in: `core.fact_job_context_field`

Capture:

- structured scope fields (`field_id`, `field_path`)
- text/number/bool values
- source version

Powers:

- job context encoding (`J_*`)
- pair ranking relevance
- transfer/novelty context

Used by models:

- Job Context Structured Encoder
- Job Context Text Encoder
- Pair Interaction Ranker

---

## 5) What your field engineer should treat as required vs optional

Required Day-1:

- dispatch, travel, arrival, runbook steps, qc pass/fail, closeout completion
- core IDs and timestamps on every event

Strongly recommended in first 2 weeks:

- artifact quality
- escalation reason taxonomy
- feedback and complaint/compliment
- tool-check telemetry

Optional early, valuable later:

- richer free-text notes (if structured fields already captured)
- advanced attachments metadata

---

## 6) Training readiness expectation

With consistent event capture, after ~2 weeks you can:

- retrain baseline risk/ranking heads with real job-tech outcomes,
- improve trust calibration,
- increase confidence for weak-fit/watchout explanations.

If telemetry is sparse/incomplete, schema still works, but advanced model heads remain low-evidence.

---

## 7) Full exhaustive references (give these too)

For complete machine-readable mapping of every data point and model:

- `docs/Models/04_TechPulse/TechPulse_Azure_Database_Master_Documentation.md`
- `docs/Models/04_TechPulse/TechPulse_Azure_DataPoint_Catalog.csv`
- `docs/Models/04_TechPulse/TechPulse_Azure_Dataset_To_Model_Map.csv`
- `docs/Models/04_TechPulse/TechPulse_Azure_DataPoint_Model_Mapping.csv`
- `docs/Models/04_TechPulse/TechPulse_Azure_Model_Catalog.csv`

This guide is the human handoff; those files are the full source map.
