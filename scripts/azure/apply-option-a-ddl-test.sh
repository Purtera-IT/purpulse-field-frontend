#!/usr/bin/env bash
# Apply Option A DDL (001 → 002 → 003) to Azure Database for PostgreSQL Flexible Server (test).
# Prerequisites:
#   - Firewall allows your IP (see scripts/azure/README.md).
#   - export PGPASSWORD='<purpulseadmin password>' OR use connection from Key Vault database-url.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

PGHOST="${PGHOST:-purpulse-test-pg-eus2.postgres.database.azure.com}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-purpulseadmin@purpulse-test-pg-eus2}"
PGDATABASE="${PGDATABASE:-purpulse_app}"
export PGSSLMODE="${PGSSLMODE:-require}"

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "Set PGPASSWORD to the Postgres admin password, then re-run." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/001_create_technicians_and_assignments.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/002_technicians_first_last_name.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/003_technicians_entra_hybrid.sql"
echo "OK: applied 001, 002, 003 to $PGDATABASE@$PGHOST"
