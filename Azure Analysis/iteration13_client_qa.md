# Iteration 13 — Client QA notes (field app)

Cross-cutting checks from [FIELD_APP_TECHPULSE_AZURE_README.md](../FIELD_APP_TECHPULSE_AZURE_README.md) §10. Automated coverage lives in Vitest:

| §10 expectation | Client behavior | Automated test |
|-----------------|-----------------|----------------|
| Same `event_id` twice → single silver row | Ingestion API should return **200/202** for idempotent replay; client treats that as success and **deletes** the queued row. IndexedDB keyPath = `event_id`, so re-enqueue **overwrites** one pending row. | [iteration13TelemetryQueue.test.js](../src/tests/iteration13TelemetryQueue.test.js) |
| Offline queue → flush on reconnect | `registerTelemetryQueueListeners()` → `window` **online**, `visibilitychange`, and periodic flush when `navigator.onLine`. | Same file + [telemetryQueue.js](../src/lib/telemetryQueue.js) |
| Consent off → no GPS | `finalizeCanonicalEnvelopeForIngest` strips location-related keys unless consent is `granted`. | [iteration13Qa.test.js](../src/tests/iteration13Qa.test.js), [travelGps.test.js](../src/tests/travelGps.test.js) |
| Schema 400 → no infinite retry | `sendCanonicalEnvelope` sets **`retryable: false`** for 400/401/403; `flushTelemetryQueue` **drops** the row after a permanent failure. | [iteration13Qa.test.js](../src/tests/iteration13Qa.test.js), [iteration13TelemetryQueue.test.js](../src/tests/iteration13TelemetryQueue.test.js) |
| Field Nation boundary | **Model facts** must flow through canonical envelope + ingestion, not FN REST. | No `fieldnation` / `FieldNation` references under `src/` (periodic grep / review). |

**Run:** `npx vitest run src/tests/iteration13Qa.test.js src/tests/iteration13TelemetryQueue.test.js`
