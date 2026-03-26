# Example SQL seeds

## PurTeraIT Provider1 (`seed_purterait_provider1.sql`)

Upserts **`technicians`** + **`fieldnation_mapping`** for:

| Field | Value |
|-------|--------|
| Field Nation provider id | `931914` |
| Email | `max@purtera-it.com` (must match Entra account used in the field app) |
| Name | PurTeraIT / Provider1 (display: PurTeraIT Provider1) |
| Phone / location | In `metadata` JSON |

Apply **after** [`001_create_technicians_and_assignments.sql`](../001_create_technicians_and_assignments.sql) (and [`002`](../002_technicians_first_last_name.sql) if needed).

---

## Azure CLI + `psql` (recommended)

**Azure CLI does not execute arbitrary PostgreSQL `INSERT` statements.** Use CLI to open the network path and read server details, then run SQL with **`psql`** (included in [Azure Cloud Shell](https://shell.azure.com/) and most dev machines).

### 1) Allow your current public IP on the Flexible Server firewall

Replace resource group and server name if yours differ (`purpulse-test-rg`, `purpulse-test-pg-eus2`).

```bash
export PG_RG=purpulse-test-rg
export PG_SERVER=purpulse-test-pg-eus2
MYIP=$(curl -sSf https://api.ipify.org)

az postgres flexible-server firewall-rule create \
  --resource-group "$PG_RG" \
  --name "$PG_SERVER" \
  --rule-name "seed-from-$(whoami)-$(date +%Y%m%d)" \
  --start-ip-address "$MYIP" \
  --end-ip-address "$MYIP"
```

### 2) Server FQDN and admin login name

```bash
az postgres flexible-server show \
  --resource-group "$PG_RG" \
  --name "$PG_SERVER" \
  --query fullyQualifiedDomainName -o tsv
```

Admin user is usually **`adminuser@PG_SERVER`** (the value you chose at server create). Database name is often **`postgres`** or your app database.

### 3) Run the seed (from repo root)

Set password via env (from Key Vault or your password manager — **do not commit**):

```bash
export PGHOST="<fqdn-from-step-2>"
export PGPORT=5432
export PGDATABASE="<your-db-name>"
export PGUSER="<admin-or-app-user>@<PG_SERVER>"
export PGPASSWORD="<secret>"

psql "sslmode=require host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER" \
  -f scripts/sql/examples/seed_purterait_provider1.sql
```

Optional: pull connection string from Key Vault (name varies):

```bash
az keyvault secret show --vault-name <your-kv> --name PG_CONN --query value -o tsv
# Then parse host/user/db or use the full URI with psql if it is a postgres:// URL
```

### 4) Remove the firewall rule when done (least exposure)

```bash
az postgres flexible-server firewall-rule delete \
  --resource-group "$PG_RG" \
  --name "$PG_SERVER" \
  --rule-name "seed-from-<same-name-as-create>"
```

---

## Alternative: Azure Cloud Shell

Open Cloud Shell → **Upload** `seed_purterait_provider1.sql` → run `psql` with the same env vars as above.
