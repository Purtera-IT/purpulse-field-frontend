# Field Nation webhook handler (pseudocode)

**Purpose:** Idempotent processing when a technician **accepts** a work order in Field Nation (or equivalent lifecycle event). Adjust event names and payload shapes to **Field Nation’s actual webhook contract** (this is illustrative).

---

## 1. Incoming request (example)

```http
POST /api/webhooks/fieldnation
Content-Type: application/json
X-FN-Signature: sha256=<64-char hex HMAC-SHA256 of raw body using webhook secret>
X-FN-Delivery-Id: <uuid:attempt>   (Field Nation idempotency; preferred)
X-FN-Webhook-Id: <uuid>
```

**Example JSON body (fictional shape):**

```json
{
  "event_type": "work_order.accepted",
  "occurred_at": "2026-03-25T18:00:00Z",
  "provider_id": "fn-provider-12345",
  "work_order_id": "wo-999",
  "job_external_id": "EXT-1234",
  "metadata": {}
}
```

**Signature:** Implementations should match [`shared/fieldnationSignature.js`](../backend/azure-functions-option-a/shared/fieldnationSignature.js) (same algorithm as [Field Nation DX](https://developer.fieldnation.com/docs/webhooks/concepts/payload-structure/)). The webhook secret in Azure must match the secret on the Field Nation webhook definition.

**Provisioning / Entra invite:** The deployed Function in [`examples/backend/azure-functions-option-a/functions/fieldnationWebhook/`](../backend/azure-functions-option-a/functions/fieldnationWebhook/index.js) posts to **`USER_PROVISIONING_WEBHOOK_URL`** only when the normalized event (`event.name`, `event_type`, `event`, or `type`) matches **`USER_PROVISIONING_EVENT_TYPES`** (defaults include acceptance/assignment-style names). Ensure your real Field Nation payloads match the allowlist so invites run **only** on the intended lifecycle events.

---

## 2. Handler pseudocode

```
function handleFieldNationWebhook(request):
  rawBody = readRawBody(request)

  // A) Signature validation (required in production)
  if not verifyFieldNationSignature(request.headers, rawBody):
    return 401

  // B) Parse JSON
  payload = JSON.parse(rawBody)
  idemKey = request.headers['X-FN-Delivery-Id'] or request.headers['X-Idempotency-Key'] or hash(payload)
  if idempotencyRecordExists(idemKey):
    return 200 { "status": "duplicate_ignored" }

  // C) Transaction
  BEGIN TRANSACTION
    insert into webhook_idempotency (idempotency_key, payload_hash) values (idemKey, sha256(rawBody))

    providerId = payload.provider_id
    tech = select from fieldnation_mapping where fieldnation_provider_id = providerId
    if tech is null:
      // Provision path: create technicians row + mapping (or enqueue async job)
      internalId = provisionTechnicianIfNeeded(providerId, payload)
    else:
      internalId = tech.internal_technician_id

    // Resolve job by external id / WO id — domain-specific
    jobId = resolveJobId(payload.work_order_id, payload.job_external_id)
    if jobId is null:
      ROLLBACK; return 404

    update jobs / job_assignments set
      assigned_to_internal_technician_id = internalId,
      runbook_version = <from provisioning template>,
      runbook_json = <from template or FN payload>,
      evidence_requirements = <derived>,
      updated_at = now()
    where id = jobId

    // Optional: enqueue notification / SignalR / queue for mobile push
  COMMIT

  // D) Optional: emit internal event to same pipeline as canonical ingestion (out of scope for field app)
  // emitAssignmentEvent({ job_id, technician_id: internalId, ... })

  return 200 { "status": "ok", "job_id": jobId, "technician_id": internalId }
```

---

## 3. Failure modes

| Case | Response |
|------|----------|
| Bad signature | 401 |
| Unknown job | 404 + log (do not retry blindly) |
| Duplicate idempotency key | 200 with `duplicate_ignored` |
| DB error | 500; provider retries per their policy |

---

## 4. Security checklist

- [ ] HMAC or mTLS per Field Nation docs  
- [ ] Constant-time signature compare  
- [ ] Rate limiting per IP / provider  
- [ ] Payload size cap  
- [ ] No PII logged in clear  
