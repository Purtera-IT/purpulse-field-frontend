# Ingestion strategy

## 1) Recommended architecture

**Recommended write path**

1. Field app emits a canonical event envelope for each atlas event family.
2. Event is queued locally (encrypted at rest when device/browser platform supports it).
3. Foreground send is attempted immediately when online.
4. Server validates schema + auth, enriches with auth context and receipt metadata, then writes:
   - idempotency record (`event_id`, family, first_seen_utc, auth subject, status)
   - append-only transport (Azure Event Hubs or Service Bus queue)
   - optional audit / dead-letter channel for invalid or permanently failed messages
5. Downstream ingestion lands data into bronze/core tables, then feature and serving layers.

**Recommended Azure components**

- **Auth**: Azure AD / Microsoft Entra bearer tokens (MSAL-compatible)
- **Ingress API**: App Service / Functions / Container Apps
- **Transport**: Azure Event Hubs per event family or one hub with `event_name` partition key
- **Idempotency store**: Azure Table Storage or Cosmos DB with TTL
- **Observability**: Application Insights + Azure Monitor + Log Analytics
- **Storage**: ADLS/Delta bronze + curated core/feature/serving layers already present in Azure

## 2) Auth

### Client
- Acquire bearer token with MSAL using the existing Purpulse / Azure AD app registration.
- Send:
  - `Authorization: Bearer <token>`
  - `X-Client-Request-ID: <event_id>`
  - `X-Device-ID: <consented stable device id>` when allowed
- Never derive `technician_id` from email if a stable subject/object ID is available.

### Server
- Validate JWT audience / issuer.
- Resolve:
  - `technician_id` from token subject or server-side user map
  - `project_id` default (`purpulse.app`) if omitted
  - role claims for QC/supervisor-only routes

## 3) Batching

### Recommendation
- **Foreground path**: send individual events immediately for user actions with strong UX expectations (`dispatch_event`, `arrival_event`, `qc_event`, `closeout_event`).
- **Background path**: batch low-latency-tolerant events (`domain_tool_log`, `tool_check_event`, repeated runbook breadcrumbs).

### Suggested limits
- Max batch size: **50 events or 256 KB**, whichever comes first.
- Flush interval when online: **every 5 seconds** or on app background/unload.
- Force flush on:
  - check-in
  - closeout submit
  - logout
  - app entering background
  - connectivity restored

## 4) Retry / backoff

### Client
- Retry on network failure / 429 / 5xx only.
- Backoff: exponential with jitter, e.g.
  - 1s, 2s, 4s, 8s, 16s, 30s cap
- Max local retention:
  - telemetry queue metadata: **7 days**
  - artifact upload queue: **7 days** hot, then require user re-attach if blob missing
- Mark permanently failed only after retry budget exhausted.

### Server
- Return:
  - `202` accepted
  - `200` duplicate/idempotent replay
  - `400` schema validation failure
  - `401/403` auth/role failure
  - `409` only if business conflict, not for duplicate envelopes

## 5) Idempotency

### Key
- Use `event_id` UUID as the canonical idempotency key.

### Store
- Partition by event family, row by `event_id`.
- Keep TTL of **72 hours minimum** for online retries; **7 days** if offline windows are common.

### Behavior
- If the same `event_id` is received twice:
  - do not write a second transport message
  - return previous outcome metadata
- If client mutates payload with same `event_id`, log to security/audit stream and reject as malformed replay.

## 6) Offline mode

### Queue design
- One canonical telemetry queue abstraction for all event families.
- Payload should be encrypted at rest where possible:
  - mobile: platform secure storage / SQLCipher / encrypted shared prefs
  - web: encrypt queue blobs before IndexedDB/localStorage when risk profile requires it
- Store:
  - `event_id`
  - `event_name`
  - payload JSON
  - first_queued_utc
  - retry_count
  - last_error
  - consent snapshot at event time

### Ordering
- Preserve FIFO ordering per `job_id` and `session_id` where event order matters.
- Add `event_sequence_no` per session/job to simplify replay ordering.

## 7) Schema versioning

### Policy
- Semantic versioning on `schema_version`.
- **MAJOR**: breaking field removals/renames/type changes
- **MINOR**: backward-compatible new optional fields
- **PATCH**: docs/examples/fixes with no payload contract change

### Compatibility rules
- Client may send current MINOR or previous MINOR for one deprecation window.
- Server must support at least:
  - current MAJOR.MINOR
  - previous MINOR within same MAJOR
- Required field additions require MINOR bump only if nullable/defaultable; otherwise MAJOR.

### Migration plan
1. Add new field as nullable + document transformation.
2. Update server to accept both old/new forms.
3. Backfill downstream transformations.
4. Roll clients.
5. After adoption threshold, tighten validation.

## 8) Transformation rules into Azure

### General
- Keep raw event payloads append-only.
- Normalize all timestamps to UTC ISO8601.
- Preserve original `client_ts`.
- Resolve identities server-side:
  - `technician_id`
  - `site_id`
  - `dispatch_id`
  - `project_id`

### Specific
- `duration_seconds -> actual_step_duration_min`: divide by 60.0
- `miles -> meters`: `meters = miles * 1609.344`
- `feet -> meters`: `meters = feet * 0.3048`
- `battery_ratio -> battery_pct`: `battery_pct = round(ratio * 100)`
- `travel_end` UI events should map to:
  - `travel_event.geofence_arrival_timestamp` only if geofence/source criteria are met
  - otherwise use `arrival_event.checkin_timestamp` or explicit arrival action

## 9) Reliability SLOs

### Suggested SLOs
- **Event acceptance**: 99.9% of valid events accepted within 60 seconds of first online attempt
- **Duplicate handling correctness**: 99.99% duplicate suppression
- **Queue durability**: 99.9% of queued events preserved across app restarts for 7 days
- **Schema validation**: <0.1% schema mismatch rate per release
- **Lag**: P95 ingest-to-core visibility under 5 minutes

### Alert thresholds
- `schema_mismatch_count > 25 / 15m`
- `dead_letter_count > 10 / 15m`
- `queue_lag_p95_min > 30`
- `accepted_events_per_sec` drops to zero during business hours
- `duplicate_event_rate > 5%` after a client release
- `missing_fields_count` spike after deployment

## 10) Metrics to expose

### Client metrics
- `telemetry_queue_depth`
- `telemetry_queue_oldest_age_sec`
- `telemetry_flush_success_count`
- `telemetry_flush_failure_count`
- `telemetry_drop_count`
- `telemetry_retry_count`
- `telemetry_location_suppressed_count`

### Server metrics
- `events_received_total`
- `events_accepted_total`
- `events_duplicate_total`
- `events_invalid_total`
- `schema_mismatch_count`
- `missing_fields_count`
- `ingest_latency_ms`
- `event_hub_publish_latency_ms`
- `dead_letter_count`
- `per_family_events_total`

## 11) Application Insights examples

### Python / Flask
```python
from opencensus.ext.azure.log_exporter import AzureLogHandler
import logging

logger = logging.getLogger("purpulse.telemetry")
logger.addHandler(AzureLogHandler(connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"]))

logger.info(
    "telemetry_ingest_accepted",
    extra={
        "custom_dimensions": {
            "event_name": payload["event_name"],
            "event_id": payload["event_id"],
            "job_id": payload["job_id"],
            "schema_version": payload["schema_version"],
        }
    },
)
```

### Front-end
```ts
appInsights.trackEvent({
  name: 'telemetry_flush_result',
  properties: {
    event_name: payload.event_name,
    event_id: payload.event_id,
    retry_count: String(queueItem.retry_count),
    queue_depth: String(queueDepth),
  },
});
```

## 12) Dead-letter and replay

- Invalid schema -> dead-letter table/container with payload, error, client version, route, and auth subject.
- Permanent downstream failure -> dead-letter transport + alert.
- Replay tool should filter by:
  - event family
  - date range
  - schema version
  - auth subject / technician
  - `job_id`
  - dead-letter reason

## 13) Recommended rollout order

1. Common canonical envelope + queue
2. `dispatch_event`
3. `travel_event` + `arrival_event`
4. `artifact_event`
5. `runbook_step_event`
6. `qc_event`
7. `closeout_event`
8. `escalation_event`
9. `feedback_event`
10. `tool_check_event` + `domain_tool_log`
11. `job_context_field`

## 14) Assumptions to validate

- Azure AD / Entra auth is available to the field app.
- App can obtain a stable non-PII `technician_id`.
- Event Hub / Queue namespace and AppInsights resource already exist or can be added.
- Browser/mobile environment supports a consented stable device identifier.
- Existing Base44 entity writes can coexist temporarily with new canonical event ingestion during migration.
