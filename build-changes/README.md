# Build changes

This folder stores **file lists** and **patches** for grouped implementation work so you can review, share, or re-apply changes without hunting through history.

---

## Iteration 1 — Shell & route consolidation

Canonical technician flow: `/FieldJobs` + `/FieldJobDetail`, 3-tab shell (Jobs / Support / Profile), legacy redirects, no mock fallbacks on canonical list/detail.

### Changed file list

**New**

- `src/utils/fieldRoutes.ts` — canonical path constants and `fieldJobDetailUrl()`
- `src/components/routing/LegacyJobDetailRedirect.jsx` — `/JobDetail` → `/FieldJobDetail` (preserves `id`, `tab`)

**Modified**

- `src/App.jsx`
- `src/App.tsx`
- `src/Layout.jsx`
- `src/pages.config.js`
- `src/pages/FieldJobs.jsx`
- `src/pages/FieldJobDetail.jsx`
- `src/pages/Onboarding.jsx`
- `src/pages/Profile.jsx`
- `src/pages/ActiveJob.jsx`
- `src/components/admin/AdminShell.jsx`
- `src/components/field/JobCard.jsx`

**Left on disk but removed from `pages.config.js` (legacy pages, not deleted)**

- `src/pages/Jobs.jsx`
- `src/pages/JobDetail.jsx`
- `src/pages/Chat.jsx`
- `src/pages/TimeLog.jsx`

**Follow-up cleanup (before Iteration 2)** — `mainPage` removed from `pages.config.js` (entry is `App.jsx` only); `HIDE_SHELL_PAGES` trimmed; `@deprecated LEGACY` file headers on the four legacy pages; shared field components link via `fieldJobDetailUrl` / `FIELD_JOB_TAB_RUNBOOK` instead of hardcoded `/JobDetail`.

### Patch

The unified diff is in:

**[`iteration-1-shell-routing.patch`](./iteration-1-shell-routing.patch)**

It was produced with:

```bash
git diff HEAD -- \
  src/App.jsx \
  src/App.tsx \
  src/Layout.jsx \
  src/pages.config.js \
  src/pages/FieldJobs.jsx \
  src/pages/FieldJobDetail.jsx \
  src/pages/Onboarding.jsx \
  src/components/admin/AdminShell.jsx \
  src/components/field/JobCard.jsx \
  src/pages/ActiveJob.jsx \
  src/pages/Profile.jsx

git diff --no-index /dev/null src/utils/fieldRoutes.ts
git diff --no-index /dev/null src/components/routing/LegacyJobDetailRedirect.jsx
```

(Those two `git diff --no-index` hunks are appended for files that were **untracked** at generation time.)

### How to use the patch

From the **repository root**:

```bash
# Dry run
git apply --check build-changes/iteration-1-shell-routing.patch

# Apply
git apply build-changes/iteration-1-shell-routing.patch
```

If paths or surrounding context drift, use `git apply --3way` or `patch -p1` and resolve conflicts manually.

### Note on scope

The patch includes **only** the paths above. Other edits in your working tree (docs moves, CI, Storybook, etc.) are **not** part of this file. If `App.jsx` (or others) also changed for unrelated reasons, those hunks appear together in the patch because they touch the same files.

---

## Iteration 2 — FieldJobDetail information architecture

Single workflow surface on `/FieldJobDetail`: **Overview | Runbook | Evidence | Closeout | Comms**. Time and meetings are no longer peer tabs; audit sits under Closeout as secondary. URL `?tab=` with legacy aliases: `timelog`→overview, `meetings`→comms, `audit`→closeout.

### Changed file list

**New**

- `src/components/fieldv2/jobExecutionNextStep.js` — `getNextStepMessage(job, evidence)` from real fields only
- `src/components/fieldv2/JobCloseoutSection.jsx` — closeout copy, `JobStateTransitioner`, `SignoffCapture`, `AuditTab` (secondary)
- `src/components/fieldv2/JobCommsSection.jsx` — job-context `ChatView` + `MeetingsTab` (secondary)

**Modified**

- `src/pages/FieldJobDetail.jsx` — five sections, `useSearchParams`, segment nav, next-step header line
- `src/components/fieldv2/JobOverview.jsx` — work session (`FieldTimeTracker` embedded), quick links, no duplicate closeout/evidence summary
- `src/components/fieldv2/FieldTimeTracker.jsx` — `variant="embedded"` for Overview
- `src/components/fieldv2/EvidenceGalleryView.jsx` — required vs uploaded strip when `job.evidence_requirements` exists

### Patch

**[`iteration-2-fieldjobdetail-ia.patch`](./iteration-2-fieldjobdetail-ia.patch)**

Re-run the command block below to refresh when Iteration 2 sources change. Last generated against `HEAD` **ab8753054a42e0c350ac6a2dc623550c49781b19** with:

```bash
git diff HEAD -- \
  src/pages/FieldJobDetail.jsx \
  src/components/fieldv2/EvidenceGalleryView.jsx \
  src/components/fieldv2/FieldTimeTracker.jsx \
  src/components/fieldv2/JobOverview.jsx

git diff --no-index /dev/null src/components/fieldv2/JobCloseoutSection.jsx
git diff --no-index /dev/null src/components/fieldv2/JobCommsSection.jsx
git diff --no-index /dev/null src/components/fieldv2/jobExecutionNextStep.js
```

(The three `git diff --no-index` hunks are appended for files that were **untracked** at generation time.)

### How to use the patch

From the **repository root**, on a tree whose **tracked** versions of the four modified files match **`ab87530…`** (or resolve conflicts if your base differs):

```bash
git apply --check build-changes/iteration-2-fieldjobdetail-ia.patch
git apply build-changes/iteration-2-fieldjobdetail-ia.patch
```

`git apply --check` will fail if those files already contain the post-iteration content or if your `HEAD` has drifted from the patch base. Use `git apply --3way` or re-generate the patch from your branch.

---

## Iteration 3 — FieldJobDetail execution state + work session

Canonical `/FieldJobDetail` uses **one derived view-model** from `job.status` (+ job timestamps) and **`TimeEntry[]`** for this job. **JobStateTransitioner** lives on **Overview** (not trapped in Closeout). **FieldTimeTracker** writes **`work_start` / `work_stop`** via `apiClient.createTimeEntry` + existing telemetry seams (`emitCanonicalEventsForTimeEntry`, `telemetryTimeClockStart`/`Stop`); no Activity-based session authority, no local “clocked” truth.

### Changed file list

**New**

- `src/lib/fieldJobExecutionModel.ts` — `LIFECYCLE_DISPLAY`, `deriveTimerSessionFromTimeEntries`, `buildFieldJobExecutionView`, `formatWorkedDuration`
- `src/lib/__tests__/fieldJobExecutionModel.test.ts` — unit tests for derivation / gating

**Modified**

- `src/pages/FieldJobDetail.jsx` — `fj-time-entries` query, `executionView`, compact header (lifecycle · timer on/off · worked time), `invalidateAll` includes time entries
- `src/components/fieldv2/FieldTimeTracker.jsx` — TimeEntry-based work timer; lifecycle gating from `executionView`
- `src/components/fieldv2/JobOverview.jsx` — mounts `JobStateTransitioner`; removed duplicate “Start Job” path; `LIFECYCLE_DISPLAY` from model
- `src/components/fieldv2/JobStateTransitioner.jsx` — `priorStatus` on transitions; sets `check_in_time` / `work_start_time` / `work_end_time` where appropriate; invalidates `fj-time-entries` on success

**Replaced relative to Iteration 2 Closeout shape**

- `src/components/fieldv2/JobCloseoutSection.jsx` — sign-off + audit only; lifecycle copy points to Overview (no duplicate `JobStateTransitioner` here)

### Patch

**[`iteration-3-fieldjobdetail-execution-time.patch`](./iteration-3-fieldjobdetail-execution-time.patch)**

Re-run the command block below to refresh when Iteration 3 sources change. Last generated against `HEAD` **ab8753054a42e0c350ac6a2dc623550c49781b19** with:

```bash
git diff HEAD -- \
  src/pages/FieldJobDetail.jsx \
  src/components/fieldv2/FieldTimeTracker.jsx \
  src/components/fieldv2/JobOverview.jsx \
  src/components/fieldv2/JobStateTransitioner.jsx

git diff --no-index /dev/null src/lib/fieldJobExecutionModel.ts
git diff --no-index /dev/null src/lib/__tests__/fieldJobExecutionModel.test.ts
git diff --no-index /dev/null src/components/fieldv2/JobCloseoutSection.jsx
```

(The three `git diff --no-index` hunks are for paths that were **untracked** at generation time; if they are tracked on your branch, drop those lines and use `git diff HEAD -- <paths>` instead.)

### How to use the patch

From the **repository root**, apply **after** Iteration 1/2 (or equivalent) so `FieldJobDetail` and field v2 components exist:

```bash
git apply --check build-changes/iteration-3-fieldjobdetail-execution-time.patch
git apply build-changes/iteration-3-fieldjobdetail-execution-time.patch
```

`git apply --check` succeeds only when the **modified** files match the patch base. Re-generate the patch if your tree has diverged.

### Note on scope

Telemetry queue modules, Azure ingestion, app shell, and evidence backend are **not** part of this patch. Iteration 3 only touches the canonical job detail execution/time presentation and related transition + time-entry wiring.

### Technical debt (track for Iteration 4/5)

- **`JobStateTransitioner`** still calls `base44.entities.Job.update` directly while other canonical field paths use `jobRepository` / `apiClient`. Marked in source with `TECHNICAL_DEBT`; converge on one job-write abstraction later. *(Still open after Iteration 4.)*

---

## Iteration 4 — FieldJobDetail evidence trust + deliverable mapping

Canonical **Evidence** tab treats items as **job deliverables**, not a generic gallery: real **`job.evidence_requirements`** drive completeness (uploaded vs in-flight vs missing), capture guides **evidence type** and **optional `runbook_step_id`** from embedded **`job.runbook_phases`**, and **fake upload progress / false “cloud uploaded” copy** is removed. **`Base44UploadAdapter.requestUploadToken`** exposes **`is_simulated_storage`**; manifest **`sync_status`** stays **`pending`** until a real HTTPS blob URL path exists. Per-item **record / storage** state (inline `data:` URL, `mock://`, errors) is surfaced honestly in thumbnails and the detail sheet.

### Changed file list

**New**

- `src/lib/fieldEvidenceViewModel.ts` — requirement partitions, runbook step flattening, evidence type option order, status/storage presentation, assignment of items to requirement buckets + step summary text

**Modified**

- `src/api/types.ts` — `EvidenceSchema` extended (`runbook_step_id`, `qc_status`, `exif_metadata`, `upload_error`, `azure_blob_url`; `file_url` via `EvidenceFileUrlSchema`: http(s), `data:`, `mock:`, `blob:` — revisit when real storage adds other schemes)
- `src/lib/fieldAdapters.js` — upload token includes **`is_simulated_storage`** when using `mock://` URLs
- `src/components/fieldv2/EvidenceCaptureModal.jsx` — indeterminate “Saving…” flow, honest success/error/manifest toasts, **Save to job** CTA, type + optional runbook step + notes; manifest uses persisted **`record.file_url`**
- `src/components/fieldv2/EvidenceGalleryView.jsx` — requirements panel (**Add** per row, in-flight counts), grouping by requirement + **Other evidence**, status badges on thumbnails, detail **Upload/sync** + storage note, **`RunbookStepSummary`**
- `src/components/fieldv2/RunbookSteps.jsx` — passes **`job`** into **`EvidenceCaptureModal`** so step picker matches embedded phases when attaching from a step

**Out of scope (by design)**

- Shell, routing, **`telemetryQueue` / Azure** modules, real SAS/binary upload, and **`uploadQueue`** integration (see follow-ups below).

### Patch

**[`iteration-4-fieldjobdetail-evidence-trust.patch`](./iteration-4-fieldjobdetail-evidence-trust.patch)**

Re-run the command block below to refresh when Iteration 4 sources change. Last generated with:

```bash
git diff HEAD -- \
  src/api/types.ts \
  src/lib/fieldAdapters.js \
  src/components/fieldv2/EvidenceCaptureModal.jsx \
  src/components/fieldv2/EvidenceGalleryView.jsx \
  src/components/fieldv2/RunbookSteps.jsx

git diff --no-index /dev/null src/lib/fieldEvidenceViewModel.ts
```

(The final `git diff --no-index` hunk is for **`fieldEvidenceViewModel.ts`** when it is **untracked** on your branch; if it is already tracked, use `git diff HEAD -- src/lib/fieldEvidenceViewModel.ts` instead and merge hunks as needed.)

### How to use the patch

From the **repository root**, apply **after** Iterations 1–3 (or equivalent) so field v2 job detail and evidence components exist (Iteration 4 patch is separate):

```bash
git apply --check build-changes/iteration-4-fieldjobdetail-evidence-trust.patch
git apply build-changes/iteration-4-fieldjobdetail-evidence-trust.patch
```

`git apply --check` only succeeds when the **pre-patch** versions of the modified files match the patch context. If your tree already contains these edits, the check will fail by design—re-generate the patch from your branch or use `git apply --3way`.

### Follow-ups (evidence / storage, later iterations)

- Real **SAS + PUT** (or equivalent) with **`uploading` → `uploaded`** and persisted **`file_url`**
- **Offline / queue**: align capture with **`uploadQueue`** for local-only / awaiting-sync semantics
- **Single runbook source**: reconcile **`Runbook`** entity steps vs **`job.runbook_phases`** for step labels and capture defaults

### Technical debt (storage / API semantics)

- **`EvidenceCaptureModal`** still sends **`status: 'uploaded'`** on create because the current backend path expects it for “row saved”; it does **not** strictly mean “remote blob confirmed.” Marked **`TECHNICAL_DEBT`** in source; align enum + promotion with real upload when storage is wired.
- **`EvidenceFileUrlSchema`** may need another pass when signed or custom URL schemes appear beyond **`blob:`** (comment in `types.ts`).

---

## Iteration 5 — FieldJobDetail Comms + structured escalation

Canonical **Comms** tab is **three explicit zones in order** (numbered in UI + file header comment): (1) **Job coordination** — routine thread only; real `ChatMessage` by `job_id`; **`ChatView`** gets **`job`** for context strip, operational copy, send **`onError`**; copy states blockers do **not** belong here. (2) **Escalation / blocker** — persistent **amber** card (strong border/ring), heading + operational copy + **Report escalation** CTA; **Dialog** only wraps **`BlockerForm`** **`variant="comms"`** (`Blocker.create` + **`emitEscalationEvent`** / `blocker_create`). (3) **Meetings & context** — dashed, muted, lower-contrast block below. **`BlockerForm`**: comms toasts (**“Escalation saved for this job.”** / **“Notification sync may be delayed.”** when notify path fails after save).

### Changed file list

**New** (when the file was first added untracked — if **`JobCommsSection.jsx`** is already tracked on your branch, treat it as **Modified** and use `git diff HEAD` only)

- `src/components/fieldv2/JobCommsSection.jsx` — three numbered zones, header “Three parts” map, thread vs escalation vs meetings; persistent escalation card + **Dialog** + **`BlockerForm`**

**Modified**

- `src/components/field/ChatView.jsx` — optional **`job`** prop, job strip, operational strings, send **`onError`**; legacy callers unchanged (`jobId` only)
- `src/components/field/BlockerForm.jsx` — optional **`variant="comms"`** (copy + toasts only); same fields (category, severity, note, optional photo)

**Out of scope (by design)**

- Shell, **`telemetryQueue` / Azure** module edits, new **`escalation_source`** values, PM/AI **`Chat.jsx`** wiring into field-v2, evidence/runbook refactors.

### Patch

**[`iteration-5-fieldjobdetail-comms-escalation.patch`](./iteration-5-fieldjobdetail-comms-escalation.patch)**

Re-run the command block below to refresh when Iteration 5 sources change. Last generated with:

```bash
git diff HEAD -- \
  src/components/field/ChatView.jsx \
  src/components/field/BlockerForm.jsx

git diff --no-index /dev/null src/components/fieldv2/JobCommsSection.jsx
```

(Use the **`--no-index`** line only while **`JobCommsSection.jsx`** is **untracked**; once it is committed, use `git diff HEAD -- src/components/fieldv2/JobCommsSection.jsx` instead and merge hunks into one patch.)

### How to use the patch

From the **repository root**, apply **after** Iterations 1–4 (or equivalent) so field v2 job detail and shared field components exist:

```bash
git apply --check build-changes/iteration-5-fieldjobdetail-comms-escalation.patch
git apply build-changes/iteration-5-fieldjobdetail-comms-escalation.patch
```

`git apply --check` only succeeds when the **pre-patch** versions of the modified files match the patch context. If your tree already contains these edits, re-generate the patch from your branch or use `git apply --3way`.

### Follow-ups (addressed or deferred)

- **Iteration 6** aligned Comms/Overview/Closeout surfaces with shared **`fieldVisualTokens`** (see below); **`fj-blockers`** strip + read-only escalations list remain a **later** candidate.
- **`BlockerForm` / `createBlocker`** **`onError`** user-facing toast — still open.
- Optional **comms**-specific canonical event — only if product asks

---

## Iteration 6 — Canonical field visual system + enterprise polish

Shared **Tailwind class tokens** (`fieldVisualTokens`) and a small **`FieldSectionCard`** primitive unify spacing, typography (single **overline** scale), default **card** surfaces, **muted** / **warning** panels, and **CTA** / **tab** fragments across the canonical technician path. **Job list status** no longer duplicates lifecycle styling: **`FIELD_JOB_STATUS_DISPLAY`** extends **`LIFECYCLE_DISPLAY`** with **`qc_required`** / **`closed`** for list-only values; **`FieldJobs`** **`StatusBadge`** uses **`getFieldJobStatusDisplay`**. **FieldJobs** drops priority **emoji** in favor of text + neutral dots; **FieldJobDetail** header/meta/tabs and **fieldv2** sections consume the same rhythm so the flow reads as one product—**no** shell/nav redesign, **no** telemetry/Azure edits, **no** workflow rewrites.

### Token catalog (`src/lib/fieldVisualTokens.ts`)

| Constant | Role |
| -------- | ---- |
| **`FIELD_MAX_WIDTH`**, **`FIELD_PAGE_PAD_X`**, **`FIELD_PAGE_PAD_Y`** | Page column width and padding (aligned list + detail). |
| **`FIELD_STACK_GAP`**, **`FIELD_INNER_STACK`** | Vertical rhythm between major sections vs inside cards. |
| **`FIELD_OVERLINE`** | Section eyebrows (10px, uppercase, slate). |
| **`FIELD_BODY`**, **`FIELD_META`**, **`FIELD_META_MONO`** | Body, secondary lines, mono IDs. |
| **`FIELD_CARD`**, **`FIELD_CARD_HEADER`**, **`FIELD_CARD_BODY`** | Default white card shell + titled header band + body padding. |
| **`FIELD_SURFACE_MUTED`**, **`FIELD_SURFACE_WARNING`** | Secondary dashed panels; escalation / strong attention (amber). |
| **`BTN_PRIMARY`**, **`BTN_SECONDARY`**, **`BTN_DANGER`** | Named CTA fragments (slate / outline / red). |
| **`FIELD_TAB_LABEL`**, **`FIELD_TAB_ACTIVE`**, **`FIELD_TAB_INACTIVE`** | Job detail segment tabs (sentence case; not the uppercase overline). |
| **`FIELD_CTRL_H`**, **`FIELD_BADGE_NEUTRAL`**, **`FIELD_BADGE_WARN`** | Control height; compact badges. |
| **`FIELD_LINK_PRIMARY`**, **`FIELD_LINK_SECONDARY`** | Text CTAs (e.g. Runbook/Evidence vs Closeout on Overview). |

### Patterns standardized

- **Status / lifecycle:** one map for list + detail pills (**`FIELD_JOB_STATUS_DISPLAY`** + **`LIFECYCLE_DISPLAY`** on Overview).
- **Cards / surfaces:** **`FIELD_CARD`** (+ **`FieldSectionCard`**) vs **`FIELD_SURFACE_MUTED`** / **`FIELD_SURFACE_WARNING`** for Comms zones and Closeout activity.
- **Overlines:** **`FIELD_OVERLINE`** (and tab **`FIELD_TAB_LABEL`**) replace mixed 9–10px **`font-black`** / **`tracking-widest`** sprawl in touched files.
- **CTAs:** shared **`rounded-xl`** + **`h-10`** where applied; primary slate / semantic blues/ambers kept for state-machine gating where required.

### Changed file list

**New**

- `src/lib/fieldVisualTokens.ts` — string constants only (Tailwind fragments).
- `src/components/fieldv2/FieldSectionCard.jsx` — optional titled section card (`default` \| `muted` \| `warning`).

**Modified**

- `src/lib/fieldJobExecutionModel.ts` — **`FIELD_JOB_STATUS_DISPLAY`**, **`FieldJobListStatus`**, **`getFieldJobStatusDisplay`** (extends **`LIFECYCLE_DISPLAY`**).
- `src/pages/FieldJobs.jsx` — tokens, unified status badge, non-emoji priority, Lucide date/assignee icons.
- `src/pages/FieldJobDetail.jsx` — token layout for sticky header, tabs, main stack.
- `src/components/fieldv2/JobOverview.jsx` — **`FieldSectionCard`**, tokens, primary vs secondary quick links.
- `src/components/fieldv2/JobStateTransitioner.jsx` — **`FIELD_CARD`**, **`FIELD_CTRL_H`**, **`FIELD_META`**, **`BTN_SECONDARY`** on override cancel; gating colors unchanged.
- `src/components/fieldv2/FieldTimeTracker.jsx` — **`FIELD_CARD`**, overline/body, badge + timer buttons.
- `src/components/fieldv2/RunbookSteps.jsx` — step cards, overlines, **`FIELD_CTRL_H`** actions.
- `src/components/fieldv2/EvidenceGalleryView.jsx` — requirements panel, headers, detail actions via tokens.
- `src/components/fieldv2/JobCloseoutSection.jsx` — overlines, **`FIELD_CARD`**, muted activity block.
- `src/components/fieldv2/JobCommsSection.jsx` — **`FIELD_SURFACE_*`**, **`FIELD_CARD`**, typography alignment with tokens (three zones unchanged in order).
- `src/components/fieldv2/OfflineEditsIndicator.jsx` / **`UploadProgressIndicator.jsx`** — radius/border/shadow + token meta/body where used.
- `src/components/fieldv2/PreJobToolCheckModal.jsx` — token pass on panels/headers only (technical **`code`** copy preserved).

**Out of scope (by design)**

- `Layout.jsx` / global nav, **`telemetryQueue`** / Azure modules, theme-wide Tailwind reset, legacy non-canonical pages (**`JobDetail.jsx`**, **`Chat.jsx`**, etc.), global **`button.tsx`** / shadcn defaults (avoided unless unavoidable).

### Patch

**[`iteration-6-canonical-field-visual-system.patch`](./iteration-6-canonical-field-visual-system.patch)**

Re-run the command block below to refresh when Iteration 6 sources change:

```bash
git diff HEAD -- \
  src/lib/fieldJobExecutionModel.ts \
  src/pages/FieldJobs.jsx \
  src/pages/FieldJobDetail.jsx \
  src/components/fieldv2/JobOverview.jsx \
  src/components/fieldv2/JobStateTransitioner.jsx \
  src/components/fieldv2/FieldTimeTracker.jsx \
  src/components/fieldv2/RunbookSteps.jsx \
  src/components/fieldv2/EvidenceGalleryView.jsx \
  src/components/fieldv2/JobCloseoutSection.jsx \
  src/components/fieldv2/JobCommsSection.jsx \
  src/components/fieldv2/OfflineEditsIndicator.jsx \
  src/components/fieldv2/UploadProgressIndicator.jsx \
  src/components/fieldv2/PreJobToolCheckModal.jsx

git diff --no-index /dev/null src/lib/fieldVisualTokens.ts
git diff --no-index /dev/null src/components/fieldv2/FieldSectionCard.jsx
```

(Use the two **`--no-index`** lines only while **`fieldVisualTokens.ts`** / **`FieldSectionCard.jsx`** are **untracked**; once committed, use `git diff HEAD -- <paths>` for those files instead and merge into one patch.)

### How to use the patch

From the **repository root**, apply **after** Iterations 1–5 (or equivalent) so canonical pages and field v2 components exist:

```bash
git apply --check build-changes/iteration-6-canonical-field-visual-system.patch
git apply build-changes/iteration-6-canonical-field-visual-system.patch
```

`git apply --check` only succeeds when the **pre-patch** versions of the modified files match the patch context. Re-generate or use `git apply --3way` if your tree has diverged.

### Iteration 6.1 (small cleanup, same canonical scope)

- Dropped unused **`FIELD_OVERLINE_STRONG`** / **`FIELD_SECTION_TITLE`** tokens; tightened **JobOverview** and **PreJobToolCheckModal** operator copy; **FieldJobs** filter chips use bordered inactive state for contrast; **Evidence** thumbnails use slightly calmer QC/record overlays.

### Deferred (Iteration 9+)

- Global theme, dark mode, animation polish, legacy pages.
- **`fj-blockers`** strip on job detail + read-only open escalations in Comms.
- Design tokens as CSS variables, reduced-motion preference, Storybook for field molecules, a11y contrast pass on amber/red panels.

---

## Iteration 7 — Readiness + acknowledgement rigor (canonical path)

Honest **Route → Start work → Work timer** readiness on **Overview** (`buildFieldReadinessSummary`), shared **`READINESS_SHORT_LINES`** for header next-step copy, lifecycle/timer framing, pre-job dialog outside-dismiss prevention, acknowledgement sheet operator copy. **No** shell, telemetry/Azure, or new job schema fields.

Longer context: **[`iteration-7-readiness-rigor.md`](./iteration-7-readiness-rigor.md)**.

### Changed file list

**New** (use **`git diff --no-index`** below while these paths are **untracked**; once committed, fold them into **`git diff HEAD --`** only)

- `src/lib/fieldReadinessViewModel.ts`
- `src/lib/__tests__/fieldReadinessViewModel.test.ts`
- `src/components/fieldv2/ReadinessSummaryCard.jsx`

**Modified**

- `src/components/fieldv2/JobOverview.jsx`
- `src/components/fieldv2/jobExecutionNextStep.js`
- `src/components/fieldv2/JobStateTransitioner.jsx`
- `src/components/fieldv2/FieldTimeTracker.jsx`
- `src/components/fieldv2/PreJobToolCheckModal.jsx`
- `src/components/field/AcknowledgementSheets.jsx`

### Patch

**[`iteration-7-readiness-rigor.patch`](./iteration-7-readiness-rigor.patch)**

Re-run from the **repository root** to refresh ( **`git diff --no-index`** exits **1** when there are changes — append with **`|| true`** or run in a subshell):

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

Once the three **new** files are **tracked**, replace the three **`--no-index`** lines with:

`git diff HEAD -- src/lib/fieldReadinessViewModel.ts src/lib/__tests__/fieldReadinessViewModel.test.ts src/components/fieldv2/ReadinessSummaryCard.jsx`

and merge into a single **`git diff HEAD -- …`** block.

### How to use the patch

From the **repository root**, apply **after** Iterations 1–6 (or equivalent):

```bash
git apply --check build-changes/iteration-7-readiness-rigor.patch
git apply build-changes/iteration-7-readiness-rigor.patch
```

`git apply --check` only succeeds when the **pre-patch** versions of the modified files match the patch context. Re-generate or use `git apply --3way` if your tree has diverged.

---

## Iteration 8 — Runbook execution rigor (canonical path)

Canonical **Runbook** tab is driven **only** by **`job.runbook_phases`** (no template list). Real **progress** from job-backed steps; **pass/fail** persists via **`mergeRunbookStepOutcome`** + **`base44.entities.Job.update`** after **`emitRunbookStepEvent`**, aligned with **[`RunbookView.jsx`](../src/components/field/RunbookView.jsx)** (`completed` + `result` including **`fail`** for legacy display). **Session-only** “Running” until complete/fail; **phase gating** matches RunbookView; **evidence** row shows linked count or **None linked**; failed steps link to **Comms**; **closeout** banner when runbook incomplete. **`runbookExecutionViewModel.ts`** holds pure ordering/gating/progress/merge helpers.

### Changed file list

**New** (use **`git diff --no-index`** below while **untracked**; once committed, use **`git diff HEAD --`** for those paths only)

- `src/lib/runbookExecutionViewModel.ts`
- `src/lib/__tests__/runbookExecutionViewModel.test.ts`

**Modified**

- `src/components/fieldv2/RunbookSteps.jsx`
- `src/pages/FieldJobDetail.jsx`
- `src/components/field/RunbookView.jsx` — **`RESULT_CFG.fail`** + **`stepResult`** handles **`result: 'fail'`** (fieldv2 persistence alignment)

### Patch

**[`iteration-8-runbook-rigor.patch`](./iteration-8-runbook-rigor.patch)**

Re-run from the **repository root** to refresh:

```bash
{
  git diff HEAD -- \
    src/components/field/RunbookView.jsx \
    src/components/fieldv2/RunbookSteps.jsx \
    src/pages/FieldJobDetail.jsx
  git diff --no-index /dev/null src/lib/runbookExecutionViewModel.ts || true
  git diff --no-index /dev/null src/lib/__tests__/runbookExecutionViewModel.test.ts || true
} > build-changes/iteration-8-runbook-rigor.patch
```

Once the two **new** files are **tracked**, replace the **`--no-index`** lines with:

`git diff HEAD -- src/lib/runbookExecutionViewModel.ts src/lib/__tests__/runbookExecutionViewModel.test.ts`

and merge into one **`git diff HEAD -- …`** block.

### How to use the patch

From the **repository root**, apply **after** Iterations 1–7 (or equivalent):

```bash
git apply --check build-changes/iteration-8-runbook-rigor.patch
git apply build-changes/iteration-8-runbook-rigor.patch
```

`git apply --check` only succeeds when the **pre-patch** tree matches the patch context. Re-generate or use `git apply --3way` if your tree has diverged.

---

## Iteration 9 — Closeout rigor & completion gating (canonical path)

Closeout is an **operational checkpoint**: explicit **readiness summary** (`ready` / `blocked` / `review_suggested` for checklist-derived states), a **truthful checklist** tied to `canTransition` (work-complete + submit gates), **`job.evidence_requirements`** via `partitionEvidenceForRequirements`, **runbook** state, **sign-off** as one row (not the whole tab), **timer** (`workSegmentOpen`) and **Blocker** records (open/acknowledged ≠ resolved). **Action links** jump to Runbook, Evidence, Comms, Overview, or focus/scroll to sign-off. **Audit** stays secondary. **Job state → Complete work** copy nudges technicians to check Closeout first (no new backend lockouts).

**Technical debt:** `FieldJobDetail` still loads blockers via `base44.entities.Blocker.filter` — should move behind `apiClient` / `jobRepository` when you add a canonical API path (keep `['blockers', jobId]` in sync with `BlockerForm`).

### Changed file list

**New** (use **`git diff --no-index`** below while **untracked**; once committed, fold into **`git diff HEAD --`**)

- `src/lib/closeoutReadinessViewModel.ts`
- `src/lib/__tests__/closeoutReadinessViewModel.test.ts`

**Modified**

- `src/components/fieldv2/JobCloseoutSection.jsx`
- `src/pages/FieldJobDetail.jsx` — `blockers` query (`base44.entities.Blocker.filter`), invalidate, props to Closeout
- `src/components/fieldv2/JobStateTransitioner.jsx` — Closeout checklist hint on **Complete work**

### Patch

**[`iteration-9-closeout-rigor.patch`](./iteration-9-closeout-rigor.patch)**

Re-run from the **repository root** to refresh:

```bash
{
  git diff HEAD -- \
    src/components/fieldv2/JobCloseoutSection.jsx \
    src/pages/FieldJobDetail.jsx \
    src/components/fieldv2/JobStateTransitioner.jsx
  git diff --no-index /dev/null src/lib/closeoutReadinessViewModel.ts || true
  git diff --no-index /dev/null src/lib/__tests__/closeoutReadinessViewModel.test.ts || true
} > build-changes/iteration-9-closeout-rigor.patch
```

Once the two **new** files are **tracked**, replace the **`--no-index`** lines with:

`git diff HEAD -- src/lib/closeoutReadinessViewModel.ts src/lib/__tests__/closeoutReadinessViewModel.test.ts`

and merge into one **`git diff HEAD -- …`** block.

### How to use the patch

From the **repository root**, apply **after** Iterations 1–8 (or equivalent):

```bash
git apply --check build-changes/iteration-9-closeout-rigor.patch
git apply build-changes/iteration-9-closeout-rigor.patch
```

---

## Iteration 10 — QC & review-loop rigor (canonical Evidence path)

**`evidenceQcViewModel.ts`** normalizes `qc_status` strings (`pass` / `passed` / `approved`, `fail` / `rejected`, etc.) into **pass | fail | pending**, rolls up counts for **uploaded** files only, and drives presentation copy. **Evidence** tab: **QC on saved files** summary strip (tight copy: saved vs QC outcome), **PASS | FAIL | REVIEW** pills on thumbnails (pending = review not recorded), **geo** pin top-right and **QC** pill bottom-right to reduce overlay clutter, section headers show **QC fail** counts when relevant, detail modal separates **file on job** vs **QC** with **Mark QC pass/fail**, failed-QC **replacement** CTA, and metadata rows. **Closeout** (`in_progress` + `pending_closeout`): **attention** row when any uploaded evidence is **QC fail** — operational wording (“may need replacement”), no backend lockout. Tests: `evidenceQcViewModel.test.ts`, extended `closeoutReadinessViewModel.test.ts`.

### Changed file list

**New** (use **`git diff --no-index`** while untracked; then fold into **`git diff HEAD --`**)

- `src/lib/evidenceQcViewModel.ts`
- `src/lib/__tests__/evidenceQcViewModel.test.ts`

**Modified**

- `src/components/fieldv2/EvidenceGalleryView.jsx`
- `src/lib/fieldEvidenceViewModel.ts` — `qc_status` on `EvidenceLike`
- `src/lib/closeoutReadinessViewModel.ts` — QC-fail evidence attention row
- `src/lib/__tests__/closeoutReadinessViewModel.test.ts`

### Patch

**[`iteration-10-qc-review-rigor.patch`](./iteration-10-qc-review-rigor.patch)**

Re-run from the **repository root** to refresh:

```bash
{
  git diff HEAD -- \
    src/lib/fieldEvidenceViewModel.ts \
    src/lib/closeoutReadinessViewModel.ts \
    src/lib/__tests__/closeoutReadinessViewModel.test.ts \
    src/components/fieldv2/EvidenceGalleryView.jsx
  git diff --no-index /dev/null src/lib/evidenceQcViewModel.ts || true
  git diff --no-index /dev/null src/lib/__tests__/evidenceQcViewModel.test.ts || true
} > build-changes/iteration-10-qc-review-rigor.patch
```

Once the two **new** files are **tracked**, replace the **`--no-index`** lines with:

`git diff HEAD -- src/lib/evidenceQcViewModel.ts src/lib/__tests__/evidenceQcViewModel.test.ts`

### How to use the patch

From the **repository root**, apply **after** Iterations 1–9 (or equivalent):

```bash
git apply --check build-changes/iteration-10-qc-review-rigor.patch
git apply build-changes/iteration-10-qc-review-rigor.patch
```

---

## Iteration 11 — Technician closeout outcome & feedback

**`fieldCloseoutFeedbackViewModel.ts`** owns job update payload, `feedback_event` mapping (`feedback_source: 'closeout'`, complaint flag from outcome triad and/or explicit checkbox), and hydration from the job row. **Closeout** tab: **`JobCloseoutOutcomePanel`** (after readiness card, before sign-off) with triad **clean / concerns / problematic**, optional **1–5** rating, **complaint** / **compliment** flags, **notes**; **`Job.update` first**, then **`emitFeedbackEvent`** on success; read-only summary on **submitted / approved / rejected** when data exists. **Readiness** (`pending_closeout`): **info** checklist row + **`closeout_outcome`** deep-link scroll (`closeout-technician-outcome-anchor`). **Job schema**: six optional **`technician_closeout_*`** fields in **`api/types.ts`** and **`lib/types`**. Tests: **`fieldCloseoutFeedbackViewModel.test.ts`**, extended **`closeoutReadinessViewModel.test.ts`**.

### Changed file list

**New** (use **`git diff --no-index`** while untracked; then fold into **`git diff HEAD --`**)

- `src/lib/fieldCloseoutFeedbackViewModel.ts`
- `src/lib/__tests__/fieldCloseoutFeedbackViewModel.test.ts`
- `src/components/fieldv2/JobCloseoutOutcomePanel.jsx`

**Modified**

- `src/api/types.ts` — `JobSchema` technician closeout fields
- `src/lib/types/index.ts` — `Job` interface
- `src/lib/closeoutReadinessViewModel.ts` — `CloseoutNavSection`, info row
- `src/lib/__tests__/closeoutReadinessViewModel.test.ts`
- `src/components/fieldv2/JobCloseoutSection.jsx` — panel + `closeout_outcome` scroll

### Patch

**[`iteration-11-outcome-feedback.patch`](./iteration-11-outcome-feedback.patch)**

Re-run from the **repository root** to refresh:

```bash
{
  git diff HEAD -- \
    src/api/types.ts \
    src/lib/types/index.ts \
    src/lib/closeoutReadinessViewModel.ts \
    src/lib/__tests__/closeoutReadinessViewModel.test.ts \
    src/components/fieldv2/JobCloseoutSection.jsx
  git diff --no-index /dev/null src/lib/fieldCloseoutFeedbackViewModel.ts || true
  git diff --no-index /dev/null src/lib/__tests__/fieldCloseoutFeedbackViewModel.test.ts || true
  git diff --no-index /dev/null src/components/fieldv2/JobCloseoutOutcomePanel.jsx || true
} > build-changes/iteration-11-outcome-feedback.patch
```

Once the **new** files are **tracked**, replace the **`--no-index`** lines with:

`git diff HEAD -- src/lib/fieldCloseoutFeedbackViewModel.ts src/lib/__tests__/fieldCloseoutFeedbackViewModel.test.ts src/components/fieldv2/JobCloseoutOutcomePanel.jsx`

### How to use the patch

From the **repository root**, apply **after** Iterations 1–10 (or equivalent):

```bash
git apply --check build-changes/iteration-11-outcome-feedback.patch
git apply build-changes/iteration-11-outcome-feedback.patch
```

### Iteration 11.1 — Closeout outcome polish (after 11)

Small UX copy and presentation pass: triad buttons drop **`FIELD_CTRL_H`** for natural vertical sizing; checkbox and intro copy are operator-facing; read-only **saved** time uses **`date-fns`** (`MMM d, yyyy · h:mm a`, aligned with other field timestamps); readiness row copy is explicitly **informational** (recommended / not required to submit / does not block handoff).

**Patch:** [`iteration-11.1-closeout-outcome-polish.patch`](./iteration-11.1-closeout-outcome-polish.patch) — apply after Iteration 11.

```bash
git apply --check build-changes/iteration-11.1-closeout-outcome-polish.patch
git apply build-changes/iteration-11.1-closeout-outcome-polish.patch
```

---

## Iteration 12 — Job context snapshot rigor (canonical field path)

**`jobContextField.js`:** explicit **`extractJobContextFingerprintMaterial`** + **`buildRunbookStructureKey`**; fingerprint **`JOB_CONTEXT_SCHEMA_VERSION` `1.2.0`** — adds **`project_id` / `site_id`** and sorted phase:step **`rb_sig`**; drops noisy **`updated_date`**; module doc lists fingerprint vs payload. **`emitJobContextFieldIfChanged`** chains concurrent work per **`job_id`**. **[`FieldJobDetail.jsx`](../src/pages/FieldJobDetail.jsx):** `job` / `user` via refs; **`useEffect`** deps **`jobId` + `contextDedupeKey` + `techKey`** only (no refetch churn). Tests: **`fieldJobContextSnapshot.test.ts`**.

### Changed file list

**New**

- `src/lib/__tests__/fieldJobContextSnapshot.test.ts`

**Modified**

- `src/lib/jobContextField.js`
- `src/pages/FieldJobDetail.jsx`
- `docs/planning/FIELD_APP_TECHPULSE_AZURE_README.md` (job context fingerprint description)

### Patch

**[`iteration-12-job-context-rigor.patch`](./iteration-12-job-context-rigor.patch)**

Re-run from the **repository root** to refresh:

```bash
{
  git diff HEAD -- \
    src/lib/jobContextField.js \
    src/pages/FieldJobDetail.jsx \
    docs/planning/FIELD_APP_TECHPULSE_AZURE_README.md \
    build-changes/README.md
  git diff --no-index /dev/null src/lib/__tests__/fieldJobContextSnapshot.test.ts || true
} > build-changes/iteration-12-job-context-rigor.patch
```

Once the **new** test file is **tracked**, replace the **`--no-index`** line with:

`git diff HEAD -- src/lib/__tests__/fieldJobContextSnapshot.test.ts`

### How to use the patch

From the **repository root**, apply **after** Iterations 1–11 (and 11.1 if used):

```bash
git apply --check build-changes/iteration-12-job-context-rigor.patch
git apply build-changes/iteration-12-job-context-rigor.patch
```

### Iteration 12.1 — Job context polish (after 12)

Documents **blockers query / closeout props** on FieldJobDetail as **carry-through**, not Iteration 12 `job_context_field` scope. **`normalizeJobContextLinkId`** shared by fingerprint material and **`buildJobContextFieldPayload`** so **`project_id` / `site_id`** match dedupe and outbound **`job_context_field`** (Azure schema). Module note: when fingerprint inputs change, bump **`JOB_CONTEXT_SCHEMA_VERSION`**, tests, and planning docs together. **`buildRunbookStructureKey`** comment clarifies index fallback stability.

**Modified:** `src/lib/jobContextField.js`, `src/pages/FieldJobDetail.jsx`, `src/lib/__tests__/fieldJobContextSnapshot.test.ts`, `docs/planning/FIELD_APP_TECHPULSE_AZURE_README.md`, `build-changes/README.md`.

**Patch:** [`iteration-12.1-job-context-polish.patch`](./iteration-12.1-job-context-polish.patch) — apply after Iteration 12.

Re-generate from repo root:

```bash
{
  git diff HEAD -- \
    src/lib/jobContextField.js \
    src/pages/FieldJobDetail.jsx \
    src/lib/__tests__/fieldJobContextSnapshot.test.ts \
    docs/planning/FIELD_APP_TECHPULSE_AZURE_README.md
  # plus README hunk for this subsection only (see Iteration 11 README regen pattern)
} > build-changes/iteration-12.1-job-context-polish.patch
```

```bash
git apply --check build-changes/iteration-12.1-job-context-polish.patch
git apply build-changes/iteration-12.1-job-context-polish.patch
```

---

## Iteration 13 — Offline / outbox consolidation + sync-state rigor

**Presentation:** [`fieldJobSyncPresentation.ts`](../src/lib/fieldJobSyncPresentation.ts) — shared operator labels for Dexie **queuedEdits**, in-memory **`UploadQueueManager`** (not Dexie `uploadQueue` in jobRepository), and telemetry backlog wording; **`summarizeJobSyncSurface`** drives the job-level summary line.

**Telemetry:** [`getTelemetryQueueDepthForJob`](../src/lib/telemetryQueue.js) — read-only job-scoped depth over `loadAllRows()` (string-matched `envelope.job_id`); **no** flush/backoff changes.

**UI:** [`FieldJobSyncStrip.jsx`](../src/components/fieldv2/FieldJobSyncStrip.jsx) polls ~1.5s, nests [`OfflineEditsIndicator`](../src/components/fieldv2/OfflineEditsIndicator.jsx) + [`UploadProgressIndicator`](../src/components/fieldv2/UploadProgressIndicator.jsx) with **`nested`** styling; [`FieldJobDetail.jsx`](../src/pages/FieldJobDetail.jsx) uses the strip instead of stacking indicators alone. Optional phrase alignment: [`EvidenceGalleryView.jsx`](../src/components/fieldv2/EvidenceGalleryView.jsx) **`EVIDENCE_IN_FLIGHT_PHRASE`**.

**Tests:** [`fieldJobSyncPresentation.test.ts`](../src/lib/__tests__/fieldJobSyncPresentation.test.ts); [`iteration13TelemetryQueue.test.js`](../src/tests/iteration13TelemetryQueue.test.js) adds **`getTelemetryQueueDepthForJob`** cases (existing flush/durability tests unchanged).

### Changed file list

**New**

- `src/lib/fieldJobSyncPresentation.ts`
- `src/lib/__tests__/fieldJobSyncPresentation.test.ts`
- `src/components/fieldv2/FieldJobSyncStrip.jsx`

**Modified**

- `src/lib/telemetryQueue.js`
- `src/tests/iteration13TelemetryQueue.test.js`
- `src/components/fieldv2/OfflineEditsIndicator.jsx`
- `src/components/fieldv2/UploadProgressIndicator.jsx`
- `src/pages/FieldJobDetail.jsx`
- `src/components/fieldv2/EvidenceGalleryView.jsx` (optional copy)
- `build-changes/README.md`

### Patch

**[`iteration-13-sync-outbox-rigor.patch`](./iteration-13-sync-outbox-rigor.patch)**

Re-generate from the **repository root** (after Iteration 13 files are present):

```bash
{
  git diff HEAD -- \
    src/lib/telemetryQueue.js \
    src/tests/iteration13TelemetryQueue.test.js \
    src/components/fieldv2/OfflineEditsIndicator.jsx \
    src/components/fieldv2/UploadProgressIndicator.jsx
  git diff --no-index /dev/null src/lib/fieldJobSyncPresentation.ts || true
  git diff --no-index /dev/null src/lib/__tests__/fieldJobSyncPresentation.test.ts || true
  git diff --no-index /dev/null src/components/fieldv2/FieldJobSyncStrip.jsx || true
} > build-changes/iteration-13-sync-outbox-rigor.patch
```

Then append the **`FieldJobDetail.jsx`** and **`EvidenceGalleryView.jsx`** hunks from this README’s committed patch (or re-apply manually) if your tree already diverged from the Iteration 13 base.

### How to use the patch

From the **repository root**, apply **after** prior iteration patches your branch uses:

```bash
git apply --check build-changes/iteration-13-sync-outbox-rigor.patch
git apply build-changes/iteration-13-sync-outbox-rigor.patch
```

### Iteration 13.1 — Sync strip polish (after 13)

Small follow-up: **document** that `FieldJobSyncStrip` interval polling of Dexie + upload manager + telemetry is **provisional** (prefer subscription-driven updates later). **Wording:** completed upload sessions use **“Upload finished”** (not “file sent”) so operators do not read it as full evidence/QC/server completeness. **Layout:** summary line uses `min-w-0`, `break-words`, and `text-pretty` for narrow viewports.

**Modified:** `src/components/fieldv2/FieldJobSyncStrip.jsx`, `src/lib/fieldJobSyncPresentation.ts`, `src/components/fieldv2/UploadProgressIndicator.jsx`, `src/lib/__tests__/fieldJobSyncPresentation.test.ts`, `build-changes/README.md`.

---

## Iteration 14 — Canonical event-family hardening + emit-before-mutate audit

**Coverage map:** [`canonicalFieldEventCoverage.ts`](../src/lib/canonicalFieldEventCoverage.ts) + [`canonicalFieldEventCoverage.test.ts`](../src/lib/__tests__/canonicalFieldEventCoverage.test.ts) — all 11 Iteration 14 families mapped to emitter modules.

**Closeout flags:** [`closeoutSubmissionFlags.ts`](../src/lib/closeoutSubmissionFlags.ts) + tests — shared with legacy [`CloseoutPreview.jsx`](../src/components/field/CloseoutPreview.jsx) and v2 submit.

**V2 submit (`pending_closeout` → `submitted`):** [`jobStateTransitionMutation.ts`](../src/lib/jobStateTransitionMutation.ts) — **`emitCloseoutEvent`** → **`emitDispatchEventForJobStatusChange`** → **`Job.update`** (same `closeout_submitted_at` as closeout payload). Wired from [`JobStateTransitioner.jsx`](../src/components/fieldv2/JobStateTransitioner.jsx).

**Technician finish outcome:** [`technicianCloseoutOutcomeSave.ts`](../src/lib/technicianCloseoutOutcomeSave.ts) — **`emitFeedbackEvent`** before **`Job.update`**; [`JobCloseoutOutcomePanel.jsx`](../src/components/fieldv2/JobCloseoutOutcomePanel.jsx). [`fieldCloseoutFeedbackViewModel.ts`](../src/lib/fieldCloseoutFeedbackViewModel.ts) — optional **`recordedAtIso`** on **`buildTechnicianCloseoutJobUpdate`**.

**Escalation:** [`BlockerForm.jsx`](../src/components/field/BlockerForm.jsx) — **`emitEscalationEvent`** before **`Blocker.create`** (`escalation_record_id` omitted until a post-create follow-up exists); honest toast if create fails after enqueue.

**Explicit non-changes:** No rewrite of [`telemetryQueue.js`](../src/lib/telemetryQueue.js); artifact/QC remain post-persist emit; travel/arrival on FieldJobDetail overview remains a product follow-up (documented in coverage map).

### Iteration 14.1 — Documentation cleanup (after 14)

- **[`canonicalFieldEventCoverage.ts`](../src/lib/canonicalFieldEventCoverage.ts)** — File header states explicitly that the registry is **not** runtime source of truth (no routing / emission logic); `travel` row calls out **incomplete canonical v2** coverage and points to a travel/arrival lifecycle follow-up (recommended **Iteration 15**).
- **[`artifactEvent.js`](../src/lib/artifactEvent.js)** — `fetchJobContextForArtifactEvent` JSDoc notes cross-family reuse and **TECHNICAL_DEBT** for a neutral alias name if reuse grows.
- **[`jobStateTransitionMutation.ts`](../src/lib/jobStateTransitionMutation.ts)** — Inline note where that helper enriches closeout payloads.
- **[`technicianCloseoutOutcomeSave.ts`](../src/lib/technicianCloseoutOutcomeSave.ts)** + **[`fieldCloseoutFeedbackViewModel.ts`](../src/lib/fieldCloseoutFeedbackViewModel.ts)** — Explicit **intentional** emit-before-persist for technician feedback (do not flip casually).

### Changed file list

**New**

- `src/lib/canonicalFieldEventCoverage.ts`
- `src/lib/__tests__/canonicalFieldEventCoverage.test.ts`
- `src/lib/closeoutSubmissionFlags.ts`
- `src/lib/__tests__/closeoutSubmissionFlags.test.ts`
- `src/lib/jobStateTransitionMutation.ts`
- `src/lib/__tests__/jobStateTransitionMutation.test.ts`
- `src/lib/technicianCloseoutOutcomeSave.ts`
- `src/lib/__tests__/technicianCloseoutOutcomeSave.test.ts`

**Modified**

- `src/components/fieldv2/JobStateTransitioner.jsx`
- `src/components/field/CloseoutPreview.jsx`
- `src/components/fieldv2/JobCloseoutOutcomePanel.jsx`
- `src/components/field/BlockerForm.jsx`
- `src/lib/fieldCloseoutFeedbackViewModel.ts`
- `build-changes/README.md`

### Patch

**[`iteration-14-canonical-events.patch`](./iteration-14-canonical-events.patch)**

Re-generate from the **repository root** (adjust `git diff HEAD` vs `git diff --no-index /dev/null` depending on what is already tracked):

```bash
{
  git diff HEAD -- \
    src/components/field/BlockerForm.jsx \
    src/components/field/CloseoutPreview.jsx \
    src/components/fieldv2/JobStateTransitioner.jsx \
    src/components/fieldv2/JobCloseoutOutcomePanel.jsx \
    src/lib/fieldCloseoutFeedbackViewModel.ts \
    build-changes/README.md
  git diff --no-index /dev/null src/lib/canonicalFieldEventCoverage.ts || true
  git diff --no-index /dev/null src/lib/__tests__/canonicalFieldEventCoverage.test.ts || true
  git diff --no-index /dev/null src/lib/closeoutSubmissionFlags.ts || true
  git diff --no-index /dev/null src/lib/__tests__/closeoutSubmissionFlags.test.ts || true
  git diff --no-index /dev/null src/lib/jobStateTransitionMutation.ts || true
  git diff --no-index /dev/null src/lib/__tests__/jobStateTransitionMutation.test.ts || true
  git diff --no-index /dev/null src/lib/technicianCloseoutOutcomeSave.ts || true
  git diff --no-index /dev/null src/lib/__tests__/technicianCloseoutOutcomeSave.test.ts || true
} > build-changes/iteration-14-canonical-events.patch
```

### How to use the patch

From the **repository root**, apply **after** prior iteration patches your branch uses:

```bash
git apply --check build-changes/iteration-14-canonical-events.patch
git apply build-changes/iteration-14-canonical-events.patch
```

---

## Adding future iterations

1. Create `iteration-N-<short-name>.patch` using a scoped `git diff` (and `git diff --no-index` for new files if needed).
2. Append a new section to this README with the file list and patch name (and optionally a standalone **`iteration-N-<short-name>.md`** like Iteration 7).
