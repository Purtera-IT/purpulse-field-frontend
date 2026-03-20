# P0 dispatch_event canonical envelope + ingestion path

## Suggested branch

`audit/p0-dispatch-canonical-ingestion`

## Suggested commit message

`feat(field-app): emit canonical dispatch_event envelopes`

## Why this patch exists

Adds a canonical dispatch telemetry emitter, a reusable ingestion client, a serverless ingestion stub, an OpenAPI fragment, and a focused test. Also upgrades useJobQueue so state changes emit immutable dispatch facts before mutating Job state.

## Apply locally

```bash
git checkout -b audit/p0-dispatch-canonical-ingestion
git am /mnt/data/purpulse_fieldapp_audit/patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch
```

## Validation

```bash
npm install
npm test -- dispatchEvent
npm run lint
```

## Reviewer notes

- Verify bearer-auth token acquisition for the new ingestion path.
- Confirm the emitted payload uses `technician_id` from auth/session context instead of email.
- Validate idempotency by replaying the same `event_id` twice and confirming a single Azure-side row/fact is materialized.
- Confirm location is omitted when telemetry consent is false.

## Copy/paste PR description

### Summary
Adds a canonical dispatch telemetry emitter, a reusable ingestion client, a serverless ingestion stub, an OpenAPI fragment, and a focused test. Also upgrades useJobQueue so state changes emit immutable dispatch facts before mutating Job state.

### What changed
- Added canonical telemetry helpers and ingestion wiring for the event family covered by this patch.
- Preserved the existing user-facing flow while emitting immutable facts for Azure training/serving pipelines.
- Added a minimal test and OpenAPI fragment so the contract can be reviewed and versioned.

### Why now
This closes one of the biggest gaps found in the TechPulse audit: field actions were often mutating Base44 entities directly without also producing a durable, idempotent, Azure-shaped telemetry fact.

### Test plan
- Run the listed focused test(s).
- Exercise the flow offline and online.
- Replay the same payload twice and confirm idempotent acceptance.
- Verify AppInsights/Event Hub dashboards show accepted and failed counts.
