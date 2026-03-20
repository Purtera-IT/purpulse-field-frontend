# Purpulse Field App telemetry audit report

## Executive summary

I audited the uploaded TechPulse lineage package together with the accessible `Purtera-IT/purpulse-fieldapp` repo surface. The TechPulse package defines **260** raw datapoint tokens and **3187** feature-lineage rows, with the first-wave field-app obligations concentrated in dispatch, travel/arrival, runbook, artifact, QC, closeout, escalation, feedback, tool-check, domain-tool, and job-context event families. The app already contains the beginnings of an offline-first, privacy-aware telemetry stack, but most flows still mutate app state or Base44 entities directly instead of emitting immutable, idempotent, canonical telemetry envelopes shaped for Azure ingestion.

For field-app/either-owned datapoints, effective coverage is **62/172 = 36.0%** when partial implementations are counted, but only **6/172 = 3.5%** are fully present in a model-ready, atlas-shaped form. The biggest gaps are not only missing fields, but missing *contract structure*: the current app often stores `client_event_id`, `device_ts`, and `assignee_id` while the atlas requires a stable event envelope with `event_id`, `schema_version`, `event_ts_utc`, `technician_id`, `source_system`, and consent-aware location/device context. This means Azure can receive some operational facts today, but not yet with the consistency, replay safety, or observability needed for training/serving confidence.

My recommendation is to land the P0 patch series in this package first, then extend the same canonical pattern to the remaining event families. That gives you a fast path to higher-fidelity dispatch/travel/artifact/QC facts without waiting for a full app rewrite.

## One complete end-to-end example first: `dispatch_event`

### Why this event was chosen

`dispatch_event` is a high-fanout, day-one telemetry family in the TechPulse package. The field-app guide requires a minimum event envelope for every field event and explicitly lists dispatch lifecycle capture into `core.fact_dispatch_event` for offer/accept/decline/cancel/reschedule/ETA workflows.

### ZIP/doc references

- Minimum envelope contract: `TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:61-81`
- Dispatch lifecycle family and target table: `TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md:85-110`

### Where the current repo is partial

- `src/hooks/useJobQueue.js:20-27` maps only UI-oriented statuses from `check_in`, `work_start`, and `work_stop`.
- `src/hooks/useJobQueue.js:61-79` flushes queued entries by directly mutating `base44.entities.Job.update(...)`.
- `src/hooks/useJobQueue.js:111-122` builds a queue entry with `client_event_id`, `device_ts`, and `assignee_id` rather than the atlas envelope.
- `src/lib/telemetry.js:81-110` sends privacy-scrubbed analytics events to Base44/Sentry, but not canonical Azure-ready field facts.

### Gap summary

The app already knows **when** a technician transitions into check-in/work-start states, but it treats that as mutable job state rather than an immutable dispatch fact. As a result, downstream model tables cannot reliably distinguish an offline replay, a duplicate retry, a corrected status, or a privacy-suppressed location from a first-write event.

### Generated example artifacts

- Schema: [`specs/dispatch_event.json`](specs/dispatch_event.json)
- Client snippet: [`specs/dispatch_event_client.ts`](specs/dispatch_event_client.ts)
- Server handler: [`specs/dispatch_event_server.py`](specs/dispatch_event_server.py)
- OpenAPI fragment: [`specs/dispatch_event_openapi.yaml`](specs/dispatch_event_openapi.yaml)
- Test cases: [`specs/dispatch_event_test.md`](specs/dispatch_event_test.md)
- Apply-ready patch: [`patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch`](patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch)
- PR text: [`patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop_PR.md`](patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop_PR.md)

### Recommended Azure column mapping for the example

Target table: `core.fact_dispatch_event`

| Payload field | Azure column | Rule |
|---|---|---|
| `event_id` | `event_id` | Use as idempotency key and event primary identifier. |
| `schema_version` | `schema_version` | Persist verbatim for compatibility routing. |
| `event_ts_utc` | `event_ts_utc` | Canonical event time in UTC. |
| `client_ts` | `device_ts_local` or raw client-time column | Preserve original client-side timestamp. |
| `job_id` | `job_id` | Persist verbatim. |
| `dispatch_id` | `dispatch_id` | Nullable but preferred if dispatch exists apart from job. |
| `technician_id` | `technician_id` | Must be stable, non-email identifier. |
| `site_id` | `site_id` | Nullable. |
| `status` | `dispatch_status` | Normalize to lowercase enum. |
| `promised_eta_utc` | `promised_eta_utc` | ISO8601 UTC only. |
| `location.lat/lon` | location columns | Store only when consented; otherwise explicit null. |
| `telemetry_consent.*` | consent columns | Persist to support downstream filtering and legal audit. |

### What the patch changes

The dispatch patch adds a reusable ingestion client, a canonical dispatch emitter, a serverless ingestion stub, an OpenAPI fragment, and a focused test. It also upgrades `useJobQueue` so queue entries carry canonical identifiers/context and so queue flush emits `dispatch_event` facts before mutating job state.

## A. Repo and ZIP inventory

### Generated inventory artifacts

- Raw-token to feature/table inventory: [`data_inventory.csv`](data_inventory.csv)
- Repo datapoint/code mapping: [`repo_datapoint_mapping.csv`](repo_datapoint_mapping.csv)
- Metric ownership split: [`metrics_ownership.csv`](metrics_ownership.csv)

### Inventory highlights

- Raw token universe from package: **260**
- Feature lineage rows from package: **3187**
- Field-app or either-owned tokens: **172**
- Backend-owned / out-of-scope-for-client tokens: **88**

## B. Coverage and consistency audit

See the full write-up in [`coverage_matrix.md`](coverage_matrix.md) and the detailed issue list in [`missing_items.md`](missing_items.md).

### Coverage snapshot

| Metric | Value |
|---|---:|
| Total raw tokens | 260 |
| Field-app/either scope | 172 |
| Fully present | 6 |
| Partial | 56 |
| Missing | 110 |
| Present + partial | 62 |
| Field-app coverage incl. partials | 36.0% |
| Field-app coverage fully present only | 3.5% |

### Most important consistency mismatches

1. **Envelope mismatch** — the repo mostly emits `client_event_id`/`device_ts` or mutates entities directly; the atlas requires `event_id`, `schema_version`, `event_ts_utc`, `technician_id`, `source_system`, and event-family-specific attributes.
2. **Identity mismatch** — some current flows use email-style assignee IDs instead of a stable `technician_id`.
3. **Unit mismatch** — several app flows track durations in seconds while the atlas expects minute-based metrics such as `*_duration_min`.
4. **Travel/arrival conflation** — UI flows treat travel-end as arrival, but the atlas requires separate `fact_travel_event` and `fact_arrival_event` facts.
5. **Consent inconsistency** — `telemetry.js` scrubs lat/lon broadly, but evidence/QC flows may still store geodata directly; consent handling needs one canonical policy.
6. **Queue inconsistency** — localStorage and Dexie both exist, and some repository drain methods are stubs, so offline durability is only partial.

## C. Implementation plan and API hooks

The generated `specs/` folder contains machine-readable schemas, client snippets, server handlers, OpenAPI fragments, and test cases for these event families:

- `dispatch_event`
- `travel_event`
- `arrival_event`
- `runbook_step_event`
- `artifact_event`
- `qc_event`
- `closeout_event`
- `escalation_event`
- `feedback_event`
- `tool_check_event`
- `domain_tool_log`
- `job_context_field`

The cross-cutting ingestion, batching, retry, auth, idempotency, and observability recommendations are captured in [`infrastructure/ingestion_strategy.md`](infrastructure/ingestion_strategy.md).

## D. Schema versioning and migration

Recommended policy:

- Use semantic versioning on every event envelope (`MAJOR.MINOR.PATCH`).
- Patch = non-breaking metadata additions or docs-only clarifications.
- Minor = additive optional fields or enum growth that ingestion can safely ignore.
- Major = renamed fields, changed types, removed fields, or semantic meaning changes.
- Persist both `schema_version` and a server-derived `ingest_contract_version` for replay/debugging.
- Keep server validators backward-compatible for at least one previous minor version and one explicitly supported major version during rollout.

Migration plan:

1. Dual-write old and new event shapes for one release window.
2. Add server-side transformation shims that materialize the canonical Azure columns from the older payload.
3. Backfill historical rows only where the old payload can be converted without ambiguity; otherwise mark `migration_status = not_backfillable`.
4. After dashboards and model features are validated against the new shape, retire the legacy emitter.

## E. Deliverables index

### Top-level artifacts

- [`data_inventory.csv`](data_inventory.csv)
- [`metrics_ownership.csv`](metrics_ownership.csv)
- [`coverage_matrix.md`](coverage_matrix.md)
- [`missing_items.md`](missing_items.md)
- [`repo_datapoint_mapping.csv`](repo_datapoint_mapping.csv)
- [`infrastructure/ingestion_strategy.md`](infrastructure/ingestion_strategy.md)

### Specs folder

- [`specs/dispatch_event.json`](specs/dispatch_event.json)
- [`specs/dispatch_event_client.ts`](specs/dispatch_event_client.ts)
- [`specs/dispatch_event_server.py`](specs/dispatch_event_server.py)
- [`specs/dispatch_event_openapi.yaml`](specs/dispatch_event_openapi.yaml)
- [`specs/dispatch_event_test.md`](specs/dispatch_event_test.md)
- [`specs/travel_event.json`](specs/travel_event.json)
- [`specs/travel_event_client.ts`](specs/travel_event_client.ts)
- [`specs/travel_event_server.py`](specs/travel_event_server.py)
- [`specs/travel_event_openapi.yaml`](specs/travel_event_openapi.yaml)
- [`specs/travel_event_test.md`](specs/travel_event_test.md)
- [`specs/arrival_event.json`](specs/arrival_event.json)
- [`specs/arrival_event_client.ts`](specs/arrival_event_client.ts)
- [`specs/arrival_event_server.py`](specs/arrival_event_server.py)
- [`specs/arrival_event_openapi.yaml`](specs/arrival_event_openapi.yaml)
- [`specs/arrival_event_test.md`](specs/arrival_event_test.md)
- [`specs/runbook_step_event.json`](specs/runbook_step_event.json)
- [`specs/runbook_step_event_client.ts`](specs/runbook_step_event_client.ts)
- [`specs/runbook_step_event_server.py`](specs/runbook_step_event_server.py)
- [`specs/runbook_step_event_openapi.yaml`](specs/runbook_step_event_openapi.yaml)
- [`specs/runbook_step_event_test.md`](specs/runbook_step_event_test.md)
- [`specs/artifact_event.json`](specs/artifact_event.json)
- [`specs/artifact_event_client.ts`](specs/artifact_event_client.ts)
- [`specs/artifact_event_server.py`](specs/artifact_event_server.py)
- [`specs/artifact_event_openapi.yaml`](specs/artifact_event_openapi.yaml)
- [`specs/artifact_event_test.md`](specs/artifact_event_test.md)
- [`specs/qc_event.json`](specs/qc_event.json)
- [`specs/qc_event_client.ts`](specs/qc_event_client.ts)
- [`specs/qc_event_server.py`](specs/qc_event_server.py)
- [`specs/qc_event_openapi.yaml`](specs/qc_event_openapi.yaml)
- [`specs/qc_event_test.md`](specs/qc_event_test.md)
- [`specs/closeout_event.json`](specs/closeout_event.json)
- [`specs/closeout_event_client.ts`](specs/closeout_event_client.ts)
- [`specs/closeout_event_server.py`](specs/closeout_event_server.py)
- [`specs/closeout_event_openapi.yaml`](specs/closeout_event_openapi.yaml)
- [`specs/closeout_event_test.md`](specs/closeout_event_test.md)
- [`specs/escalation_event.json`](specs/escalation_event.json)
- [`specs/escalation_event_client.ts`](specs/escalation_event_client.ts)
- [`specs/escalation_event_server.py`](specs/escalation_event_server.py)
- [`specs/escalation_event_openapi.yaml`](specs/escalation_event_openapi.yaml)
- [`specs/escalation_event_test.md`](specs/escalation_event_test.md)
- [`specs/feedback_event.json`](specs/feedback_event.json)
- [`specs/feedback_event_client.ts`](specs/feedback_event_client.ts)
- [`specs/feedback_event_server.py`](specs/feedback_event_server.py)
- [`specs/feedback_event_openapi.yaml`](specs/feedback_event_openapi.yaml)
- [`specs/feedback_event_test.md`](specs/feedback_event_test.md)
- [`specs/tool_check_event.json`](specs/tool_check_event.json)
- [`specs/tool_check_event_client.ts`](specs/tool_check_event_client.ts)
- [`specs/tool_check_event_server.py`](specs/tool_check_event_server.py)
- [`specs/tool_check_event_openapi.yaml`](specs/tool_check_event_openapi.yaml)
- [`specs/tool_check_event_test.md`](specs/tool_check_event_test.md)
- [`specs/domain_tool_log.json`](specs/domain_tool_log.json)
- [`specs/domain_tool_log_client.ts`](specs/domain_tool_log_client.ts)
- [`specs/domain_tool_log_server.py`](specs/domain_tool_log_server.py)
- [`specs/domain_tool_log_openapi.yaml`](specs/domain_tool_log_openapi.yaml)
- [`specs/domain_tool_log_test.md`](specs/domain_tool_log_test.md)
- [`specs/job_context_field.json`](specs/job_context_field.json)
- [`specs/job_context_field_client.ts`](specs/job_context_field_client.ts)
- [`specs/job_context_field_server.py`](specs/job_context_field_server.py)
- [`specs/job_context_field_openapi.yaml`](specs/job_context_field_openapi.yaml)
- [`specs/job_context_field_test.md`](specs/job_context_field_test.md)

### Patch set

- Patch index and apply instructions: [`patches/README.md`](patches/README.md)
- [`patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch`](patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch)
- [`patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop_PR.md`](patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop_PR.md)
- [`patches/0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch`](patches/0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch)
- [`patches/0002-feat-field-app-emit-travel_event-and-arrival_event-t_PR.md`](patches/0002-feat-field-app-emit-travel_event-and-arrival_event-t_PR.md)
- [`patches/0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch`](patches/0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch)
- [`patches/0003-feat-field-app-emit-canonical-artifact_event-and-qc__PR.md`](patches/0003-feat-field-app-emit-canonical-artifact_event-and-qc__PR.md)

## F. Prioritization and timeline

### Priority ranking

| Priority | Fix | Complexity | Why |
|---|---|---|---|
| P0 | Canonical envelope + ingestion client + idempotent server path | M | Every downstream model fact depends on this wrapper. |
| P0 | Dispatch lifecycle as immutable `dispatch_event` | M | Highest fan-out and currently only partial via job-state mutation. |
| P0 | Split `travel_event` and `arrival_event` | M | Required for ETA, trust, no-show, and route adherence features. |
| P0 | Canonical `artifact_event` and `qc_event` | M | Evidence/QC are already partially present and can be upgraded quickly. |
| P0 | Stable `technician_id` and consent-aware location handling | S-M | Prevents PII leakage and improves feature joins. |
| P1 | Canonical `runbook_step_event` | M | Large feature fan-out; current data is close but not normalized. |
| P1 | Canonical `closeout_event`, `escalation_event`, `feedback_event` | M | Needed for resolution quality, trust, and coaching loops. |
| P1 | `tool_check_event` and `domain_tool_log` | M-L | Important for readiness and process-compliance models. |
| P1 | Durable unified offline queue (Dexie-first) | M-L | Removes localStorage/Dexie split and replay ambiguity. |
| P2 | `job_context_field` snapshots | M | Valuable but lower urgency than first-wave immutable events. |
| P2 | Richer acknowledgements and review flags from atlas long tail | L | Many fields require additional UI or workflow states. |

### P0 one-workday implementation checklist for a senior engineer

1. Apply patch 0001 and verify `useJobQueue` still behaves normally while emitting `dispatch_event`.
2. Replace any email-derived assignee identity with stable `technician_id` sourced from authenticated session or profile lookup.
3. Stand up the `/api/v1/telemetry/dispatch` ingestion route behind bearer auth and idempotency storage.
4. Apply patch 0002 and verify `travel_start`, `travel_end`, and `work_start` produce separate `travel_event` and `arrival_event` facts.
5. Apply patch 0003 and verify upload completion emits `artifact_event` and AdminQC moderation emits `qc_event`.
6. Wire Event Hub or the canonical ingestion endpoint to persist `event_id`, `schema_version`, and consent flags.
7. Add AppInsights dashboards for accepted, failed, duplicate, and schema-invalid event counts.
8. Run the focused tests plus one offline replay drill and one duplicate replay drill in staging.

## G. Security and privacy constraints

| Sensitive datapoint | Risk | UX / consent requirement | Protection | Retention recommendation |
|---|---|---|---|---|
| GPS lat/lon / geofence | Precise location, worker privacy | Explicit location opt-in with separate rationale from generic analytics | TLS in transit, encrypted storage, omit/null when not consented, coarse geohash for many analytics uses | Raw precise coords 30-90 days; derived coarse aggregates longer |
| Device identifiers | Persistent tracking | Device telemetry opt-in separate from essential crash/error logging | Hash or pseudonymize device ID before storage where possible | 90 days raw, longer only in aggregated observability stores |
| Technician identifier | Employment/personnel data | May be essential for operational processing; disclose in privacy notice | Use opaque technician ID, never email/phone as join key | Retain per operational and model governance policy |
| Photos / videos / documents | May contain faces, addresses, signatures | Capture-time notice and redaction option; require stronger notice for training approval | Encrypt at rest, signed URL access, malware scanning, face/license-plate redaction where relevant | Keep raw artifacts only as long as operational/QC need; shorter for rejected artifacts |
| Signatures | Biometric-like legal artifact | Explicit signoff step and purpose statement | Encrypt at rest, strict RBAC, avoid embedding in analytics payloads | Operational retention only, not broad ML retention |
| Customer notes / free text | May contain PII or sensitive context | Notice in input UI; discourage unnecessary personal details | Server-side PII detection/redaction before ML use | Short raw retention; store derived labels/features longer |
| Bounding boxes / labels | Could reveal people or private objects | QC/training approval workflow | Tie to approved-for-training state and artifact ACLs | Keep with approved training artifact lifecycle |
| Phone/email/address fields | Direct PII | Do not collect in telemetry unless strictly necessary | Strip from telemetry envelope, use operational systems of record instead | Avoid storing in telemetry; if unavoidable, shortest possible retention |

## Assumptions and validation notes

- Assumed Azure tables named in the TechPulse docs already exist and are the canonical storage targets.
- Assumed bearer auth can be supplied either by Azure AD / MSAL or the existing authenticated app session.
- Assumed a stable `technician_id` can be resolved from the current user profile; if not, add a server-side identity translation layer before write.
- Assumed Event Hub or an equivalent ingestion endpoint is preferred over direct client-to-table writes for reliability and back-pressure.
- When an item is marked **NOT FOUND** or **MISSING**, the search scope is the accessible local repo surface plus the manually captured server-function review noted in `coverage_matrix.md`.

## Recommended next step

Land the three P0 patches, validate the envelope contract in staging, and then extend the same exact pattern to `runbook_step_event`, `closeout_event`, `escalation_event`, and `feedback_event` using the generated specs as the implementation source of truth.
