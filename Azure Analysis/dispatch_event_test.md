# dispatch_event test cases

## Unit tests

1. **Schema validation succeeds for nominal payload**
   - Use the example payload below.
   - Expect 202 Accepted from `/api/v1/telemetry/dispatch-events`.
2. **Duplicate replay returns idempotent success**
   - Send the same `event_id` twice.
   - Expect first response 202, second response 200 with `status=duplicate`.
3. **Missing required base envelope field fails**
   - Remove `event_id`.
   - Expect 400 with a validation error.
4. **Consent gating works**
   - Set `telemetry_consent.location=false` and send a non-null `location`.
   - Client should null the location before send or the server should reject it according to policy.
5. **Clock / timestamp normalization**
   - Ensure `event_ts_utc` and `client_ts` are valid ISO8601 UTC timestamps.
- Assert `dispatch_id` is present and correctly typed.
- Assert `status` is present and correctly typed.
- Assert `assignment_id` is present and correctly typed.
- Assert `accept_flag` is present and correctly typed.
- Assert `decline_flag` is present and correctly typed.
- Assert `offer_timestamp` is present and correctly typed.

## Integration tests

1. **Offline queue replay**
   - Queue the payload locally while offline.
   - Reconnect and flush.
   - Assert exactly one row lands in `core.fact_dispatch_event`.
2. **Auth failure**
   - Omit bearer token.
   - Expect 401/403 before any Azure write.
3. **Schema mismatch metric**
   - Submit payload with wrong type for the first event-specific field.
   - Expect failure plus increment to `schema_mismatch_count`.
4. **Observability breadcrumb**
   - Assert AppInsights / logs contain `event_name=dispatch_event` and `event_id=<uuid>`.

## Example payload

```json
{
  "event_id": "9c2c8b6b-1f0d-4b1c-8f48-01b52d9f2e2e",
  "schema_version": "1.0.0",
  "event_name": "dispatch_event",
  "event_ts_utc": "2026-03-18T14:05:22.000Z",
  "client_ts": "2026-03-18T14:05:20.111Z",
  "source_system": "field_app",
  "project_id": "purpulse.app",
  "device_id": "dev-a1b2c3",
  "session_id": "sess-abc123",
  "job_id": "job_123",
  "dispatch_id": "disp_456",
  "assignment_id": "asg_789",
  "technician_id": "tech_001",
  "site_id": "site_042",
  "status": "arrived",
  "accept_flag": true,
  "decline_flag": false,
  "offer_timestamp": "2026-03-18T13:11:00.000Z",
  "response_timestamp": "2026-03-18T13:12:08.000Z",
  "cancel_timestamp": null,
  "planned_eta_timestamp": "2026-03-18T14:15:00.000Z",
  "eta_ack_timestamp": "2026-03-18T13:20:00.000Z",
  "eta_update_timestamp": "2026-03-18T13:55:00.000Z",
  "route_departure_timestamp": "2026-03-18T13:25:00.000Z",
  "scheduled_start_timestamp": "2026-03-18T14:00:00.000Z",
  "connectivity_state": "cellular",
  "telemetry_consent": {
    "location": true,
    "device": true
  },
  "location": {
    "lat": 51.5074,
    "lon": -0.1278,
    "accuracy_m": 8.0
  }
}
```

## Minimal assertions for client tests

```ts
import { emitDispatchEvent } from './dispatch_event_client';

test('builds a canonical dispatch_event envelope', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 202,
    json: async () => ({ status: 'accepted' }),
  }) as any;

  await emitDispatchEvent({
  "accessToken": "token",
  "job_id": "job_123",
  "technician_id": "tech_001",
  "site_id": "site_042",
  "dispatch_id": "disp_456",
  "project_id": "purpulse.app",
  "session_id": "sess-abc123",
  "device_id": "dev-a1b2c3",
  "connectivity_state": "cellular",
  "telemetry_consent": {
    "location": true,
    "device": true
  },
  "location": {
    "lat": 51.5074,
    "lon": -0.1278,
    "accuracy_m": 8.0
  },
  "assignment_id": "asg_789",
  "status": "arrived",
  "accept_flag": true,
  "decline_flag": false,
  "offer_timestamp": "2026-03-18T13:11:00.000Z",
  "response_timestamp": "2026-03-18T13:12:08.000Z",
  "cancel_timestamp": null,
  "planned_eta_timestamp": "2026-03-18T14:15:00.000Z",
  "eta_ack_timestamp": "2026-03-18T13:20:00.000Z",
  "eta_update_timestamp": "2026-03-18T13:55:00.000Z",
  "route_departure_timestamp": "2026-03-18T13:25:00.000Z",
  "scheduled_start_timestamp": "2026-03-18T14:00:00.000Z"
});

  expect(fetch).toHaveBeenCalledTimes(1);
});
```
