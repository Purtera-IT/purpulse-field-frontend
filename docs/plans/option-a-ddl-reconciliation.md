# Option A — DDL reconciliation (canonical vs alternate playbook)

Some staging playbooks use **different table/column names** than this repository. **This repo’s single source of truth** for Option A schema is:

- [`scripts/sql/001_create_technicians_and_assignments.sql`](../../scripts/sql/001_create_technicians_and_assignments.sql)

## Canonical choices

| Topic | Canonical in this repo | Alternate (external playbook) | Notes |
|-------|------------------------|------------------------------|--------|
| Technician PK | `technicians.id` (UUID) | `internal_technician_id` as column name | **API query param `assigned_to`** and JWT claims should use the same UUID as **`technicians.id`**. The column is not named `internal_technician_id` on the table; only FK columns use that name. |
| Technician names | `first_name`, `last_name`, optional `display_name` | single `name` column | FN webhook and `GET /api/me` use **`first_name` / `last_name`**; run [`002_technicians_first_last_name.sql`](../../scripts/sql/002_technicians_first_last_name.sql) if upgrading an older DB. |
| Entra hybrid (invite) | `entra_object_id`, `entra_invite_sent_at`, `entra_invite_last_error` | — | Graph invitation tracking; run [`003_technicians_entra_hybrid.sql`](../../scripts/sql/003_technicians_entra_hybrid.sql) if upgrading. |
| UUID generation | `gen_random_uuid()` (PG 13+) | `uuid_generate_v4()` + `uuid-ossp` | Prefer **no extension** on Azure Flexible Server: use `gen_random_uuid()` only. |
| FN mapping table | `fieldnation_mapping` (singular) | `fieldnation_mappings` (plural) | Do not create both; use **fieldnation_mapping** here. |
| Assignment storage | `job_assignments` with `job_id` **TEXT** (matches app job ids) | `assignments` with `job_id UUID` PK | **job_assignments** avoids implying the row is the full job entity; `job_id` references the Purpulse job id string from PM/Base44. |
| Idempotency | `webhook_idempotency` | inline only | Required for FN retries. |

## Field app alignment

[`src/api/types.ts`](../../src/api/types.ts) `ResolvedAssignmentSchema` expects:

- `job_id`, `title`, `scheduled_date`, `runbook_version`, `runbook_json`, `evidence_requirements`

The DDL stores `title` and `scheduled_date` on **`job_assignments`** so `GET /api/assignments` can return them without joining Base44 (optional join later for richer copy).

## If you already applied the alternate DDL

1. Stop applying a second conflicting schema on the same database.
2. Either migrate (rename tables / columns) or use a **fresh** test database and apply **only** `001_create_technicians_and_assignments.sql`.
3. Update backend code to query **`technicians.id`**, **`fieldnation_mapping`**, **`job_assignments`**.

## References

- Backend contract: [`docs/backend-handoff/OPTION_A_ROUTES.md`](../../docs/backend-handoff/OPTION_A_ROUTES.md)
- Staging steps: [`option-a-staging-playbook.md`](option-a-staging-playbook.md)
