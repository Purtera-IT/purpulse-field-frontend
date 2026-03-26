# Option A — smoke tests (after backend deploy)

Run against **test** only. Replace `$TOKEN` with a valid JWT for an API user.

## Assignments endpoint

```bash
export BASE=https://api-test.purpulse.app
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/assignments?assigned_to=00000000-0000-0000-0000-000000000000"
```

Expect **200** and JSON `{"assignments":[]}` or populated list.

## Webhook (synthetic)

Only after the handler is deployed and FN secret is configured:

```bash
curl -sS -X POST "$BASE/api/webhooks/fieldnation" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -H "X-FN-Signature: <valid-signature>" \
  -d '{"event_type":"work_order.accepted","provider_id":"test-fn-1","work_order_id":"wo-1","job_external_id":"EXT-1"}'
```

Expect **200** on success; repeat with same idempotency key → duplicate handling.

## Telemetry (field app)

With `VITE_TELEMETRY_INGESTION_URL` set in the test build, open the app, trigger a canonical event, and confirm **200/202** in browser Network tab or Application Insights for the ingestion request.
