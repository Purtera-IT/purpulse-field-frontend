# Field Nation webhook blobs — test vs prod storage

When validating **Field Nation → Azure** ingestion, **always check the same storage account** the Function App uses for raw webhook archives. **Test** and **prod** use different accounts; comparing only one account can make two true statements look contradictory.

## Accounts and container

| Environment | Resource group | Storage account (example) | Blob container |
|-------------|----------------|----------------------------|----------------|
| Test | `purpulse-test-rg` | `purpulseteststg5il53d` | `webhooks` |
| Prod | `purpulse-prod-rg` | `purpulseprodstgbsscy6` | `webhooks` |

Confirm the **live** setting on each Function App (`AzureWebJobsStorage` / `WEBHOOK_*` / app-specific vars) if names change.

## What to expect (typical)

- **Test** `webhooks` often contains **only** synthetic payloads posted with **curl** (e.g. `workorder.requested` for a sandbox work order id) while integrations are exercised.
- **Prod** `webhooks` should receive **real** Field Nation deliveries (`User-Agent` **FN-Webhook/1**), including lifecycle events such as **`workorder.task_completed`** and assignment context for live work orders.

Do **not** infer prod behavior from test blobs alone, or vice versa.

## Representative snapshot (manual verification)

The following table was produced by listing **unique payload hashes** in each account’s `webhooks` container and parsing `body_json` (dates as recorded at verification time).

| Account | `event.name` (sample) | `workorder.id` | Notes |
|---------|----------------------|----------------|--------|
| Test | `workorder.requested` | 931914 | Synthetic curl validation |
| Prod | `workorder.task_completed` | 92022 | Assigned / provider context (FN delivery) |
| Prod | `workorder.requested` / `workorder.status.assigned` | 931914 | Mix of curl tests and validation |
| Prod | `workorder.created` | other ids | Draft work orders |

Re-run verification after any change to webhook routing or retention policies.

## Quick CLI check (no secrets in tickets)

Use an account that can read storage keys or has **Storage Blob Data Reader** + `--auth-mode login`:

```bash
# List blobs (example — test)
az storage blob list \
  --container-name webhooks \
  --account-name purpulseteststg5il53d \
  --account-key "<from Key Vault or az storage account keys list>" \
  -o table

# Repeat for prod with purpulseprodstgbsscy6
```

Download a blob and inspect `body_json` and `headers` for `user-agent` and event shape.

## See also

- [`option-a-azure-ops-playbook.md`](option-a-azure-ops-playbook.md) — Field Nation webhook URL and secrets
- [`examples/webhooks/fieldnation_webhook_handler.md`](../../examples/webhooks/fieldnation_webhook_handler.md) — payload shape and security notes
