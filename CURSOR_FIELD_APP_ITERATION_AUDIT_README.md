# Cursor guide: auditing Field app iterations

This document tells **Cursor (and humans)** how to **review implementation quality** against the ordered checklist in [CURSOR_FIELD_APP_ITERATIONS.md](./CURSOR_FIELD_APP_ITERATIONS.md), using the **TechPulse lineage package** for business/data contracts and **Azure Analysis** for schemas, coverage gaps, and loader alignment.

It does **not** replace the iteration doc; it defines **how to audit** it.

---

## The three reference zones

| Zone | Path | Use when auditing |
|------|------|-------------------|
| **Iteration playbook** | [CURSOR_FIELD_APP_ITERATIONS.md](./CURSOR_FIELD_APP_ITERATIONS.md) | **Source of truth for scope and “Done.”** Each iteration lists goals, files, and an **Implemented (this repo)** section—treat that as the claimed completion map. |
| **TechPulse Atlas** | [TechPulse_Full_Lineage_Atlas_Package/](./TechPulse_Full_Lineage_Atlas_Package/) | **Why fields exist** and how they map to Azure models. Primary narrative: [TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md](./TechPulse_Full_Lineage_Atlas_Package/TechPulse_Field_App_Data_Collection_and_Model_Mapping_Guide.md). Database/column truth: [TechPulse_Azure_Database_Master_Documentation.md](./TechPulse_Full_Lineage_Atlas_Package/TechPulse_Azure_Database_Master_Documentation.md). CSVs (catalogs, lineage) for cross-checking datapoints and `core.fact_*` consumers. |
| **Azure Analysis** | [Azure Analysis/](./Azure%20Analysis/) | **Machine contracts and gaps:** JSON Schemas (`*_event.json`, `job_context_field.json`), [ingestion_strategy.md](./Azure%20Analysis/ingestion_strategy.md), [coverage_matrix.md](./Azure%20Analysis/coverage_matrix.md), [missing_items.md](./Azure%20Analysis/missing_items.md), [audit_report.md](./Azure%20Analysis/audit_report.md). **Iteration 12+:** [canonical_event_loader_mapping.md](./Azure%20Analysis/canonical_event_loader_mapping.md), [canonical_event_families.manifest.json](./Azure%20Analysis/canonical_event_families.manifest.json). Patch files are **historical only**—see [PATCHES_STATUS.md](./Azure%20Analysis/PATCHES_STATUS.md). |

**Also required for full context:** [FIELD_APP_TECHPULSE_AZURE_README.md](./FIELD_APP_TECHPULSE_AZURE_README.md) (execution spec), [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) (emit-before-mutate and phasing).

---

## Audit procedure (recommended order)

1. **Anchor on iterations**  
   Walk [CURSOR_FIELD_APP_ITERATIONS.md](./CURSOR_FIELD_APP_ITERATIONS.md) **from Iteration 0 upward**. For each iteration, read the **Goal**, **Done** (or **Checklist** for Iteration 13), then the **Implemented** bullets and linked paths.

2. **Verify in code, not only in prose**  
   Open the cited `src/` files and confirm:
   - **Emit-before-mutate** where the iteration claims it (telemetry enqueue before `Job.update`, `TimeEntry.create`, etc., per [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)).
   - **Event family** matches the schema’s `event_name` and required payload shape in [Azure Analysis/](./Azure%20Analysis/) for that family.
   - **Consent / GPS:** Iteration 2 and any location-bearing events align with [src/lib/locationConsent.js](./src/lib/locationConsent.js) and [Azure Analysis/audit_report.md](./Azure%20Analysis/audit_report.md) minimization expectations.

3. **Cross-check TechPulse**  
   For each event family, confirm important fields appear in the guide (§3–6 and family-specific sections) and, for loader readiness, that naming intent matches [TechPulse_Azure_Database_Master_Documentation.md](./TechPulse_Full_Lineage_Atlas_Package/TechPulse_Azure_Database_Master_Documentation.md) where applicable.

4. **Cross-check Azure Analysis coverage**  
   Use [coverage_matrix.md](./Azure%20Analysis/coverage_matrix.md) and [missing_items.md](./Azure%20Analysis/missing_items.md) to see whether **documented gaps** are still open or addressed by later iterations (e.g. acknowledgement flags in Iteration 11).

5. **Run automated checks**  
   From repo root (see [Azure Analysis/README.md](./Azure%20Analysis/README.md)):
   - `npm run validate:canonical-manifest`
   - `npm run lint`
   - `npm test` (or targeted tests cited under each iteration’s **Implemented** block)
   - **Last run log (optional):** [Azure Analysis/audit_command_results.md](./Azure%20Analysis/audit_command_results.md) — records pass/fail for the above when executing a deep audit.

6. **Close with Iteration 13**  
   Explicitly run through the §10-style checklist in [CURSOR_FIELD_APP_ITERATIONS.md](./CURSOR_FIELD_APP_ITERATIONS.md) (Iteration 13): idempotency, offline flush, consent, schema 400 behavior, Field Nation boundary.

---

## How to judge “how good” the audit was

A strong audit is **evidence-based** and **traceable**. Prefer this hierarchy:

1. **Primary:** Behavior in `src/` matches iteration **Done** criteria.  
2. **Secondary:** Tests exist and cover the emitters/wiring named in the iteration doc.  
3. **Contract:** Payloads conform to the matching JSON Schema under `Azure Analysis/`.  
4. **Downstream:** [canonical_event_loader_mapping.md](./Azure%20Analysis/canonical_event_loader_mapping.md) and [canonical_event_families.manifest.json](./Azure%20Analysis/canonical_event_families.manifest.json) list the family and exports consistently (`validate:canonical-manifest` passes).

**Red flags** (incomplete or risky audit):

- Only confirming the **Implemented** prose without opening code.  
- Ignoring **explicit deferrals** (e.g. geofence / 5c) as if they were done.  
- Schemas or manifest updated without matching **allowlists** / emitters in `src/lib/`.  
- Iteration 13 items unchecked (idempotency, offline, consent, 400 retry, FN boundary).

---

## Quick mapping: iterations → typical Azure Analysis artifacts

| Iterations | Typical schemas / docs |
|------------|-------------------------|
| 1–2 | Spine: ingestion strategy + audit report; envelope fields per TechPulse §3 |
| 3 | `dispatch_event.json` |
| 4–5 | `travel_event.json`, `arrival_event.json` |
| 6 | `runbook_step_event.json` |
| 7 | `artifact_event.json` |
| 8 | `qc_event.json` |
| 9 | `closeout_event.json`, `escalation_event.json`, `feedback_event.json` |
| 10 | `tool_check_event.json`, `job_context_field.json` |
| 11 | Updates to `arrival_event.json`, `tool_check_event.json`; coverage/missing docs |
| 12–13 | `canonical_event_loader_mapping.md`, `canonical_event_families.manifest.json`, Iteration 13 checklist |

Full path index: [CURSOR_FIELD_APP_ITERATIONS.md — Source paths quick reference](./CURSOR_FIELD_APP_ITERATIONS.md#source-paths-quick-reference).

---

## Audit report template (for Cursor output)

When asked to **audit** or **grade** work against this checklist, produce a short structured summary:

```text
## Iteration audit summary
- Repo snapshot / branch: …
- Commands run: validate:canonical-manifest, lint, tests (list)

## Per iteration (0–13)
For each: Pass | Partial | Fail | N/A
- Evidence: file paths + 1 line each for what was verified
- Gaps: what’s missing vs CURSOR_FIELD_APP_ITERATIONS “Done” or Iteration 13 checklist

## Cross-artifact consistency
- TechPulse guide vs emitted fields: …
- Azure Analysis schemas vs src/lib allowlists: …
- coverage_matrix / missing_items open items: …

## Verdict
- Overall: …
- Highest-risk gaps: …
```

---

## Related Cursor workflow

- **Implementation prompts:** use the template at the bottom of [CURSOR_FIELD_APP_ITERATIONS.md](./CURSOR_FIELD_APP_ITERATIONS.md).  
- **This file:** use when the task is **review, QA, or gap analysis** against that same iteration list.

---

*Keep this file in sync when you add iterations, new event families, or new Atlas/Azure Analysis entry points.*
