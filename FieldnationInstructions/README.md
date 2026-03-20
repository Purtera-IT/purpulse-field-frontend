# Field Nation API – Work Orders

Instructions for the Field Nation Client API (REST v2) work order endpoints. Use with **Sandbox** (`https://api.sandbox.fieldnation.com`) or **Production** (`https://api.fieldnation.com`).

## Contents

| Document | Description |
|----------|-------------|
| [Overview](overview.md) | Core concepts, lifecycle (Draft → Publish → Route → Assigned → Complete → Approve), and prerequisites |
| [Create](create.md) | `POST /workorders` – payload structure, location, schedule, pay, and examples |
| [Search](search.md) | `GET /workorders` – lists, filters, pagination, sorting, and sticky behavior |
| [Operations](operations.md) | `PUT /workorders/{id}` (update), `DELETE /workorders/{id}` (cancel), `GET /workorders/{id}` (details) |

## Quick reference

- **Base URL (Sandbox):** `https://api.sandbox.fieldnation.com/api/rest/v2`
- **Auth:** `Authorization: Bearer <access_token>` (OAuth2)
- **Create:** `POST /workorders` with JSON body (title, types_of_work, location, schedule, pay)
- **Search:** `GET /workorders?list=workorders_all&sticky=false` (always set `list` and `sticky=false` in integrations)
