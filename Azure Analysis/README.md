# Azure Analysis

## Iteration 13 — client QA (Vitest)

- **Notes:** [iteration13_client_qa.md](./iteration13_client_qa.md) — §10 expectations vs `telemetryQueue` / `telemetryIngestion` / consent.
- **Run:** `npm run test:iteration13` (from repo root).
- **CI:** [`.github/workflows/fieldapp-contracts.yml`](../.github/workflows/fieldapp-contracts.yml) runs `validate:canonical-manifest` + `test:iteration13` on push/PR.
- **Command audit log:** [audit_command_results.md](./audit_command_results.md) — last recorded `lint` / full `vitest` status.

## Iteration 12 — loader mapping (current)

- **Human table:** [canonical_event_loader_mapping.md](./canonical_event_loader_mapping.md) — `event_name` → `core.fact_*` → JSON Schema → `src/lib/*` allowlists.
- **Machine index:** [canonical_event_families.manifest.json](./canonical_event_families.manifest.json) — validate with `npm run validate:canonical-manifest` from repo root (paths, `event_name` const per schema, manifest envelope keys ⊆ `required`, allowlist/assert/emit exports, `ingestion_pipeline`, optional `additional_emit_exports`).
- **Archived `0001`–`0003` patches:** [PATCHES_STATUS.md](./PATCHES_STATUS.md) — **superseded; do not apply** (paths in patches no longer match this repo).

---

## Historical: patch set (archive only)

The three `0001`–`0003` patch files in this folder were generated from an older baseline. **Do not `git am` them** against the current tree — use the mapping doc + manifest above instead.

<details>
<summary>Original apply instructions (obsolete paths)</summary>

```bash
git checkout -b audit/purpulse-fieldapp-telemetry
git am /mnt/data/purpulse_fieldapp_audit/patches/0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch /mnt/data/purpulse_fieldapp_audit/patches/0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch /mnt/data/purpulse_fieldapp_audit/patches/0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch
```

</details>

## Validate locally

```bash
npm install
npm run validate:canonical-manifest
npm run lint
npm test -- dispatchEvent
npm test -- travelArrivalEvents
npm test -- artifactQcEvents
```

## Patch index (historical)

### 1. P0 dispatch_event canonical envelope + ingestion path

- Branch name: `audit/p0-dispatch-canonical-ingestion`
- Commit message: `feat(field-app): emit canonical dispatch_event envelopes`
- Patch file: `0001-feat-field-app-emit-canonical-dispatch_event-envelop.patch`
- Summary: Adds a canonical dispatch telemetry emitter, a reusable ingestion client, a serverless ingestion stub, an OpenAPI fragment, and a focused test. Also upgrades useJobQueue so state changes emit immutable dispatch facts before mutating Job state.
- Risk: Low-to-medium. Touches the job queue path and introduces a new network write, but keeps existing Job.update behavior as-is.

### 2. P0 split travel and arrival telemetry into separate facts

- Branch name: `audit/p0-travel-arrival-canonical-ingestion`
- Commit message: `feat(field-app): emit travel_event and arrival_event telemetry`
- Patch file: `0002-feat-field-app-emit-travel_event-and-arrival_event-t.patch`
- Summary: Adds canonical travel/arrival emitters and a serverless ingestion stub, then wires TimeLog transitions so travel start and arrival/work-start transitions emit separate immutable events.
- Risk: Medium. Time-entry UX stays unchanged, but downstream analytics must accept two event families instead of a single derived transition.

### 3. P0 artifact_event and qc_event canonical telemetry

- Branch name: `audit/p0-artifact-qc-canonical-ingestion`
- Commit message: `feat(field-app): emit canonical artifact_event and qc_event telemetry`
- Patch file: `0003-feat-field-app-emit-canonical-artifact_event-and-qc_.patch`
- Summary: Adds canonical artifact/QC emitters and a serverless ingestion stub, then emits immutable artifact facts from the upload queue and immutable QC facts from the AdminQC moderation flow.
- Risk: Medium. Evidence/QC flows gain an additional telemetry hop; consent and retry handling must be verified in staging with large uploads.
