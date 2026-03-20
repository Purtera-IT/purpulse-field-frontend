# Canonical event families → Azure `core.fact_*` (loader mapping)

**Purpose (Iteration 12):** Single source of truth for ingestion / bronze loaders: which JSON Schema validates each family, which field-app module emits it, and how it maps to **silver** `core.fact_*` per [TechPulse_Azure_Database_Master_Documentation.md](../TechPulse_Full_Lineage_Atlas_Package/TechPulse_Azure_Database_Master_Documentation.md).

**Machine-readable index:** [canonical_event_families.manifest.json](./canonical_event_families.manifest.json) (validated by `npm run validate:canonical-manifest`). Includes **`ingestion_pipeline`** (paths to `enqueueCanonicalEvent`, `sendCanonicalEnvelope`, `buildCanonicalEnvelope`) and **`additional_emit_exports`** where one module emits multiple families (e.g. `travelArrivalEvent.js`).

---

## Contract (all families)

| Concern | Rule |
|--------|------|
| **Idempotency** | `event_id` (UUID) — same id must not double-insert in silver. |
| **Envelope** | `schema_version`, `event_name`, `event_ts_utc`, `client_ts`, `source_system` (= `field_app`), `job_id`, `technician_id`. Field Nation / work-order external IDs are **not** in current field-app JSON schemas; silver loaders can join via `job_id` → `core.dim_*` when those dimensions exist. |
| **Payload** | Family-specific keys only; field app strips via `*_PROPERTY_KEYS` before `enqueueCanonicalEvent`. |
| **Server** | Add `ingest_received_utc`, batch / loader version; map JSON → fact columns 1:1 where names align; nullable columns for optional schema fields. |

### Silver column alignment

Payload keys use **snake_case** matching intended `core.fact_*` column names where the master doc aligns. Loaders should not rename keys; add only operational columns (`ingest_received_utc`, lineage ids, etc.).

---

## Families implemented in field app (Iterations 3–11)

| `event_name` | Silver table | JSON Schema | Field-app module | Allowlist export |
|--------------|--------------|-------------|------------------|------------------|
| `dispatch_event` | `core.fact_dispatch_event` | [dispatch_event.json](./dispatch_event.json) | `src/lib/dispatchEvent.js` | `DISPATCH_EVENT_PROPERTY_KEYS` |
| `travel_event` | `core.fact_travel_event` | [travel_event.json](./travel_event.json) | `src/lib/travelArrivalEvent.js` | `TRAVEL_EVENT_PROPERTY_KEYS` |
| `arrival_event` | `core.fact_arrival_event` | [arrival_event.json](./arrival_event.json) | `src/lib/travelArrivalEvent.js` | `ARRIVAL_EVENT_PROPERTY_KEYS` |
| `runbook_step_event` | `core.fact_runbook_step_event` | [runbook_step_event.json](./runbook_step_event.json) | `src/lib/runbookStepEvent.js` | `RUNBOOK_STEP_EVENT_PROPERTY_KEYS` |
| `artifact_event` | `core.fact_artifact_event` | [artifact_event.json](./artifact_event.json) | `src/lib/artifactEvent.js` | `ARTIFACT_EVENT_PROPERTY_KEYS` |
| `qc_event` | `core.fact_qc_event` | [qc_event.json](./qc_event.json) | `src/lib/qcEvent.js` | `QC_EVENT_PROPERTY_KEYS` |
| `closeout_event` | `core.fact_closeout_event` | [closeout_event.json](./closeout_event.json) | `src/lib/closeoutEvent.js` | `CLOSEOUT_EVENT_PROPERTY_KEYS` |
| `escalation_event` | `core.fact_escalation_event` | [escalation_event.json](./escalation_event.json) | `src/lib/escalationEvent.js` | `ESCALATION_EVENT_PROPERTY_KEYS` |
| `feedback_event` | `core.fact_feedback_event` | [feedback_event.json](./feedback_event.json) | `src/lib/feedbackEvent.js` | `FEEDBACK_EVENT_PROPERTY_KEYS` |
| `tool_check_event` | `core.fact_tool_check_event` | [tool_check_event.json](./tool_check_event.json) | `src/lib/toolCheckEvent.js` | `TOOL_CHECK_EVENT_PROPERTY_KEYS` |
| `job_context_field` | `core.fact_job_context_field` | [job_context_field.json](./job_context_field.json) | `src/lib/jobContextField.js` | `JOB_CONTEXT_FIELD_PROPERTY_KEYS` |

**Ingestion entrypoint (field app):** `src/lib/telemetryQueue.js` → `enqueueCanonicalEvent`; HTTP flush → `src/api/telemetryIngestion.js` → `sendCanonicalEnvelope`. Envelope assembly → `src/lib/telemetryEnvelope.js` (`buildCanonicalEnvelope`, `CANONICAL_SCHEMA_VERSION`).

---

## Deferred / not in field app

| Topic | Notes |
|-------|--------|
| **`domain_tool_log`** | `core.fact_domain_tool_log` exists in master doc §3; no `Azure Analysis/domain_tool_log.json` and no emitter in this repo (Iteration 10 explicitly excluded). |
| **`ping_event`** | `buildPingEnvelope` in `src/lib/telemetryEnvelope.js` for dev/health; no silver `fact_ping` in §3 inventory. |

---

## Downstream consumers (from model catalog)

Examples in [TechPulse_Azure_Model_Catalog.csv](../TechPulse_Full_Lineage_Atlas_Package/TechPulse_Azure_Model_Catalog.csv): **Universal State Encoder** and related features read multiple `core.fact_*` rows; **feature** / **serving** models (e.g. technician skill state, job–tech fit) consume silver facts — see CSV columns *Primary Inputs* / *Primary Outputs* per model id. Loaders should preserve `event_id`, `job_id`, `technician_id`, and timestamps for join keys.

---

## Archived patches (repo root of `Azure Analysis/`)

See [PATCHES_STATUS.md](./PATCHES_STATUS.md): `0001`–`0003` `*.patch` files target a pre-refactor tree; **do not `git am`** — current code lives under `src/lib/*` and `src/api/telemetryIngestion.js`.
