# Azure Analysis patches — status

| Patch | Intent | Status |
|-------|--------|--------|
| [0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch](./0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch) | Dispatch + ingestion | **Superseded** — targets old tree (`src/lib/telemetry/…`, serverless stubs); current code: `src/lib/dispatchEvent.js`, `src/api/telemetryIngestion.js`. |
| [0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch](./0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch) | Travel / arrival | **Superseded** — see `src/lib/travelArrivalEvent.js`, [travel_event.json](./travel_event.json), [arrival_event.json](./arrival_event.json). |
| [0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch](./0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch) | Artifact / QC | **Superseded** — see `src/lib/artifactEvent.js`, `src/lib/qcEvent.js`, matching JSON Schemas. |

**Recommendation:** Keep patches as historical archive only; use [canonical_event_loader_mapping.md](./canonical_event_loader_mapping.md) and [canonical_event_families.manifest.json](./canonical_event_families.manifest.json) for loader and codegen alignment (Iteration 12).
