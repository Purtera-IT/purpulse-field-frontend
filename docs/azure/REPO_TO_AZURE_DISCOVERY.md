# Repository ↔ Azure discovery (audit)

**Generated:** subscription context from `az account show` at audit time.  
**Scope:** Purpulse-related resources in the default subscription; **no secret values** are recorded here. App settings list **key names only**.

---

## 1. Azure account / subscription

| Field | Value |
|--------|--------|
| Subscription name | Azure subscription 1 |
| Subscription ID | `cd493e42-9cd6-4849-975a-3fbeb7fd93d1` |
| Tenant | PurTera IT (`purtera-it.com`) |
| Cloud | AzureCloud |

Other subscriptions exist (e.g. MCPP); discovery used the **default** subscription only.

---

## 2. Resource groups (Purpulse / PurTera–related)

| Resource group | Region | Notes |
|----------------|--------|--------|
| `purpulse-prod-rg` | East US 2 | Prod Purpulse stack |
| `purpulse-test-rg` | East US 2 | Test Purpulse stack |
| `purtera-dev-rg` | East US 2 | Dev API + Postgres |
| `purpulse-ml-rg` | East US 2 | Container Apps (ML) |
| `purtera-dev`, `purtera-staging`, `purtera-production` | East US | Other PurTera workloads (not all enumerated below) |
| `rg-purtera-frames-staging`, `rg-purtera-frontdoor-staging` | East US | Frames / front door |
| `DefaultResourceGroup-EUS2` | East US 2 | Default workspace group |

---

## 3. Discovered resources (summary table)

| Resource group | Name | Type / service | Notes |
|----------------|------|------------------|--------|
| `purpulse-prod-rg` | `purpulse-prod-app-eus2` | Web App (Static Web App host name pattern) | Canada Central, Vite field UI |
| `purpulse-test-rg` | `purpulse-test-app-eus2` | Web App | Canada Central |
| `purpulse-prod-rg` | `purpulse-prod-api-eus2` | Function App | Likely primary HTTPS API (`api.purpulse.app` per App Config) |
| `purpulse-test-rg` | `purpulse-test-api-eus2` | Function App | Test API |
| `purtera-dev-rg` | `purpulse-dev-api-eus2` | Function App | Dev API; **Field Nation** and ML-related app setting **names** present |
| `purpulse-ml-rg` | `techpulse-ml` | Container App | ML inference; env references `TECHPULSE_ML_*` only (names below) |
| `purpulse-prod-rg` | `purpulse-prod-pg-eus2` | PostgreSQL Flexible Server | Version **16**, Burstable B1ms |
| `purpulse-test-rg` | `purpulse-test-pg-eus2` | PostgreSQL Flexible Server | Version **16** |
| `purtera-dev-rg` | `purpulse-dev-pg-eus2` | PostgreSQL Flexible Server | Version **17** |
| `purpulse-prod-rg` | `purpulseprodstgbsscy6` | Storage account | Blob containers listed separately |
| `purpulse-test-rg` | `purpulseteststg5il53d` | Storage account | — |
| `purtera-dev-rg` | `purpulsedevstg01`, `purpulselineage12238` | Storage accounts | — |
| `purpulse-prod-rg` | `purpulse-prod-appi-eus2` | Application Insights | Component resource |
| `purpulse-test-rg` | `purpulse-test-appi-eus2` | Application Insights | — |
| `purtera-dev-rg` | `purpulse-dev-api-eus2` | Application Insights | Same name as dev function app (linked component) |
| `purpulse-prod-rg` | `purpulse-prod-law-eus2` | Log Analytics workspace | — |
| `purpulse-test-rg` | `purpulse-test-law-eus2` | Log Analytics workspace | — |
| `purpulse-ml-rg` | `workspace-purpulsemlrgySi9` | Log Analytics workspace | ML workspace |
| `purpulse-prod-rg` | `purpulse-prod-appcs-bsscy6` | App Configuration | Standard SKU |
| `purpulse-test-rg` | `purpulse-test-appcs-5il53d` | App Configuration | Standard SKU |
| `purpulse-prod-rg` | `purpulse-prod-kv-bsscy6` | Key Vault | **Secret metadata list failed** (RBAC — see §8) |
| `purpulse-test-rg` | `purpulse-test-kv-5il53d` | Key Vault | Same |

**Not present in this subscription (count = 0):**

- Event Hubs namespaces (`az eventhubs namespace list`)
- Service Bus namespaces (`az servicebus namespace list`)

---

## 4. App settings — **key names only** (values not stored)

### 4.1 Function apps

**`purpulse-prod-api-eus2`** (`purpulse-prod-rg`) — keys include:

`APPINSIGHTS_INSTRUMENTATIONKEY`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `AUTH_JWT_SECRET`, `AZURE_APPCONFIG_ENDPOINT`, `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_CONNECTION_STRING`, `AzureWebJobsStorage`, `DATABASE_URL`, `DEPLOY_HEALTH_SMOKE_KEY`, `ENABLE_ORYX_BUILD`, `FIREFLIES_API_KEY`, `FUNCTIONS_EXTENSION_VERSION`, `FUNCTIONS_WORKER_RUNTIME`, `HUBSPOT_ACCESS_TOKEN`, `KEY_VAULT_URI`, `OLLAMA_EMBED_AUTH_TOKEN`, `OLLAMA_EXTRACT_AUTH_TOKEN`, `RESEND_FROM_EMAIL`, `SCM_COMMAND_IDLE_TIMEOUT`, `SCM_DO_BUILD_DURING_DEPLOYMENT`, `VITE_DATA_BACKEND`, `WEBSITE_*` (several), etc.

**`purpulse-test-api-eus2`** — same key **names** as prod (aligned set).

**`purpulse-dev-api-eus2`** (`purtera-dev-rg`) — additional / different keys include:

`FIELDNATION_*`, `FIELD_NATION_REST_API_KEY`, `TECHPULSE_ML_*`, `USE_ML_PIPELINE`, `OLLAMA_*`, storage container names, `VITE_ENV_NAME`, etc.

**Observation:** None of the function app setting **names** include `VITE_TELEMETRY_INGESTION_URL` or `TELEMETRY_INGESTION` — ingestion is expected to be an HTTP route on the API or a separate gateway, not necessarily a standalone Function name in this list.

### 4.2 Web apps (field UI)

**`purpulse-prod-app-eus2`** / **`purpulse-test-app-eus2`** — keys:

`NODE_ENV`, `VITE_AZURE_API_BASE_URL`, `VITE_DATA_BACKEND`, `VITE_ENV_NAME`

**Observation:** `VITE_TELEMETRY_INGESTION_URL` is **absent** from Azure Web App application settings. If required in production, it must be supplied at **build time** (pipeline) or added as an app setting and referenced by the build (verify deployment pipeline).

### 4.3 App Configuration (key **names**; values redacted here)

**Prod store** (`purpulse-prod-appcs-bsscy6`): keys include  
`ENDPOINT_PUBLIC_API`, `ENV_LABEL`, `VITE_AZURE_API_BASE_URL`, `VITE_DATA_BACKEND`, `VITE_ENABLE_FIELD_LINEAGE_OVERLAY`, `VITE_ENV_NAME`, plus feature-flag keys under `.appconfig.featureflag/*`.

**Test store** (`purpulse-test-appcs-5il53d`): same pattern.

**Observation:** `VITE_TELEMETRY_INGESTION_URL` was **not** among the first 50 keys returned by `az appconfig kv list --top 50`. Confirm in portal or list with label filters if ingestion URL must live in App Config.

### 4.4 Container App `techpulse-ml`

Environment variable **names** (from `show`): `TECHPULSE_ML_AUTH_TOKEN`, `TECHPULSE_ML_AUTH_TOKEN_VERSION` (values not recorded).

---

## 5. Storage (prod account sample)

**Account:** `purpulseprodstgbsscy6` — container **names** (sample):

`app-assets`, `azure-webjobs-hosts`, `azure-webjobs-secrets`, `ops-health`, `orbitbrief-artifacts`, `orbitbrief-models`, `webhooks-raw`

`webhooks-raw` is consistent with storing inbound webhook payloads for processing.

---

## 6. PostgreSQL (metadata only)

| Server | RG | Version | State |
|--------|-----|---------|--------|
| `purpulse-prod-pg-eus2` | `purpulse-prod-rg` | 16 | Ready |
| `purpulse-test-pg-eus2` | `purpulse-test-rg` | 16 | Ready |
| `purpulse-dev-pg-eus2` | `purtera-dev-rg` | 17 | Ready |

---

## 7. Deployment slots

`az webapp deployment slot list` for `purpulse-prod-app-eus2` and `purpulse-test-app-eus2` returned **no slots** (empty array). Staging may use separate resource groups (`purtera-staging`) or separate apps — confirm in portal if swap slots are required.

---

## 8. Key Vault

Listing secret **metadata** via `az keyvault secret list` returned **403 Forbidden** for the caller (RBAC). **Secret names** must be retrieved by a principal with `Microsoft.KeyVault/vaults/secrets/readMetadata/action` (e.g. Key Vault Secrets User). `KEY_VAULT_URI` is present on prod/test function apps — vaults exist but contents were not enumerated in this audit.

---

## 9. Inferences (non-binding)

| Topic | Inference |
|-------|-----------|
| Public API host | App Config keys `ENDPOINT_PUBLIC_API` / `VITE_AZURE_API_BASE_URL` point to `https://api.purpulse.app` (prod) and `https://api-test.purpulse.app` (test). **Likely** primary backend: **Function Apps** `purpulse-*-api-eus2`. |
| Telemetry ingestion POST | Repo expects `VITE_TELEMETRY_INGESTION_URL` → full URL for **single-event POST** (`src/api/telemetryIngestion.js`). Not visible in Web App settings or App Config top keys; **confirm** the deployed route (e.g. `/v1/telemetry/events` on the same API host) in API code or API Management. |
| Event Hubs / Service Bus | **None** in subscription — canonical queueing is likely **HTTP + Postgres pipeline** or internal to Functions, not EH/SB for this sub. |
| Field Nation | Dev function app exposes `FIELDNATION_*` settings; prod/test function apps did not list those key **names** in the same output — **confirm** whether FN integration is dev-only or also in prod via Key Vault / different slot. |

---

## 10. Repo expectations (Part B)

### 10.1 Telemetry ingestion

| Item | Detail |
|------|--------|
| Env var | `VITE_TELEMETRY_INGESTION_URL` — full URL to POST one canonical JSON envelope. |
| Behavior when unset | `sendCanonicalEnvelope` returns `{ ok: false, retryable: true, skipped: true, message: 'ingestion URL not configured' }` — **no network call**; IndexedDB queue retains events (`telemetryQueue.js`). |
| Auth | `Authorization: Bearer <access token>` from `authManager.getAccessToken()`. |

### 10.2 API client (`src/api/client.ts`)

- **Production path:** uses **Base44 SDK** (`base44.entities.*`) for jobs, evidence, technicians, time entries, etc. — not raw `https://api.purpulse.app/...` from this file’s axios instance in prod.
- **Development path:** axios `baseURL` `/api` with documented routes such as `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:jobId/evidence`.
- **Documented conceptual endpoints:** `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:jobId/evidence`, `GET /technicians` (via Base44), time entries / labels / meetings via entity filters.

There is **no** `GET /api/assignments` in the current client — runbook provisioning plan must add backend routes **and** client adoption.

### 10.3 Technician identity in envelopes

`src/lib/technicianId.js` — `getTechnicianIdForCanonicalEvents(user)`:

- Optional `VITE_DEV_TELEMETRY_TECHNICIAN_ID` override.
- Else `user.id`, `user.sub`, else deterministic `fieldapp:` + email fingerprint.

For **internal_technician_id** alignment, product should map IdP claims → stable UUID/string and optionally set `VITE_DEV_TELEMETRY_TECHNICIAN_ID` only in dev.

### 10.4 `jobRepository.ts`

Uses `apiClient.getJob` / caching — same expectations as `client.ts` (Base44 in prod).

### 10.5 Azure Functions sample (`src/azure-functions/processEvidence/`)

Sample references `BACKEND_API_URL` and `POST .../api/v1/evidence/{id}/process-result` — illustrative; verify against deployed API.

### 10.6 Mismatches / gaps

| Gap | Notes |
|-----|--------|
| `.env.example` | No glob match in repo for `.env.example` at audit time — recommend adding documented keys: `VITE_TELEMETRY_INGESTION_URL`, `VITE_AZURE_API_BASE_URL`, `VITE_DATA_BACKEND`, `VITE_ENV_NAME`, optional `VITE_DEV_TELEMETRY_TECHNICIAN_ID`. |
| Azure Web App settings | No `VITE_TELEMETRY_INGESTION_URL` in portal list — **must** be build-time or missing in deployed UI. |
| Assignments API | Not in client yet — planned in runbook provisioning plan. |

---

## Appendix A — CLI commands used

```bash
az account show -o json
az account list -o table
az group list -o table
az webapp list -o table
az functionapp list -o table
az containerapp list -o table
az postgres flexible-server list -o table
az storage account list -o table
az resource list --resource-type "Microsoft.Insights/components" -o table
az appconfig list -o table
az keyvault list -o table
az eventhubs namespace list -o table
az servicebus namespace list -o table
az monitor log-analytics workspace list -o table
az functionapp config appsettings list -g <RG> -n <NAME> -o json   # keys extracted with jq '[.[].name]'
az webapp config appsettings list -g <RG> -n <NAME> -o json
az containerapp show -g purpulse-ml-rg -n techpulse-ml -o json
az postgres flexible-server show -g <RG> -n <NAME> -o json
az storage container list --account-name purpulseprodstgbsscy6 --auth-mode login -o table
az webapp deployment slot list -g <RG> -n <WEBAPP> -o json
az appconfig kv list -n purpulse-prod-appcs-bsscy6 --top 50 -o table
# az keyvault secret list --vault-name <name>  → 403 for this principal
```

---

## Appendix B — Ambiguities

- Exact **telemetry POST path** on `api.purpulse.app` must be confirmed in backend repo or APIM, not only from this field app.
- **Field Nation** credentials: visible on dev function app; prod/test may use Key Vault references — portal check required.
- **Cross-subscription** resources (e.g. DNS, Front Door) may exist in other RGs (`rg-purtera-frontdoor-staging`).
