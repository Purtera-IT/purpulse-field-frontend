# SQL migrations (Purpulse field / Option A)

Schema naming and alternate DDLs: [`docs/plans/option-a-ddl-reconciliation.md`](../docs/plans/option-a-ddl-reconciliation.md).  
Full Azure deploy / Key Vault / smoke steps: [`docs/plans/option-a-azure-ops-playbook.md`](../docs/plans/option-a-azure-ops-playbook.md).  
Apply **`003`** from a shell: [`OPERATOR_RUNBOOK.md`](OPERATOR_RUNBOOK.md).

## `001_create_technicians_and_assignments.sql`

**Target:** Azure Database for PostgreSQL Flexible Server — **test** first (`purpulse-test-pg-eus2` in `purpulse-test-rg`).

### Prerequisites

- Firewall: your IP or Azure VM allowed to connect to the server.
- Connection string from Key Vault or `DATABASE_URL` pattern on `purpulse-test-api-eus2` (never commit secrets).
- PostgreSQL 13+ (`gen_random_uuid()` built-in) — Azure Flexible Server 16 meets this.

### Apply (example)

```bash
# Set PGHOST, PGUSER, PGDATABASE, PGPASSWORD from your secret store (not shown here)
psql "host=$PGHOST port=5432 dbname=$PGDATABASE user=$PGUSER sslmode=require" \
  -f scripts/sql/001_create_technicians_and_assignments.sql
```

### Verify

```sql
\dt technicians
\dt fieldnation_mapping
\dt job_assignments
\dt webhook_idempotency
\d job_assignments
```

### `002_technicians_first_last_name.sql`

Run on databases that already applied an older `001` without `first_name` / `last_name` on `technicians`. Idempotent `ADD COLUMN IF NOT EXISTS`.

### `003_technicians_entra_hybrid.sql`

Adds **`entra_object_id`**, **`entra_invite_sent_at`**, **`entra_invite_last_error`** for Graph invitation tracking (hybrid technician flow). Idempotent.

Rollback is not automated; take a backup or snapshot before applying in shared environments.

## Example seeds

[`examples/README.md`](examples/README.md) — Azure CLI firewall + `psql` to load a sample technician + Field Nation mapping (e.g. PurTeraIT Provider1).
