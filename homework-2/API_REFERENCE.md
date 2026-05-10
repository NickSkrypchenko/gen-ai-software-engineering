# API Reference — Customer Support API

Base URL: `http://localhost:3000` (dev) · `https://customer-support-api.vercel.app` (prod)

All responses are `application/json`. All timestamps are ISO 8601 with timezone.

---

## Optimistic concurrency

Every resource carries a `version` integer. Any mutation (`PUT`, `DELETE`, status transitions, classify) must include:

```
If-Match: "N"
```

where `N` is the `version` from the last `GET`. A mismatch returns **412**. Missing header returns **428**.

Fetch → read `ETag: "N"` response header → pass it back as `If-Match: "N"`.

---

## Data models

### Ticket

```json
{
  "id": "uuid",
  "customer_id": "string",
  "customer_email": "email",
  "customer_name": "string",
  "subject": "string (1–200 chars)",
  "description": "string (10–2000 chars)",
  "category": "account_access | technical_issue | billing_question | feature_request | bug_report | other",
  "priority": "urgent | high | medium | low",
  "status": "new | in_progress | waiting_customer | resolved | closed",
  "created_at": "datetime",
  "updated_at": "datetime",
  "resolved_at": "datetime | null",
  "assigned_to": "string | null",
  "tags": ["string"],
  "metadata": { "source": "web_form | email | api | chat | phone", "browser": "string?", "device_type": "desktop | mobile | tablet | null?" },
  "version": 1
}
```

### Error

```json
{
  "error": "Human-readable message",
  "details": [{ "field": "customer_email", "message": "Invalid email" }],
  "requestId": "uuid"
}
```

`details` is only present on validation errors (400).

---

## Endpoints

### GET /health

Health check.

**Response 200**
```json
{ "status": "ok", "uptime": 42.3 }
```

---

### GET /api/tickets

List tickets with optional filters and pagination.

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | Filter by status |
| `category` | enum | Filter by category |
| `priority` | enum | Filter by priority |
| `assigned_to` | string | Filter by assignee (exact match) |
| `q` | string | Full-text search on subject + description |
| `limit` | integer | Page size (default 50, max 200) |
| `offset` | integer | Pagination offset (default 0) |

**Response 200**
```json
{
  "data": [{ "id": "...", "subject": "...", "status": "new", "..." : "..." }],
  "count": 142,
  "page": { "limit": 50, "offset": 0 }
}
```

**cURL**
```bash
curl "http://localhost:3000/api/tickets?status=new&priority=urgent&limit=10"
```

---

### POST /api/tickets

Create a ticket.

**Request body**
```json
{
  "customer_id": "cust_001",
  "customer_email": "alice@example.com",
  "customer_name": "Alice Smith",
  "subject": "Cannot log in",
  "description": "I've been locked out since yesterday evening.",
  "priority": "high",
  "assigned_to": "agent-1",
  "tags": ["login", "urgent"],
  "metadata": { "source": "web_form" }
}
```

`priority` defaults to `medium`. `category` defaults to `other` (use `?auto_classify=true` to classify on creation).

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `auto_classify` | boolean | Run classifier after creation |

**Response 201** — full Ticket object  
**Response 400** — validation error with `details`

**cURL**
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice Smith",
    "subject": "Cannot log in",
    "description": "I have been locked out since yesterday.",
    "metadata": { "source": "api" }
  }'
```

---

### GET /api/tickets/:id

Get a single ticket. Sets `ETag: "N"` response header.

**Response 200** — Ticket  
**Response 404** — not found

**cURL**
```bash
curl -i http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000
# Note the ETag header in the response
```

---

### PUT /api/tickets/:id

Partial update (patch semantics — only provided fields are changed).

**Headers**
```
If-Match: "1"
```

**Request body** (all fields optional)
```json
{
  "subject": "Updated subject",
  "priority": "urgent",
  "assigned_to": "agent-2",
  "tags": ["billing", "vip"]
}
```

**Response 200** — updated Ticket  
**Response 400** — validation error  
**Response 404** — not found  
**Response 412** — version conflict  
**Response 428** — If-Match header missing

**cURL**
```bash
curl -X PUT http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "If-Match: \"1\"" \
  -H "Content-Type: application/json" \
  -d '{ "assigned_to": "agent-3" }'
```

---

### DELETE /api/tickets/:id

Delete a ticket.

**Headers**
```
If-Match: "1"
```

**Response 204** — deleted  
**Response 404** — not found  
**Response 412** — version conflict  
**Response 428** — If-Match header missing

**cURL**
```bash
curl -X DELETE http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "If-Match: \"1\""
```

---

### POST /api/tickets/:id/transitions

Transition the ticket to a new status.

**Headers**
```
If-Match: "1"
```

**Request body**
```json
{
  "to": "in_progress",
  "reason": "Picked up by tier-2 support"
}
```

Valid transitions:

| From | Allowed next |
|------|-------------|
| `new` | `in_progress` |
| `in_progress` | `waiting_customer`, `resolved` |
| `waiting_customer` | `in_progress`, `resolved` |
| `resolved` | `in_progress`, `closed` |
| `closed` | `in_progress` |

`resolved_at` is set when transitioning to `resolved`, cleared when reopening, and preserved when transitioning from `resolved` to `closed`.

**Response 200** — updated Ticket  
**Response 404** — not found  
**Response 412** — version conflict  
**Response 422** — invalid transition  
**Response 428** — If-Match header missing

**cURL**
```bash
curl -X POST http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000/transitions \
  -H "If-Match: \"1\"" \
  -H "Content-Type: application/json" \
  -d '{ "to": "in_progress", "reason": "Assigned to tier-2" }'
```

---

### POST /api/tickets/:id/auto-classify

Run the rule-based classifier and update `category` and `priority`.

**Headers**
```
If-Match: "1"
```

**Response 200**
```json
{
  "ticket": { "...": "updated ticket" },
  "classification": {
    "id": "uuid",
    "ticket_id": "uuid",
    "category": "account_access",
    "priority": "high",
    "confidence": 0.85,
    "reasoning": "Matched keywords: login, locked out",
    "matched_keywords": ["login", "locked out"],
    "source": "auto",
    "classified_at": "2026-05-06T10:00:00Z"
  }
}
```

**cURL**
```bash
curl -X POST http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000/auto-classify \
  -H "If-Match: \"1\""
```

---

### GET /api/tickets/:id/transitions

Get the full transition history (append-only, ordered by time).

**Response 200**
```json
[
  {
    "id": "uuid",
    "ticket_id": "uuid",
    "from_status": null,
    "to_status": "new",
    "transitioned_at": "2026-05-06T09:00:00Z",
    "transitioned_by": null,
    "reason": null
  },
  {
    "id": "uuid",
    "ticket_id": "uuid",
    "from_status": "new",
    "to_status": "in_progress",
    "transitioned_at": "2026-05-06T10:00:00Z",
    "transitioned_by": "agent-1",
    "reason": "Picked up"
  }
]
```

`from_status: null` on the first entry indicates the creation event.

**cURL**
```bash
curl http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000/transitions
```

---

### GET /api/tickets/:id/classifications

Get the classification history (append-only, ordered by time).

**Response 200** — array of Classification objects (see auto-classify response above)

**cURL**
```bash
curl http://localhost:3000/api/tickets/550e8400-e29b-41d4-a716-446655440000/classifications
```

---

### POST /api/tickets/import

Bulk import tickets from CSV, JSON, or XML.

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `format` | `csv \| json \| xml` | File format (required) |
| `auto_classify` | boolean | Run classifier on each imported ticket |

**Request** — `multipart/form-data` with a `file` field. Max 5 MB, max 1000 rows.

**Response 200**
```json
{
  "total": 50,
  "succeeded": 47,
  "failed": [
    { "row": 3, "stage": "validate", "error": "customer_email: Invalid email" },
    { "row": 18, "stage": "insert", "error": "description too short" },
    { "row": 31, "stage": "validate", "error": "subject is required" }
  ],
  "auto_classified": 47
}
```

`stage` is `parse`, `validate`, or `insert`. Failed rows do not roll back successful rows.

**cURL**
```bash
curl -X POST "http://localhost:3000/api/tickets/import?format=csv&auto_classify=true" \
  -F "file=@tests/fixtures/csv/valid-50.csv"
```

**CSV format** — header row required. Nested fields use dot notation (`metadata.source`). Tags as comma-separated values in a `tags` column.

```csv
customer_id,customer_email,customer_name,subject,description,priority,metadata.source,tags
cust_001,alice@example.com,Alice,Login issue,Cannot log in since yesterday.,high,web_form,"login,account"
```

**JSON format** — root array of ticket objects:
```json
[
  {
    "customer_id": "cust_001",
    "customer_email": "alice@example.com",
    "customer_name": "Alice",
    "subject": "Login issue",
    "description": "Cannot log in since yesterday.",
    "metadata": { "source": "api" }
  }
]
```

**XML format**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>cust_001</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice</customer_name>
    <subject>Login issue</subject>
    <description>Cannot log in since yesterday.</description>
    <priority>high</priority>
    <metadata>
      <source>api</source>
    </metadata>
    <tags>
      <tag>login</tag>
      <tag>account</tag>
    </tags>
  </ticket>
</tickets>
```

---

## Error codes

| HTTP | Meaning |
|------|---------|
| 400 | Validation error — see `details` array |
| 404 | Ticket not found |
| 409 | Conflict (duplicate) |
| 412 | Precondition Failed — version mismatch (If-Match wrong) |
| 422 | Unprocessable — invalid state transition |
| 428 | Precondition Required — If-Match header missing |
| 500 | Internal server error |

All error responses include `requestId` for log correlation.
