# Assignment & technician API examples (draft)

**Base URL:** `https://api-test.purpulse.app` (test) or `https://api.purpulse.app` (prod) — confirm with `docs/azure/REPO_TO_AZURE_DISCOVERY.md`.

**Auth:** `Authorization: Bearer <JWT>` (same as field app / `AUTH_JWT_SECRET` issuer on Functions).

Values in bodies are **illustrative**.

---

## 1. `POST /api/webhooks/fieldnation`

Idempotent webhook (see `examples/webhooks/fieldnation_webhook_handler.md`). **`X-FN-Signature`** must be `sha256=` + HMAC-SHA256(webhook_secret, **exact raw body bytes**).

```bash
curl -sS -X POST "$BASE/api/webhooks/fieldnation" \
  -H "Content-Type: application/json" \
  -H "X-FN-Delivery-Id: $(uuidgen):1" \
  -H "X-FN-Signature: <signature>" \
  -d '{"event_type":"work_order.accepted","provider_id":"fn-1","work_order_id":"wo-1","job_external_id":"EXT-1"}'
```

**200 example:**

```json
{ "status": "ok", "job_id": "job-uuid", "technician_id": "uuid-internal" }
```

---

## 2. `GET /api/me`

Resolves the Bearer token to a `technicians` row (`idp_subject` or email). Use **`internal_technician_id`** with `GET /api/assignments`.

```bash
curl -sS "$BASE/api/me" \
  -H "Authorization: Bearer $TOKEN"
```

**200 example:**

```json
{
  "internal_technician_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "tech@example.com",
  "first_name": "Pat",
  "last_name": "Smith",
  "display_name": "Pat Smith",
  "fieldnation_provider_id": "fn-provider-12345"
}
```

**404:** no row yet (e.g. Field Nation webhook has not created the technician).

---

## 3. `POST /api/technicians` (optional provisioning helper)

Creates internal technician + optional IdP invite (implementation-specific).

```bash
curl -sS -X POST "$BASE/api/technicians" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"tech@example.com","display_name":"A. Tech","idp_subject":"oid-from-b2c"}'
```

**201 example:**

```json
{ "id": "550e8400-e29b-41d4-a716-446655440000", "email": "tech@example.com", "status": "active" }
```

---

## 4. `GET /api/assignments?assigned_to={internal_technician_id}`

Returns jobs assigned to the technician, including runbook payload for the field app.

```bash
curl -sS "$BASE/api/assignments?assigned_to=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

**200 example:**

```json
{
  "assignments": [
    {
      "job_id": "job-uuid-1",
      "title": "Site survey",
      "scheduled_date": "2026-03-26",
      "runbook_version": "2026.03.1",
      "runbook_json": { "phases": [] },
      "evidence_requirements": []
    }
  ]
}
```

---

## 5. `GET /api/jobs/{job_id}`

Existing or unified job detail (field app today uses Base44 `Job.filter` — this route would be the **REST** mirror).

```bash
curl -sS "$BASE/api/jobs/job-uuid-1" \
  -H "Authorization: Bearer $TOKEN"
```

**200:** Full job DTO including `assigned_to_internal_technician_id`, `runbook_json`, `evidence_requirements` when implemented.

---

## 6. Notes

- Route prefixes (`/api` vs `/api/v1`) must match deployed Function routes.
- Field app **Vite** build must include `VITE_AZURE_API_BASE_URL` (or App Config) pointing at this host for any new `fetch` wrappers you add alongside Base44.
