# Creating Work Orders

The core action of the Client API is creating work orders. This is done via a `POST` request to `/workorders`.

## Endpoint

```
POST /workorders
```

## Prerequisites

Before creating a work order, ensure you have the necessary IDs. You cannot "make up" these values; they must exist in the system.

> **Where to find IDs:**
> - `types_of_work`: Call `GET /types-of-work`
> - `template`: Call `GET /templates` (or create one in the UI)
> - `project`: Call `GET /projects`
> - `location`: Call `GET /locations` (for saved locations)

## Payload Structure

A work order is composed of several key objects. You do not need to provide all of them if you use a Template.

### 1. Basic Info

Title, Description, and Classification.

```json
{
  "title": "Replace POS Terminal",
  "description": { "html": "<p>Swap out the defective unit.</p>" },
  "types_of_work": [{ "id": 62, "isPrimary": true }]
}
```

### 2. Location

Where the work takes place.

```json
"location": {
  "mode": "custom",
  "address1": "123 Main St",
  "city": "Minneapolis",
  "state": "MN",
  "zip": "55401",
  "country": "US"
}
```

### 3. Schedule

When the work should be done. Three schedule modes are available:

- **exact**: Must arrive at a specific time
- **between**: Arrival within a time window
- **hours**: Complete within specified hours from start

```json
"schedule": {
  "service_window": {
    "mode": "exact",
    "start": { "utc": "2025-01-15 09:00:00" }
  }
}
```

For Hard Start (strict on-time requirement), add `require_ontime`:

```json
{
  "schedule": {
    "service_window": {
      "mode": "exact",
      "start": { "utc": "2025-01-15 09:00:00" }
    }
  },
  "require_ontime": true
}
```

### 4. Pay

How much you are offering.

```json
"pay": {
  "type": "fixed",
  "base": { "amount": 150.00, "units": 1 }
}
```

## Complete Examples

**Scenario**: Simple job at a specific time with a flat rate.

```json
{
   "title":"Install Point of Sale",
   "types_of_work":[{ "id": 62, "isPrimary": true }],
   "location":{
      "mode":"custom",
      "address1":"123 Main Street",
      "city":"Phoenix",
      "state":"AZ",
      "zip":"85001",
      "country":"US"
   },
   "schedule":{
      "service_window":{
         "mode":"exact",
         "start":{ "utc":"2025-01-15 13:00:00" }
      }
   },
   "pay":{
      "type":"fixed",
      "base":{ "amount":400, "units":1 }
   }
}
```

**Scenario**: Rate per hour, with a "Between" service window (Open window).

```json
{
   "title":"Troubleshoot Network",
   "types_of_work":[{ "id": 76, "isPrimary": true }],
   "location":{
      "mode":"custom",
      "address1":"123 Main Street",
      "city":"Phoenix",
      "state":"AZ",
      "zip":"85001"
   },
   "schedule":{
      "service_window":{
         "mode":"between",
         "start":{ "utc":"2025-01-15 09:00:00" },
         "end":{ "utc":"2025-01-15 17:00:00" }
      }
   },
   "pay":{
      "type":"hourly",
      "base":{ "amount":45, "units":2 }
   }
}
```

**Scenario**: Using a Template ID (`68`) to pre-fill description and settings.

```json
{
   "title":"Standard Maintenance",
   "template":{ "id":68 },
   "location":{
      "mode":"custom",
      "address1":"123 Main Street",
      "city":"Phoenix",
      "state":"AZ",
      "zip":"85001"
   },
   "schedule":{
      "service_window":{
         "mode":"exact",
         "start":{ "utc":"2025-01-15 13:00:00" }
      }
   }
}
```

## Advanced Options

You can pass custom field values if your project requires them.

```json
"custom_fields": {
  "results": [
    {
      "results": [
        { "id": 129, "value": "Store #5521" }
      ]
    }
  ]
}
```

Add incentives or requirements to the pay structure.

```json
"pay": {
  "type": "fixed",
  "base": { "amount": 100, "units": 1 },
  "bonuses": { "results": [{ "id": 3 }] }
}
```

> **Validation**: Ensure your `types_of_work` IDs and `template` IDs are valid in the Production environment, as they differ from Sandbox.

## Field Reference

| Field | Description | Required |
|-------|-------------|----------|
| `title` | Work order title | Yes |
| `location` | Job location (custom or saved) | Yes |
| `pay` | Payment terms (fixed or hourly) | Yes |
| `schedule` | Service window timing | Yes |
| `description` | HTML-formatted job description | No |
| `template` | Use template to pre-fill fields (`{ id: number }`) | No |
| `project` | Assign to project (`{ id: number }`) | No |
| `client` | Tag with client (`{ id: number }`) | No |

## Related

- **Templates** – Pre-fill work order fields
- **Types of Work** – Job classifications
- **Locations** – Saved locations
- **Workflow** – Next: publish and route
