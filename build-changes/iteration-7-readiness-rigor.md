# Iteration 7 — Readiness + acknowledgement rigor (canonical path)

Index of all build notes: [`README.md`](./README.md).

## Summary

Technicians see **one operator-facing readiness story** on **Overview**—**Route → Start work → Work timer**—derived **honestly** from **`job.status`**, **`TimeEntry`** presence (**`work_start`**), and short disclaimers (no fake persisted ack flags on the job row). Existing microflows stay in place: **ETA sheet** before **en route**, **pre-job tool + scope** modal before **in progress** (non-pause path), **pre-arrival / scope** sheet before **work timer** start. Copy ties lifecycle transitions and timer actions to that story; **pre-job tool** dialog blocks **outside-click dismiss** so **Cancel** / close control remain explicit exits.

**Not in scope:** shell redesign, telemetry/Azure refactors, new backend fields.

## Readiness model (`buildFieldReadinessSummary`)

| Phase | Complete when (UI inference) | Meaning |
| ----- | ---------------------------- | ------- |
| **Route** | Status is past **`assigned`** | Travel confirmation was part of going en route in-app. |
| **Start work** | **`in_progress`** or terminal/paused post-work states | Pre-start checklist ran when entering in progress (resume from **paused** skips it—called out in copy). |
| **Work timer** | At least one **`work_start`** time entry | Timer segment was started; scope sheet still runs when starting a new segment after stop. |

**`READINESS_SHORT_LINES`** in the same module feeds **`getNextStepMessage`** for **assigned / en_route / checked_in / paused** so header hints stay aligned with Overview headlines.

## Changed files

### New

- `src/lib/fieldReadinessViewModel.ts` — `buildFieldReadinessSummary`, `READINESS_SHORT_LINES`, phase state derivation.
- `src/lib/__tests__/fieldReadinessViewModel.test.ts` — Vitest matrix for statuses + disclaimer + short-line alignment.
- `src/components/fieldv2/ReadinessSummaryCard.jsx` — Overview **Readiness** card (`FieldSectionCard` **muted**), three phase rows + disclaimer.

### Modified

- `src/components/fieldv2/JobOverview.jsx` — mount **Readiness** card above **Job state**.
- `src/components/fieldv2/jobExecutionNextStep.js` — imports **`READINESS_SHORT_LINES`** for early lifecycle statuses.
- `src/components/fieldv2/JobStateTransitioner.jsx` — **`FIELD_META`** hints on **→ en_route** and **→ in_progress** (non-pause).
- `src/components/fieldv2/FieldTimeTracker.jsx` — operator line when **can clock in** + timer stopped (timer step + site check).
- `src/components/fieldv2/PreJobToolCheckModal.jsx` — operator **`DialogDescription`**, **`onPointerDownOutside` / `onInteractOutside`** `preventDefault`, no internal event names in visible copy.
- `src/components/field/AcknowledgementSheets.jsx` — **PreArrival** / **Eta** operator copy; light framing that steps belong to one readiness path.

### Out of scope (by design)

- **`Layout.jsx`**, **`telemetryQueue`** / Azure modules, new **`Job`** schema fields, evidence/comms/runbook redesign, duplicate gates on **checked_in**.

## Patch

The unified diff is checked in as **[`iteration-7-readiness-rigor.patch`](./iteration-7-readiness-rigor.patch)** (same pattern as Iterations 1–6).

Regenerate from the **repository root** (`--no-index` returns exit code **1** when there are changes; **`|| true`** keeps the shell block running):

```bash
{
  git diff HEAD -- \
    src/components/fieldv2/JobOverview.jsx \
    src/components/fieldv2/jobExecutionNextStep.js \
    src/components/fieldv2/JobStateTransitioner.jsx \
    src/components/fieldv2/FieldTimeTracker.jsx \
    src/components/fieldv2/PreJobToolCheckModal.jsx \
    src/components/field/AcknowledgementSheets.jsx
  git diff --no-index /dev/null src/lib/fieldReadinessViewModel.ts || true
  git diff --no-index /dev/null src/lib/__tests__/fieldReadinessViewModel.test.ts || true
  git diff --no-index /dev/null src/components/fieldv2/ReadinessSummaryCard.jsx || true
} > build-changes/iteration-7-readiness-rigor.patch
```

After the three **new** files are **committed**, drop the **`--no-index`** lines and include those paths in one **`git diff HEAD -- …`** instead.

### Apply

After Iterations 1–6 (or equivalent):

```bash
git apply --check build-changes/iteration-7-readiness-rigor.patch
git apply build-changes/iteration-7-readiness-rigor.patch
```

## Verification

- `npm run lint`
- `npm test` (includes **`fieldReadinessViewModel`** tests)
- Manual: **FieldJobDetail → Overview**; **assigned → en_route → checked_in → in_progress**; start/stop timer; confirm sheets/modals and transitions.

## Provisional / Iteration 8 candidates

- Persist **ETA / tool / scope** completion on the job (or queryable aggregates) when the API supports it—then tighten the view-model without implying server truth today.
- Same outside-dismiss policy on ETA sheet if product wants parity with the tool dialog.
- Session-scoped “last ack” cache only if product accepts stale-edge tradeoffs.
- Optional check-in readiness strip; blockers strip on detail.
