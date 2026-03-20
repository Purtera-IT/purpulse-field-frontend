# Search & Filter Work Orders

`GET /workorders` is your main tool for retrieving work orders. Think of it like the Field Nation dashboard's search and filter panel — but as an API. You describe what you want using query parameters, and the API returns exactly that.

```http
GET /workorders
```

---

## How It Works

### Pick a List

A **list** scopes your results to a stage of the work order lifecycle — the same as clicking a tab in the Field Nation UI (e.g., "Assigned" or "Draft"). Each list pre-applies its own base filters, so you always start from the right context.

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_assigned" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Filters

Layer any number of `f_*` parameters to narrow results. Filters combine with AND logic — every filter you add further reduces the result set.

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_assigned&f_state=TX&f_service_schedule=2025-01-01,2025-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Paginate Through Results

Use `page` and `per_page` to work through large result sets. The response always tells you the total count and how many pages exist.

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&f_state=TX&page=2&per_page=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Lists

A list scopes your results to a specific stage of the work order lifecycle. Every request should include a `list` parameter — without it, the API may fall back to a previously saved state and return unexpected results.

| Value | Label | What's in it |
|-------|-------|--------------|
| `workorders_in_flight` | In-Flight | Active work orders that are underway or confirmed |
| `workorders_draft` | Draft | Unpublished work orders still being configured |
| `workorders_published_routed` | Published / Routed | Published or routed to providers, not yet assigned |
| `workorders_assigned` | Assigned | Work orders with a confirmed provider assignment |
| `workorders_problem` | Issue | Work orders with a reported problem |
| `workorders_work_done` | Done | Provider has marked the work complete |
| `workorders_approved` | Approved | You have approved the completed work |
| `workorders_all` | All | Every non-archived work order *(API default)* |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_assigned&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

> **Info:** Always pass `list` explicitly in your integration. If omitted, the API uses the last saved list from your account's sticky state, which can silently change the result set between requests.

---

## Keyword Search

Use `f_search` to run a free-form keyword search across multiple fields at once.

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&f_search=network+switch+installation&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Filters

All filter parameters are prefixed with `f_` and can be combined freely.

### Work Order

| Filter | Example |
|--------|---------|
| Work order IDs | `f_work_order_id=1001,1002,1003` |
| Template | `f_template=55` |
| Type of work | `f_type_of_work=Networking,Cabling` |
| Flags | `f_flags=` (empty = no flags) |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&f_work_order_id=1001,1002,1003&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Assignment & Provider

| Filter | Example |
|--------|---------|
| Assigned provider | `f_assigned_provider=12345` |
| Pending requests | `f_requests=true` |
| Has counter offer | `f_has_counter_offer=true` |
| Provider rating | `f_rating=4.0` (4.0 stars or higher) |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_assigned&f_assigned_provider=12345&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Organization

| Filter | Example |
|--------|---------|
| Client | `f_client=20` |
| Project | `f_project=55` |
| Manager | `f_manager=jane@acme.com` |
| Funding account | `f_fund=10` |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&f_client=20&f_project=55&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Dates

Dates are accepted as `YYYY-MM-DD` for a full day, or `YYYY-MM-DD,YYYY-MM-DD` for an inclusive range. All values are treated as UTC.

| Filter | Example |
|--------|---------|
| Service schedule | `f_service_schedule=2025-01-01,2025-01-31` |
| Created date | `f_created_date=2025-03-01` or `f_created_date=2025-01-01,2025-03-31` |
| Approved/cancelled | `f_approved_cancelled_date=2025-01-01,2025-03-31` |
| Work done | `f_work_done_done=2025-02-01,2025-02-28` |

```bash
# Work orders scheduled in January 2025
curl "https://api.fieldnation.com/api/rest/v2/workorders?f_service_schedule=2025-01-01,2025-01-31&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Location

| Filter | Example |
|--------|---------|
| State | `f_state=TX,CA` |
| City | `f_city=Austin,Dallas` |
| Zip | `f_zip=78701,78702` |
| Saved location IDs | `f_location_ids=42,43` |
| Location group | `f_location_group_ids=7` |
| Time zone | `f_time_zone=America/Chicago` or `f_time_zone=-5,-6` |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?f_state=TX,CA&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Pay

| Filter | Example |
|--------|---------|
| Pay range | `f_pay=100,500` or `f_pay=250` (minimum) |
| Min hourly rate | `f_min_hourly_rate=50` |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&f_pay=100,500&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Pagination

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&page=2&per_page=50&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The response `metadata` object includes `total`, `page`, `pages`, and `per_page`.

---

## Sorting

| Sort | Description |
|------|-------------|
| `sort=schedule&order=asc` | Soonest service date first |
| `sort=created_date&order=desc` | Most recently created first |
| `sort=pay&order=desc` | Highest paying first |

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&sort=schedule&order=asc&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Advanced Options

### View and columns

Control the shape and columns returned.

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?view=list&columns=id,title,status,schedule&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Sticky parameters

When `sticky` is omitted or `true`, filters are saved server-side against your user account. A filter applied in one request can carry over into a subsequent request — causing unexpected results. **Always pass `sticky=false`** to keep each request fully self-contained.

You can verify which filters were applied by inspecting the response: every recognized filter is echoed back as an `f_*` key with a corresponding `fs_*` boolean. If a filter key is absent, it was not recognized.

### Clear sticky filters

Pass `f_=` (bare `f_` with empty value) to clear all saved sticky filters for the current list.

```bash
curl "https://api.fieldnation.com/api/rest/v2/workorders?list=workorders_all&f_=&sticky=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Common Recipes

| Scenario | Example |
|----------|---------|
| All open work orders in Texas, by service date | `list=workorders_all&f_state=TX&sort=schedule&order=asc&sticky=false` |
| Q1 2025 created, specific project | `list=workorders_all&f_project=55&f_created_date=2025-01-01,2025-03-31&sticky=false` |
| Published with pending requests, page 2 | `list=workorders_published_routed&f_requests=true&page=2&per_page=25&sticky=false` |
| Assigned to a specific provider | `list=workorders_assigned&f_assigned_provider=12345&sticky=false` |
| Keyword search in drafts | `list=workorders_draft&f_search=fiber+optic&sticky=false` |
| Client + pay range | `list=workorders_all&f_client=20&f_pay=100,500&sticky=false` |

---

## Response Structure

A successful `200` response includes:

- **results** – Array of work order objects (shape depends on `view` and `columns`)
- **metadata** – Pagination and active state (`total`, `page`, `pages`, `per_page`, `sort`, `order`, `list`, `available_filters`, `available_columns`)
- **lists** – All list tabs with labels and counts
- **saved_filters** – User's saved custom filter sets

```json
{
  "results": [...],
  "metadata": {
    "total": 142,
    "page": 1,
    "pages": 6,
    "per_page": 25,
    "sort": "schedule",
    "order": "asc",
    "list": "workorders_all",
    "available_filters": [...],
    "available_columns": [...]
  },
  "lists": [...],
  "saved_filters": [...]
}
```
