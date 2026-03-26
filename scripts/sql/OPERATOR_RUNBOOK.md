# Operator: apply SQL migrations (Postgres)

Run from a host allowed by the Azure Postgres firewall (your IP, jump box, or Cloud Shell).

```bash
# 003 — Entra hybrid columns (safe if columns already exist)
psql "$DATABASE_URL" -f scripts/sql/003_technicians_entra_hybrid.sql
```

Use the same connection string as **`DATABASE_URL`** / **`PG_CONN`** on the Function App (Key Vault reference or secret store).

After migration, deploy Function code that includes **`shared/verifyBearer.js`** and run **`npm install`** in the deployment package so **`jose`** is installed.
