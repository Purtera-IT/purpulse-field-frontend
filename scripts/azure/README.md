# Azure CLI — hybrid Entra + Option A

## Applied from this repo (example: test subscription)

| Action | Command / result |
|--------|------------------|
| **Function App `ENTRA_TENANT_ID`** | Set to directory tenant `f793fa28-2504-447d-893e-f314c51c54de` on **`purpulse-test-api-eus2`**. |
| **Postgres firewall** | Rule allowing current public IP (e.g. `cli-hybrid-*`) on **`purpulse-test-pg-eus2`** so `psql` can run from your workstation. |
| **Key Vault RBAC** | **`Key Vault Secrets User`** assigned to **`max@purtera-it.com`** on vault **`purpulse-test-kv-5il53d`** (scope: vault resource). Propagation can take **~1–5 minutes** before `az keyvault secret list` works. |

## You must complete locally (secrets)

1. **`ENTRA_AUDIENCE`** (or `AZURE_API_AUDIENCE`) — API application ID URI / `aud` claim your SPA requests (e.g. `api://<api-app-id>`). Add when the protected API app is defined:

   ```bash
   az functionapp config appsettings set -g purpulse-test-rg -n purpulse-test-api-eus2 \
     --settings ENTRA_AUDIENCE="api://<your-api-app-id>"
   ```

2. **Option A DDL** — run [`apply-option-a-ddl-test.sh`](apply-option-a-ddl-test.sh) (applies **`001`**, **`002`**, **`003`**) with **`PGPASSWORD`** set to the Flexible Server admin password (`purpulseadmin`), or run `psql` with your app connection string. If the DB already has **`001`**, you can run only [`apply-migration-003-test.sh`](apply-migration-003-test.sh) for **`003`** upgrades.

3. **`FIELDNATION_WEBHOOK_SECRET`** (or `FN_WEBHOOK_SECRET`) on the Function App must **match** the secret on the Field Nation webhook definition; verification uses **`X-FN-Signature: sha256=<hex>`** over the **raw** body ([Field Nation docs](https://developer.fieldnation.com/docs/webhooks/concepts/payload-structure/)). Misaligned secrets or parsing JSON before HMAC causes **401**.

4. **Key Vault** — with **Secrets User**, fetch app DB URL for local tooling (secret name **`database-url`**):

   ```bash
   az keyvault secret show --vault-name purpulse-test-kv-5il53d --name database-url --query value -o tsv
   ```

   Use as **`DATABASE_URL`** / **`PGPASSWORD`** parsing as needed for `psql` (do not commit or log the value).

5. **Deploy Function code** — zip/deploy from [`examples/backend/azure-functions-option-a`](../../examples/backend/azure-functions-option-a) after `npm install` (includes **`jose`**).

6. **`USER_PROVISIONING_WEBHOOK_URL`** — set when your Entra invite handler URL is live.

## Scripts

- [`verify-purpulse-api-host.sh`](verify-purpulse-api-host.sh) — **Azure CLI** checks for test/prod Function Apps: `DATABASE_URL`, proxy `invokeUrlTemplate`, `GET /api/me` vs `GET /api/data/...`. Run `npm run verify:azure-api-host` (requires `az login`). Args: `test`, `prod`, or default `all`.
- [`apply-option-a-ddl-test.sh`](apply-option-a-ddl-test.sh) — `psql` **`001`**, **`002`**, **`003`** against **`purpulse_app`** on test Postgres (greenfield).
- [`apply-migration-003-test.sh`](apply-migration-003-test.sh) — `psql` **`003_technicians_entra_hybrid.sql`** only (existing DBs that already have **`001`**).
