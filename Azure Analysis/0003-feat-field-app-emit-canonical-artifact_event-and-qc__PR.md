# P0 artifact_event and qc_event canonical telemetry

## Suggested branch

`audit/p0-artifact-qc-canonical-ingestion`

## Suggested commit message

`feat(field-app): emit canonical artifact_event and qc_event telemetry`

## Why this patch exists

Adds canonical artifact/QC emitters and a serverless ingestion stub, then emits immutable artifact facts from the upload queue and immutable QC facts from the AdminQC moderation flow.

## Apply locally

```bash
git checkout -b audit/p0-artifact-qc-canonical-ingestion
git am /mnt/data/purpulse_fieldapp_audit/patches/0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch
```

## Validation

```bash
npm install
npm test -- artifactQcEvents
npm run lint
```

## Reviewer notes

- Verify bearer-auth token acquisition for the new ingestion path.
- Confirm the emitted payload uses `technician_id` from auth/session context instead of email.
- Validate idempotency by replaying the same `event_id` twice and confirming a single Azure-side row/fact is materialized.
- Confirm location is omitted when telemetry consent is false.

## Copy/paste PR description

### Summary
Adds canonical artifact/QC emitters and a serverless ingestion stub, then emits immutable artifact facts from the upload queue and immutable QC facts from the AdminQC moderation flow.

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
