# purpulseAssignmentsProxy

Forwards technician calls to PurPulse Azure API so the **SPA does not need `VITE_AZURE_API_BASE_URL` at build time** (Base44 Secrets are server-only).

## Secrets (Base44)

| Name | Example |
|------|---------|
| `PURPULSE_API_BASE_URL` | `https://api-test.purpulse.app` |
| or `AZURE_API_BASE_URL` | same |

## Routes (after Base44 maps the function)

- `GET .../me` → upstream `GET {base}/api/me`
- `GET .../assignments?assigned_to=...` → upstream `GET {base}/api/assignments?...`

The browser sends `Authorization: Bearer <Entra or API token>`; this handler forwards it unchanged.

## Frontend

Set **`VITE_USE_ASSIGNMENTS_API=true`**, **`VITE_USE_PURPULSE_ASSIGNMENTS_PROXY=true`**, and optionally **`VITE_PURPULSE_PROXY_PATH`** if your deployed path differs from `/mock/api/purpulse`.

Do **not** rely on `VITE_AZURE_API_BASE_URL` in the client when using proxy mode.
