# Technician Auto-Provisioning Guide
**PurPulse by Purtera-IT — Base44 ↔ Azure Postgres sync**

---

## The Problem

Technicians who sign in with Microsoft Entra see **"Request access"** because Base44 app membership is managed separately from `public.technicians` in your Postgres database. This guide closes that gap entirely — no human needs to click "approve" for a known technician.

---

## Recommended Architecture (Two-Part Solution)

We recommend combining **both** options below. Together they cover 100% of your use cases:

| Concern | Solution |
|---|---|
| Bulk sync of existing technicians | Azure Function → `provisionTechnician` Base44 function |
| New technicians at hire / daily delta | Same function called from your reconciliation pipeline |
| Workspace-level Entra SSO (no invite at all) | Base44 Enterprise SSO with domain allowlist |

---

## Option A — Workspace Entra SSO (Zero-Invite for @purtera.com)

> **Recommended first step. Eliminates the provisioning problem for your domain entirely.**

If all your technicians use `@purtera.com` (or a set of known domains), you can configure Base44 workspace-level SSO with Microsoft Entra. Once set up:
- Any user who authenticates via Entra with your domain is **automatically added** to the workspace as a Viewer.
- No invite, no approval, no custom code needed for standard technician sign-on.

### Setup Steps

1. In **Azure Portal** → App registrations → New registration:
   - Name: `PurPulse Base44`
   - Redirect URI (Web): `https://app.base44.com/api/workspaces/{YOUR_WORKSPACE_ID}/auth/sso/callback`
   - Note the **Client ID** and **Tenant ID**
   - Under "Certificates & secrets" → New client secret → copy the value

2. In **Base44 Dashboard** → Profile icon → Settings → Auth and security:
   - Enable **Single Sign-On Configuration**
   - Fill in:
     - **Client ID**: from Azure
     - **Client Secret**: from Azure
     - **Directory (Tenant) ID**: from Azure
     - **Scope**: `openid email profile`
     - **Discovery URL**: `https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid-configuration`
   - Click **Enable SSO**

3. In **Base44 Dashboard** → App Settings → verify your domain (`purtera.com`) so Base44 enforces domain-based access.

> Once done, `jane.smith@purtera.com` who has never used Base44 can open the PurPulse URL, click "Sign in with Microsoft", and land directly in the app. **No "Request access" screen.**

---

## Option B — Programmatic Invite via Azure Function (Per-Event or Scheduled)

For technicians whose emails don't match your SSO domain, or for cases where you want to pre-provision from Postgres before a technician ever signs in, use the Base44 `provisionTechnician` backend function (already deployed in this repo).

### 1. Set the shared secret

In **Base44 Dashboard → Code → Environment Variables**, add:

```
PROVISION_SECRET = <a strong random secret, e.g. from `openssl rand -hex 32`>
```

Store the same value in **Azure Key Vault** and reference it from your Azure Function App settings.

### 2. Call the function from Azure

The function endpoint is:
```
POST https://{your-base44-app-url}/api/functions/provisionTechnician
Authorization: Bearer {PROVISION_SECRET}
Content-Type: application/json
```

**Request body:**
```json
{
  "technicians": [
    { "email": "jane.smith@purtera.com", "role": "user" },
    { "email": "bob.jones@purtera.com",  "role": "user" }
  ]
}
```

**Response:**
```json
{
  "processed": 2,
  "invited": 1,
  "already_member": 1,
  "errors": 0,
  "results": [
    { "email": "jane.smith@purtera.com", "status": "invited" },
    { "email": "bob.jones@purtera.com",  "status": "already_member" }
  ]
}
```

### 3. Sample Azure Function (Node.js / TypeScript)

```typescript
// azure-functions/syncTechnicians/index.ts
import { AzureFunction, Context } from "@azure/functions";
import { Pool } from "pg";

const PROVISION_ENDPOINT = process.env.BASE44_PROVISION_ENDPOINT!;
const PROVISION_SECRET   = process.env.BASE44_PROVISION_SECRET!;   // from Key Vault
const PG_CONNECTION      = process.env.POSTGRES_CONNECTION_STRING!;

const timerTrigger: AzureFunction = async (context: Context): Promise<void> => {
  const pool = new Pool({ connectionString: PG_CONNECTION, ssl: { rejectUnauthorized: false } });

  try {
    // Fetch all active technicians from Postgres
    const { rows } = await pool.query(`
      SELECT email
      FROM   public.technicians
      WHERE  status = 'active'
        AND  email IS NOT NULL
        AND  email <> ''
      ORDER  BY updated_at DESC
    `);

    // Chunk into batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map(r => ({
        email: r.email.toLowerCase().trim(),
        role:  "user"
      }));

      const response = await fetch(PROVISION_ENDPOINT, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${PROVISION_SECRET}`,
        },
        body: JSON.stringify({ technicians: batch }),
      });

      const result = await response.json();
      context.log("Batch provisioned:", result);

      // Log errors to Application Insights / your audit table
      for (const r of result.results) {
        if (r.status === "error") {
          context.log.error(`Provision failed for ${r.email}: ${r.error}`);
        }
      }

      // Throttle between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    await pool.end();
  }
};

export default timerTrigger;
```

**function.json** (run every 6 hours):
```json
{
  "bindings": [
    {
      "name": "myTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 0 */6 * * *"
    }
  ]
}
```

### 4. Trigger on DB change (event-driven alternative)

Instead of polling, trigger the function from your existing Field Nation reconciliation pipeline when a row in `public.technicians` is inserted or its `status` changes to `active`:

```sql
-- Postgres trigger example
CREATE OR REPLACE FUNCTION notify_technician_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('technician_change', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_technician_upsert
AFTER INSERT OR UPDATE OF status, email ON public.technicians
FOR EACH ROW EXECUTE FUNCTION notify_technician_change();
```

Then have a lightweight listener (Azure Function with Postgres listener or Supabase Edge Function) that calls the `provisionTechnician` endpoint for each changed row.

---

## Security Checklist

- [ ] `PROVISION_SECRET` is never in source code — only in Azure Key Vault + Base44 env vars
- [ ] The Base44 function validates the secret on every request (already implemented)
- [ ] Azure Function runs as a Managed Identity with Key Vault read access
- [ ] TLS enforced on all calls (Base44 functions are always HTTPS)
- [ ] Provisioning calls are logged in Base44 function logs + your Azure audit table
- [ ] Re-processing the same email is safe (idempotent — `already_member` is not an error)

---

## Idempotency & Rate Limits

| Concern | Behaviour |
|---|---|
| Same email sent twice | Returns `already_member` — no duplicate invite, no spam |
| User already signed up | Same as above |
| Max per call | 100 technicians |
| Recommended batch size | 50 per call, 500ms between batches |
| Base44 rate limit | ~120ms delay between invites is built into the function |

---

## Answers to Your Specific Questions

**Q: Official mechanism to add users by email?**
`base44.asServiceRole.auth.inviteUser(email, role)` — available in backend functions. Already implemented in `functions/provisionTechnician`.

**Q: Domain allowlist / tenant settings?**
Yes — Base44 Enterprise SSO with Entra auto-joins anyone from your domain. See Option A above. This is the cleanest solution for `@purtera.com` accounts.

**Q: SSO / Entra auto-join?**
Covered by Option A. After SSO is configured, any Entra-authenticated `@purtera.com` user who visits the app URL is automatically provisioned. No invite needed.

**Q: Rate limits for hundreds of technicians?**
Process in batches of 50, with 500ms between batches. The function enforces 120ms between individual invites. A full sync of 500 technicians takes ~90 seconds — run it as a scheduled job, not on every page load.

---

## Email Claim Alignment (Entra ↔ Postgres)

Base44 uses the `email` claim from the OIDC token. Microsoft Entra emits the UPN or preferred email. Ensure:

```
technicians.email  ==  Entra UPN  ==  Base44 user.email
```

Your existing `GET /api/me` already validates this. As long as Field Nation and internal IDs map to the same email, the chain is consistent.

---

## Acceptance Criteria Validation

| Criteria | Met by |
|---|---|
| Technician in Postgres → auto-provisioned | Option B (Azure Function → provisionTechnician) |
| No human approval needed | `inviteUser()` bypasses "Request access" |
| `@purtera.com` users sign in without invite | Option A (Entra SSO domain allowlist) |
| Unknown emails still get "Request access" | Default Base44 behaviour — unchanged |
| Idempotent | Already implemented — `already_member` response |
| Audit trail | Function returns per-email status; Azure Function logs to App Insights |
| Secrets in Key Vault | `PROVISION_SECRET` pattern — never in code |