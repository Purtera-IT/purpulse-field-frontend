# Purpulse Field App

Field app for technicians (Base44 project — view and edit on [Base44.com](https://Base44.com)). This repo also contains the **TechPulse data lineage package** (what to train on) and **Azure Analysis** (how to wire the app into Azure). This README explains how all three fit together.

**Execution guide (UI, ingestion, Azure mapping):** [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) — screens → event families → `core.fact_*`, geospatial map UX, pipeline diagram, coverage backlog, and Field Nation boundary.

**Cursor build playbook (ordered iterations + prompt template):** [CURSOR_FIELD_APP_ITERATIONS.md](CURSOR_FIELD_APP_ITERATIONS.md) — use this when splitting the execution guide into per-session implementation tasks.

**Telemetry ingest (Iteration 1):** [.env.example](.env.example) — `VITE_TELEMETRY_INGESTION_URL` (full POST URL), optional dev IDs. Dev panel: Profile page in dev mode. Details in [FIELD_APP_TECHPULSE_AZURE_README.md](FIELD_APP_TECHPULSE_AZURE_README.md) §6.1.

---

## The big picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FIELD APP (this repo: src/, base44/)                                       │
│  Technicians use it for jobs, check-in, runbooks, evidence, QC, closeout.   │
│  Today: many flows mutate app/Base44 state; few emit canonical telemetry.    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │  canonical event envelopes
                                        │  (event_id, schema_version, technician_id, …)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AZURE INGESTION (Azure Analysis folder)                                    │
│  Validate → idempotency → Event Hubs / queues → bronze → silver → gold       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TECHPULSE MODELS (TechPulse_Full_Lineage_Atlas_Package)                    │
│  core.fact_* tables → feature tables → ranking/risk/quality/trust models    │
│  Used for: fit scores, no-show risk, late arrival, QC, trust, calibration  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **TechPulse package** = definition of the models and the data they need (training/lineage).
- **This app** = the technician-facing product that should *produce* that data.
- **Azure Analysis** = audit of gaps + ingestion strategy + patches to wire the app into Azure in the right shape.

---

## 1. TechPulse Full Lineage Atlas Package

**Location:** `TechPulse_Full_Lineage_Atlas_Package/`

This folder is the **source of truth for what data the models need**. It describes:

- **260** raw datapoint tokens and **3,187** feature/lineage rows.
- **Core fact tables** in Azure that events must land in.
- **Models** that consume those facts (ranking, risk, quality, trust, calibration).

### Event families and where they land

Every field action that matters for training should produce an **immutable event** that lands in one of these core tables:

| Event family            | Azure table                  | What to capture |
|-------------------------|-----------------------------|-----------------|
| Dispatch lifecycle      | `core.fact_dispatch_event`  | Offer, accept/decline, cancel, reschedule, ETA |
| Travel                  | `core.fact_travel_event`    | Depart, ETA updates, geofence enter/exit |
| Arrival                 | `core.fact_arrival_event`   | Check-in time, access delay |
| Runbook steps           | `core.fact_runbook_step_event` | Step start/end, duration, blocker, rework |
| QC outcomes             | `core.fact_qc_event`        | Pass/fail, defect, first-pass, retest |
| Artifacts / docs        | `core.fact_artifact_event`  | Photo/doc present, quality, signoff |
| Closeout                | `core.fact_closeout_event`  | Completion, signoff |
| Escalations             | `core.fact_escalation_event`| Created/resolved, reason, response lag |
| Feedback                | `core.fact_feedback_event`  | Rating, complaint/compliment |
| Tool checks             | `core.fact_tool_check_event`| Readiness, calibration |
| Domain tool usage       | `core.fact_domain_tool_log` | Tool outputs, validation |
| Job context             | `core.fact_job_context_field`| Structured scope fields for encoding |

### Minimum event contract (from TechPulse)

Every event payload should have:

- `event_id` (UUID), `event_ts_utc`, `technician_id`, `job_id`, `site_id` (if applicable)
- `source_system` = `"field_app"`
- Event-specific attributes

Recommended: `device_ts_local`, `app_version`, `connectivity_state`, `event_sequence_no`, `schema_version`.

### Key files in the package

| File | Purpose |
|------|--------|
| `TechPulse_Full_Data_Lineage_Atlas.md` | Overview: object counts, raw tokens, feature lineage, how to use with the field app |
| `TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md` | **Main handoff**: what to capture, where it lands, which models use it |
| `TechPulse_Azure_Database_Master_Documentation.md` | Azure storage blueprint: bronze/silver/gold, core/feature/serving tables |
| `TechPulse_Azure_Model_Catalog.csv` | All models: purpose, required datasets, outputs, training cadence |
| `TechPulse_Raw_DataPoint_Dictionary_Exploded.csv` | 260 raw datapoints → target objects, features, models |
| `TechPulse_Full_Feature_DataPoint_Lineage.csv` | 3,187 feature/lineage rows |
| `TechPulse_Full_Object_Lineage_Map.csv` | Object grain, PKs, retention, refresh |

Models in the catalog include: **Eligibility Gate**, **Trust Composer**, **No-Show/Cancellation Risk**, **Late Arrival Risk**, **QC Failure / First-Pass**, **Documentation Failure**, **Universal State Encoder**, **Domain Expert Bank**, **Pair Interaction Cross-Encoder**, **Calibration**, and others. All depend on the core fact tables above.

---

## 2. The field app (this repo)

**Location:** `src/`, `base44/`, `public/`

The app technicians use for:

- Viewing and accepting jobs, check-in, work start/stop
- Time entries (travel start, arrival, work)
- Runbooks and step completion
- Evidence upload and QC
- Closeout and feedback

### Relevant app areas (for telemetry wiring)

- **Job/queue and dispatch:** `src/hooks/useJobQueue.js` — today maps check-in/work_start/work_stop and flushes via `base44.entities.Job.update(...)`; should also emit canonical `dispatch_event` (and travel/arrival where applicable).
- **Telemetry:** `src/lib/telemetry.js` — sends analytics to Base44/Sentry; not yet canonical Azure envelopes.
- **Time entries:** TimeLog transitions (travel start, arrival, work start) — should emit `travel_event` and `arrival_event`.
- **Evidence/upload:** `src/lib/uploadQueue.ts`, `src/hooks/useUploadQueue.js` — should emit `artifact_event` on completion.
- **QC:** AdminQC moderation flow — should emit `qc_event`.
- **Auth/identity:** `src/lib/auth.ts`, session — need stable `technician_id` (not email) for every event.

The TechPulse guide and Azure Analysis both assume events are **immutable facts** (emit first, then mutate app/Base44 state), with a **canonical envelope** and **idempotent** ingestion so Azure can safely replay and dedupe.

---

## 3. Azure Analysis (wiring the field app to Azure)

**Location:** `Azure Analysis/`

This folder is the **implementation kit** for connecting the field app to Azure: audit of what’s missing, ingestion design, and apply-ready patches.

### What’s in Azure Analysis

| Artifact | Purpose |
|----------|--------|
| **audit_report.md** | Executive summary: coverage gaps, why `dispatch_event` was chosen first, recommended Azure column mapping, security/privacy table |
| **coverage_matrix.md** | Coverage by event family (present/partial/missing), high-priority missing raw tokens |
| **missing_items.md** | Gaps with **code pointers** (e.g. `useJobQueue.js`, `telemetry.js`): what’s wrong and what to change |
| **ingestion_strategy.md** | **Full ingestion design:** auth (MSAL/Azure AD), batching, retry/backoff, idempotency, offline queue, schema versioning, transformation rules, SLOs, metrics, Application Insights, dead-letter, **rollout order** |
| **README.md** | How to apply the three P0 patches with `git am` and how to validate (lint, tests) |
| **Patches (0001–0003)** | Implement canonical dispatch, travel/arrival, and artifact/QC events; upgrade useJobQueue and related flows to emit before mutating state |
| **PR .md files** | PR descriptions and reviewer notes for each patch |
| **dispatch_event*.json/ts/yaml/md** | Reference: JSON Schema, client snippet, server handler, OpenAPI fragment, test cases for `dispatch_event` |
| **data_inventory.csv**, **repo_datapoint_mapping.csv**, **metrics_ownership.csv** | Raw tokens → features/tables; repo ↔ datapoints; metric ownership |

### Current gap (from the audit)

- **Field-app scope:** 172 raw tokens; only **6** fully present in model-ready form (**3.5%**); **56** partial (**36%** including partials).
- **Main issues:**  
  - No canonical envelope (`event_id`, `schema_version`, `event_ts_utc`, `technician_id`, `source_system`) across the app.  
  - Identity: email-style assignee instead of stable `technician_id`.  
  - Travel/arrival conflated in UI; atlas needs separate `fact_travel_event` and `fact_arrival_event`.  
  - Many flows mutate Base44/app state without emitting immutable events first.

### Recommended rollout (from ingestion_strategy.md)

1. Common canonical envelope + queue  
2. `dispatch_event`  
3. `travel_event` + `arrival_event`  
4. `artifact_event`  
5. `runbook_step_event`  
6. `qc_event`  
7. `closeout_event`  
8. `escalation_event`, `feedback_event`, `tool_check_event`, `domain_tool_log`, `job_context_field`

The **P0 patches** in `Azure Analysis` implement steps 1–4 (envelope + dispatch + travel/arrival + artifact/QC) and are intended to be applied with `git am` and then validated (lint + focused tests).

---

## 4. End-to-end flow (target state)

1. **Field app** — On each significant action (dispatch change, travel start, arrival, runbook step, artifact upload, QC, etc.), build a **canonical event** (per TechPulse contract and schemas in Azure Analysis).
2. **Client** — Queue event locally (encrypted at rest when possible); send when online; retry with backoff; use `event_id` for idempotency.
3. **Ingestion API** — Validate schema and auth, enforce idempotency by `event_id`, enrich with auth context, write to **Event Hubs** (or equivalent) and optional dead-letter.
4. **Azure** — Bronze → silver/gold; build **feature** and **serving** tables; run **TechPulse models** (ranking, risk, QC, trust, etc.).
5. **Product** — Use model outputs (fit scores, risk, trust decomposition) in dispatch, staffing, and operator UIs.

---

## 5. Implementation plan (what to build next)

**See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** for a step-by-step plan:

- **Phase 1 — Foundation:** Canonical event envelope, stable `technician_id`, single telemetry queue, ingestion client.
- **Phase 2 — Field app capture:** What to add in the UI/code for each event family (dispatch, travel/arrival, artifact, runbook, QC, closeout, escalation, feedback, tool check, job context), with file pointers.
- **Phase 3 — Azure wiring:** Ingestion API, idempotency store, Event Hubs, observability, env/secrets.
- **Phase 4 — Hardening:** Offline, consent, schema versioning, security/privacy.
- **Phase 5 — Validation and rollout:** Checklist, recommended order, and easy-to-miss steps.

---

## 6. Where to find what

| Need | Look here |
|------|-----------|
| What models exist and what data they need | `TechPulse_Full_Lineage_Atlas_Package/` — start with `TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md` and `TechPulse_Azure_Model_Catalog.csv` |
| Exact event contract and core tables | Same package: Field App guide + `TechPulse_Azure_Database_Master_Documentation.md` |
| What’s missing in the app and where in code | `Azure Analysis/missing_items.md`, `coverage_matrix.md`, `audit_report.md` |
| How to ingest (auth, batching, idempotency, SLOs) | `Azure Analysis/ingestion_strategy.md` |
| Apply P0 event patches | `Azure Analysis/README.md` and the `0001`–`0003` patch files |
| Example schema and client/server for one event | `Azure Analysis/dispatch_event.json`, `dispatch_event_client.ts`, `dispatch_event_server.py`, `dispatch_event_openapi.yaml`, `dispatch_event_test.md` |

---

## 7. Field Nation work order flow (Purpulse.app → Field app)

Work orders are created in **Purpulse.app** (Atlas Dispatch), sent to **Field Nation** (sandbox API), and when a technician picks one up, the job and runbook are mapped back to them via **FNID** (`technicians.fieldnation_provider_id` in the Azure backend). The technician then uses this field app to view the runbook and complete the work.

- **Full build plan (Purpulse.app):** In the Purpulse.app repo, see `docs/FIELD_NATION_WORK_ORDER_FLOW.md`. It covers: creating a work order from Atlas Dispatch job details, assigning a technician, calling the Field Nation sandbox API, syncing “picked up” events by FNID, and linking runbook/artifacts to the technician.
- **Field app changes:** Login with **Field Nation ID** (or magic link carrying FNID) so the backend can resolve FNID → Purpulse profile and assign work orders; “my jobs” returns work orders where `assigned_to` = current user; optional “create account” prompt when opening the app from an assignment link. Runbook and artifacts are loaded from the Purpulse API for the assigned work order.

---

## 8. Running the app locally

- **Prerequisites:** Node, npm, Base44 project.
- **Setup:** Clone repo, `npm install`, create `.env.local` with `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL`.
- **Azure mapping (Iteration 12):** `npm run validate:canonical-manifest` — checks [canonical_event_families.manifest.json](Azure%20Analysis/canonical_event_families.manifest.json) against schemas and `src/lib` emitters.
- **QA smoke (Iteration 13):** `npm run test:iteration13` — telemetry ingest + queue + consent ([Azure Analysis/iteration13_client_qa.md](Azure%20Analysis/iteration13_client_qa.md)). Full unit suite: `npm test`.
- **Run:** `npm run dev`
- **Publish:** Use [Base44.com](https://Base44.com) to publish after pushing changes.

---

*Summary: **TechPulse** defines the models and the data they need. The **field app** is the technician UI that must emit that data as canonical events. **Azure Analysis** is the audit, ingestion design, and patches that wire the app into Azure so the TechPulse pipeline can train and serve.*
