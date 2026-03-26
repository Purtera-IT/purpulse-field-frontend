# Runbook provisioning & resolved-assignment flow — implementation plan

**Status:** Draft — planning only; aligns with `docs/azure/REPO_TO_AZURE_DISCOVERY.md` and current field app repo behavior.

**Goals:**

1. Field Nation (or partner) **acceptance** triggers idempotent backend processing.
2. **internal_technician_id** is canonical in DB and maps to Field Nation provider id.
3. **Assignment** records gain `assigned_to_internal_technician_id`, `runbook_version`, `runbook_json`, `evidence_requirements`.
4. Field app loads **resolved assignments** and renders runbook.
5. Telemetry continues to send `technician_id` aligned with internal id where possible.

---

## 1. Evidence summary (Azure + repo)

- **API hosts (App Config):** `https://api.purpulse.app` (prod), `https://api-test.purpulse.app` (test).
- **Backend:** Function Apps `purpulse-prod-api-eus2` / `purpulse-test-api-eus2`; Postgres Flexible Server per environment.
- **Event Hubs / Service Bus:** None in audited subscription — do not depend on them for this flow.
- **Field app today:** Jobs/evidence via **Base44** entities in production; `VITE_TELEMETRY_INGESTION_URL` drives canonical POST; **not** present in Azure Web App app settings — verify CI/build.
- **Gap:** No `GET /api/assignments` in `src/api/client.ts` — must be added when backend exists.

---

## 2. Database schema (Postgres)

See **`scripts/sql/001_create_technicians_and_assignments.sql`** for draft DDL:

- `technicians` — UUID PK, `idp_subject`, email, status, metadata.
- `fieldnation_mapping` — `fieldnation_provider_id` → `internal_technician_id` FK.
- `job_assignments` **or** `ALTER TABLE jobs` — `assigned_to_internal_technician_id`, `runbook_version`, `runbook_json` (JSONB), `evidence_requirements` (JSONB).
- `webhook_idempotency` — idempotency keys for FN deliveries.

Indexes: `assigned_to_internal_technician_id` for list queries.

---

## 3. API design

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/webhooks/fieldnation` | Accept signed webhook; map provider; update assignment; idempotent |
| POST | `/api/technicians` | (Optional) Create technician + trigger IdP invite |
| GET | `/api/assignments?assigned_to={uuid}` | List jobs for technician with runbook payload |
| GET | `/api/jobs/{job_id}` | Job detail including assignment fields (may merge with existing v1 routes) |

Example JSON: **`examples/http/assignment_api_examples.md`**.

---

## 4. Webhook handler

Pseudocode and security notes: **`examples/webhooks/fieldnation_webhook_handler.md`**.

**Must-haves:**

- Signature verification (Field Nation spec).
- Idempotency via header or content hash.
- Transactional write: mapping + job update + idempotency row.

**Optional:** Emit internal event to same analytics pipeline as `dispatch_event` (Functions → existing ingestion) for audit.

---

## 5. Identity provisioning

**Base44 account vs Azure `technicians` row:** see [`fieldnation-webhook-user-provisioning.md`](fieldnation-webhook-user-provisioning.md) (optional `USER_PROVISIONING_WEBHOOK_URL` after FN webhook).

1. **Technician row** created on first FN `provider_id` seen, or pre-provisioned via admin API.
2. **IdP (e.g. Entra ID B2C / workforce tenant):** invite user; `idp_subject` stored on `technicians`.
3. **Token claims:** e.g. `extension_internalTechnicianId` or `oid` mapped server-side — field app calls `GET /api/assignments?assigned_to=` using claim or profile fetch after login.
4. **Activation:** magic link / password reset per IdP — product standard.

**Field app:** Extend auth bootstrap to read `internal_technician_id` (claim or `GET /api/me`) and pass to assignment fetch.

---

## 6. Field app changes (when implementing — out of scope for this doc-only deliverable)

- After login, resolve `internal_technician_id`.
- `GET /api/assignments?assigned_to=...` (or embed in existing user profile).
- Map `runbook_json` into existing runbook UI (`runbook_phases` or new prop).
- **Telemetry:** Set `technician_id` in envelopes to internal UUID when available; keep `getTechnicianIdForCanonicalEvents` fallback for legacy users.

---

## 7. Telemetry & ingestion

- Confirm **single-event POST** URL on API (e.g. `https://api-test.purpulse.app/v1/telemetry/events`) and set `VITE_TELEMETRY_INGESTION_URL` in **test** pipeline.
- Staging test: emit minimal event → verify HTTP 200/202 → trace in ingestion logs / `core.fact_*` per backend contract (not asserted in field repo alone).

---

## 8. Operational testing & rollout

- **Staging checklist:** `docs/plans/runbook-staging-test-checklist.md`.
- **Rollout:** Test → prod; feature flag optional for webhook route.
- **Rollback:** Revert Function deployment; DB columns nullable where possible.

### Security

- Webhook: signature, rate limits, IP allowlist if FN provides static egress.
- **Secrets:** Store FN signing keys in Key Vault (`KEY_VAULT_URI` already on Functions); never in repo.
- **Authorization:** `GET /assignments` must scope to caller’s `internal_technician_id` (or admin role).

---

## 9. Files in repo (this iteration)

| File | Purpose |
|------|---------|
| `docs/azure/REPO_TO_AZURE_DISCOVERY.md` | Azure discovery + repo expectations |
| `docs/plans/runbook-provisioning-plan.md` | This plan |
| `docs/plans/runbook-staging-test-checklist.md` | Staging steps |
| `scripts/sql/001_create_technicians_and_assignments.sql` | DDL draft |
| `examples/webhooks/fieldnation_webhook_handler.md` | Webhook pseudocode |
| `examples/http/assignment_api_examples.md` | HTTP examples |

---

## 10. Top risks & priority verification

### Risks (short list)

1. **Telemetry URL not in Azure app settings** — production builds may omit ingestion; queue grows without POST.
2. **Base44 vs REST split** — jobs may exist in two systems until unified; assignment API must be source of truth for runbook or sync back to Base44.
3. **Field Nation prod vs dev** — FN keys exist on dev Function app; prod mapping unconfirmed in audit.
4. **Webhook idempotency** — duplicate deliveries must not double-assign or corrupt runbook.
5. **IdP ↔ technician mapping** — wrong claim ⇒ wrong assignments list.
6. **RBAC on Key Vault** — secret names not listable without role; deployment may rely on KV references not visible in CLI.
7. **No Event Hubs** — high-volume webhook fan-out must use DB + Functions scale, not bus (unless added later).
8. **Schema migration** — `jobs` table owned by Base44 sync may resist direct ALTER; coordinate with data owner.

### Single highest-priority Azure check before implementation

**Confirm the exact HTTPS route and auth model for canonical telemetry POST on `api.purpulse.app` / `api-test.purpulse.app`** (path, JWT audience, APIM vs Function). Without this, `VITE_TELEMETRY_INGESTION_URL` cannot be set correctly in staging.

---

## 11. Follow-ups

- Rename `fetchJobContextForArtifactEvent` if reused broadly (see Iteration 14.1 notes in codebase).
- Unify job list: Base44 `Job.list` vs new assignments API — product decision.
