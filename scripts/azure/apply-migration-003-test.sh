#!/usr/bin/env bash
# Apply 003_technicians_entra_hybrid.sql to Azure Database for PostgreSQL Flexible Server (test).
# Prerequisites:
#   - Firewall allows your IP (see scripts/azure/README.md).
#   - export PGPASSWORD='<purpulseadmin password>'
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL_FILE="$ROOT/scripts/sql/003_technicians_entra_hybrid.sql"

PGHOST="${PGHOST:-purpulse-test-pg-eus2.postgres.database.azure.com}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-purpulseadmin@purpulse-test-pg-eus2}"
PGDATABASE="${PGDATABASE:-purpulse_app}"
export PGSSLMODE="${PGSSLMODE:-require}"

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "Set PGPASSWORD to the Postgres admin password, then re-run." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "OK: applied $SQL_FILE to $PGDATABASE@$PGHOST"
