# Update & Cancel

Beyond the happy-path workflow, you will need to manage details, updates, and cancellations.

## Updating Work Orders

You can update almost any field of a work order (Schedule, Scope, Pay) as long as it isn't in a "locked" state (like `Paid`).

```
PUT /workorders/{id}
```

Only send the fields you want to change (**Partial Update**).

```json
{
  "schedule": {
    "service_window": {
      "start": { "utc": "2023-12-01 10:00:00" }
    }
  }
}
```

### Updateable Fields

| Field | Description |
|-------|-------------|
| `title` | Work order title |
| `description` | Job description (`{ html: string }`) |
| `schedule` | Service window and timing |
| `require_ontime` | Require on-time arrival (Hard Start) |
| `pay` | Pay amount and type |
| `location` | Job location |
| `contacts` | Site contacts |
| `tasks` | Checklist tasks |
| `custom_fields` | Custom field values |
| `project` | Project assignment (`{ id: number }`) |
| `client` | Client tag (`{ id: number }`) |
| `manager` | Manager assignment (`{ id: number }`) |
| `allow_counter_offers` | Allow provider counter offers |
| `require_gps` | Require GPS check-in |

---

## Canceling Work Orders

To cancel a work order, use the DELETE method. You must provide a reason.

```
DELETE /workorders/{id}?cancel_reason=Duplicate
```

> **Fees**: Canceling a work order *after* a provider has been assigned and dispatched may incur a cancellation fee depending on platform rules.

---

## Get Work Order Details

Retrieve full details of a specific work order.

```
GET /workorders/{id}
```

### Response Includes

- Basic info (title, description, status)
- Location details
- Schedule and service window
- Pay structure
- Assigned provider
- Tasks, signatures, time logs
- Messages and attachments
