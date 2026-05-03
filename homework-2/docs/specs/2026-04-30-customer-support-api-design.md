# Customer Support Ticket System — Design Specification

**Project:** Homework 2 — Intelligent Customer Support System
**Course:** GenAI and Agentic AI for Software Engineering — Lesson 2 focus: Context-Model-Prompt framework
**Author:** Nicko (drafted with Claude in brainstorming mode)
**Date:** 2026-04-30
**Status:** Approved for implementation
**Implementation driver:** Claude Code

---

## 0. Purpose & scope

This document is the implementation contract for Homework 2. Claude Code is the implementation driver and consumes this spec as authoritative input to produce the deliverables required by `homework-2/TASKS.md` and the submission rules in the repository's top-level `README.md`.

**In scope.** A Node.js + Express + TypeScript REST API for customer-support tickets with full CRUD, three-format bulk import (CSV/JSON/XML), keyword-based auto-classification with confidence and reasoning, guarded status state machine with audit log, optimistic concurrency, branded docs page + operator dashboard, full test pyramid (unit + integration + Newman e2e + concurrency tests), performance benchmarks via autocannon, OpenAPI 3.1 generated from Zod schemas, code review via `/codex:review`, visual design via `/high-end-visual-design`, multi-model documentation generation (Opus for ARCHITECTURE, Sonnet for README/TESTING_GUIDE, Redoc auto-gen for API_REFERENCE), CI workflow on GitHub Actions, and deployment to Vercel via the `/vercel:deploy` skill. **Persistent storage on Neon Postgres + Drizzle ORM**, accessible from both local dev and Vercel production through the same DATABASE_URL pattern (separate Neon branches per environment).

**Out of scope.** Authentication or authorization, multi-tenant isolation, LLM-backed classification (rules only in v1), email/Slack notifications on assign/resolve, soft-delete, advisory locks beyond optimistic concurrency, file uploads larger than 5 MB, imports with more than 1000 rows, content sniffing for format auto-detection, frontend E2E tests beyond Playwright screenshots, security pen-testing, schema migration rollback automation.

**Non-goals.** Production-grade SLA, horizontal scaling beyond single Vercel serverless function, observability beyond JSON request logs and Vercel's built-in metrics.

---

## 1. Architectural approach

**Approach A — Layered + `domain/` slice.** One Node.js process. The HW1 layered structure (`routes → controllers → services → repository`) is preserved and extended with a new `domain/` slice for pure business logic: state machine, classifier rules engine, ticket invariants. Each layer has one job and one set of dependencies. The repository is the only thing that mutates DB state. Services orchestrate; domain functions are pure (no I/O). Controllers stay thin so PR review focuses on logic.

**Single deployable.** Express serves both `/api/*` (REST API) and `/`, `/dashboard` (static frontend) from the same port locally; on Vercel it becomes a serverless function (`api/index.ts`) plus CDN-served static files from `public/`.

**TypeScript end-to-end.** Backend and frontend share types via `import type`. Zod schemas are the single source of truth for runtime validation, TypeScript types (`z.infer`), and the OpenAPI document (`zod-to-openapi`). Drizzle adds a fourth derivative — DB row types via `InferSelectModel`. Enum value arrays live in `domain/ticket.ts` (no DB imports) so the frontend can import them at runtime without dragging in Drizzle.

**Persistent storage on Neon Postgres.** Three branches per project: `main` (production), `dev` (local), `test` (Vitest test suite). Same migrations applied to each branch. Drizzle ORM with copy-on-write data isolation between branches. Connection pooling via Neon's `-pooler` URL suffix.

---

## 2. Module map

```
homework-2/
├── src/
│   ├── index.ts                  # bootstrap (local dev): load env, build app, listen
│   ├── app.ts                    # createApp() — composes middleware + routes (testable)
│   ├── config.ts                 # env parsing (DATABASE_URL, PORT, NODE_ENV, ...)
│   │
│   ├── routes/
│   │   ├── tickets.routes.ts
│   │   ├── import.routes.ts
│   │   └── health.routes.ts
│   ├── controllers/
│   │   ├── tickets.controller.ts
│   │   └── import.controller.ts
│   │
│   ├── services/                 # orchestration only — no business logic
│   │   ├── tickets.service.ts    # create, update, delete, list, transition
│   │   ├── import.service.ts     # parse + validate + bulk insert + summary
│   │   └── classify.service.ts   # invokes domain/classifier; persists to two tables atomically
│   │
│   ├── domain/                   # ← pure functions, no I/O
│   │   ├── ticket.ts             # Ticket type + invariants + enum value arrays
│   │   ├── ticket-state-machine.ts  # canTransition(from,to), allowedTransitions(from), transition()
│   │   ├── classifier.ts         # classify(text) → ClassificationResult
│   │   └── classifier-rules.ts   # CATEGORY_RULES, PRIORITY_RULES — data, not logic
│   │
│   ├── importers/                # one module per format, unified interface
│   │   ├── csv.importer.ts
│   │   ├── json.importer.ts
│   │   ├── xml.importer.ts
│   │   ├── importer.types.ts     # Importer, ImporterResult interfaces
│   │   └── index.ts              # importers map { csv, json, xml }
│   │
│   ├── repository/
│   │   ├── ticket.repository.ts       # CRUD + transactions (update + audit log atomic)
│   │   ├── transition.repository.ts   # read-only access to audit log
│   │   └── classification.repository.ts # read-only access to classifications history
│   │
│   ├── db/
│   │   ├── client.ts             # singleton: drizzle(neon(DATABASE_URL))
│   │   ├── schema.ts             # tickets, ticket_transitions, classifications + enums
│   │   ├── types.ts              # InferSelectModel<typeof tickets>, InferInsertModel
│   │   └── migrations/           # generated SQL by drizzle-kit
│   │
│   ├── validators/               # Zod schemas — single source of truth
│   │   ├── ticket.schemas.ts     # CreateTicketSchema, UpdateTicketSchema, TransitionRequestSchema, ListFiltersSchema
│   │   ├── metadata.schemas.ts   # TicketMetadataSchema, TICKET_SOURCES, DEVICE_TYPES
│   │   ├── import.schemas.ts     # ImportRequestSchema
│   │   └── common.schemas.ts     # Email, NonEmptyString
│   │
│   ├── models/
│   │   └── ticket.types.ts       # Re-exports from db/, validators/, domain/ in one place
│   │
│   ├── middleware/
│   │   ├── error-handler.ts      # central error → uniform JSON
│   │   ├── request-id.ts         # x-request-id for traceability
│   │   ├── etag.ts               # set ETag header on GET, validate If-Match on mutations
│   │   └── validate.ts           # generic Zod request validator
│   │
│   └── utils/
│       ├── http-errors.ts        # ValidationError, NotFoundError, InvalidTransitionError, VersionConflictError
│       ├── clock.ts              # injectable now() — services only; domain takes Date as parameter
│       └── logger.ts             # pino, JSON logs
│
├── public/
│   ├── index.html                # branded landing + docs page
│   ├── dashboard.html
│   ├── css/tailwind.css          # built from src/styles.css
│   ├── js/                       # api-client + components + entry points (vanilla TS)
│   └── assets/                   # logo, og image, favicons
│
├── api/
│   └── index.ts                  # Vercel serverless entry — imports createApp(), exports
│
├── tests/
│   ├── setup.ts                  # Vitest: load .env.test, init DB pool, hooks
│   ├── integration/              # Layer 2 — Supertest + real Postgres
│   ├── performance/              # Layer 4a — Promise.all concurrency tests
│   └── fixtures/                 # tests/fixtures/{csv,json,xml,shared}/
│
└── scripts/
    ├── generate-openapi.ts       # Zod → OpenAPI 3.1
    ├── postman-sync.ts           # Postman MCP wiring
    ├── perf-summary.ts           # Aggregate docs/perf-results/*.json → markdown table
    └── seed.ts                   # Bulk-load demo/fixtures into branch
```

**Request lifecycle:** `route → validate(zodSchema) → controller → service → (domain pure fn) + repository → controller → JSON response`. Errors throw typed `HttpError` subclasses; the error-handler middleware maps them to status + body.

**Frontend type-sharing rules:**

- Frontend MAY: `import type` from anywhere in `src/`.
- Frontend MAY: `import` (runtime) **only from `src/domain/`** — no DB/IO dependencies.
- Frontend MUST NOT: `import` (runtime) from `src/db/`, `src/repository/`, `src/services/`, `src/middleware/`, `src/utils/logger.ts`.
- Enforced by `tsconfig.web.json` `"verbatimModuleSyntax": true` + esbuild bundler resolution failures as safety net.

---

## 3. API contract

All endpoints under `/api`. JSON responses unless noted. Every response includes an `x-request-id` header.

### 3.1 Ticket resource

```jsonc
{
  "id":             "01933a8e-...",        // UUID v7
  "customer_id":    "CUST-12345",
  "customer_email": "alice@example.com",
  "customer_name":  "Alice Johnson",
  "subject":        "Cannot log in after password reset",
  "description":    "After resetting my password I get a 500 on submit...",
  "category":       "account_access",      // enum, default 'other'
  "priority":       "urgent",              // enum, default 'medium'
  "status":         "in_progress",         // enum, default 'new'
  "created_at":     "2026-04-29T10:15:30.000Z",
  "updated_at":     "2026-04-29T10:18:42.000Z",
  "resolved_at":    null,
  "assigned_to":    "agent-bob",
  "tags":           ["login","mfa"],
  "metadata": {
    "source":      "web_form",             // enum, required
    "browser":     "Chrome 124",
    "device_type": "desktop"               // enum, optional
  },
  "version":        3                       // optimistic concurrency token
}
```

### 3.2 Endpoints

| Method | Path | Success | Notes |
|---|---|---|---|
| `POST` | `/api/tickets` | `201` + `Ticket` | Body: `CreateTicketSchema`. Server assigns `id`, `created_at`, `updated_at`, `status: "new"`, `version: 1`. Optional `?auto_classify=true` runs classifier inline (same transaction). |
| `POST` | `/api/tickets/import` | `200` + `ImportSummary` | `multipart/form-data` with `file` field (max 5 MB, max 1000 rows). `?format=csv\|json\|xml` required. Optional `?auto_classify=true`. See §3.5. |
| `GET` | `/api/tickets` | `200` + `{ data, count, page }` | Filters: `status`, `category`, `priority`, `assigned_to`, `customer_id`, `from`, `to` (created_at), `q` (full-text). Pagination: `limit` (default 50, max 200), `offset`. Sort: `created_at desc`. |
| `GET` | `/api/tickets/:id` | `200` + `Ticket` / `404` | Returns `ETag: "<version>"` header. |
| `PUT` | `/api/tickets/:id` | `200` + `Ticket` | Body: `UpdateTicketSchema` — partial update **without** `status` field. Requires `If-Match: "<version>"`. Mismatch → `412`. Success → `version + 1`. See §3.3. |
| `DELETE` | `/api/tickets/:id` | `204` | Requires `If-Match`. Cascade on `ticket_transitions` and `classifications`. |
| `POST` | `/api/tickets/:id/transitions` | `200` + `Ticket` | Status state machine. Body: `{ to: TicketStatus, reason?: string }`. Requires `If-Match`. Illegal transition → `422`. See §3.4. |
| `POST` | `/api/tickets/:id/auto-classify` | `200` + `ClassificationResult` | Runs rules-based classifier. INSERT into `classifications` + UPDATE `tickets.category/priority` in one transaction. Requires `If-Match`. |
| `GET` | `/api/tickets/:id/transitions` | `200` + `Transition[]` | Audit log of transitions, newest first. |
| `GET` | `/api/tickets/:id/classifications` | `200` + `Classification[]` | History of classifications (auto + manual override), newest first. |
| `GET` | `/health` | `200` + `{ status, uptime, db: "ok"\|"down" }` | Performs `SELECT 1` against Neon. |

### 3.3 Optimistic concurrency

Every `Ticket` response carries `version: integer` (starts at 1, increments on any mutation).

- `GET /tickets/:id` returns `ETag: "<version>"` header.
- All mutations (`PUT`, `DELETE`, `POST /transitions`, `POST /auto-classify`) require `If-Match: "<version>"`.
  - Header missing → `428 Precondition Required`.
  - Version mismatch → `412 Precondition Failed`:
    ```json
    { "error": "Version conflict", "code": "VERSION_CONFLICT",
      "current_version": 5, "your_version": 3, "requestId": "..." }
    ```
- Server check: `UPDATE tickets SET ..., version = version + 1 WHERE id = :id AND version = :expected RETURNING *`. Zero rows updated → fetch current version, raise `412`.

**Frontend strategy:** `api-client.ts` caches version per ticket id; auto-applies `If-Match`. Selective auto-retry once on `412`:

| Operation | Auto-retry? | Reason |
|---|:---:|---|
| `updateTicket` (PUT) | ✓ | Idempotent in intent |
| `autoClassify` | ✓ | Pure function |
| `transitionTicket` | ✗ | State change; FSM may differ on new version |
| `deleteTicket` | ✗ | Destructive; user re-confirms |

### 3.4 Status state machine

Allowed transitions:

| From ↓ \ To → | new | in_progress | waiting_customer | resolved | closed |
|---|:---:|:---:|:---:|:---:|:---:|
| **new** | — | ✓ | — | — | — |
| **in_progress** | — | — | ✓ | ✓ | — |
| **waiting_customer** | — | ✓ | — | ✓ | — |
| **resolved** | — | ✓ (reopen) | — | — | ✓ |
| **closed** | — | ✓ (reopen) | — | — | — |

Pure function in `domain/ticket-state-machine.ts`:

```ts
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new:               ['in_progress'],
  in_progress:       ['waiting_customer', 'resolved'],
  waiting_customer:  ['in_progress', 'resolved'],
  resolved:          ['in_progress', 'closed'],
  closed:            ['in_progress'],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(ticket: Ticket, to: TicketStatus, now: Date): TransitionResult {
  if (!canTransition(ticket.status, to)) throw new InvalidTransitionError(ticket.status, to);
  const resolved_at =
    to === 'resolved'                                ? now
    : (ticket.status === 'resolved' || ticket.status === 'closed') ? null
    : ticket.resolved_at;
  return { from: ticket.status, to, at: now, ticket: { ...ticket, status: to, resolved_at, updated_at: now } };
}
```

Illegal transition → `422 Unprocessable Entity`:

```jsonc
{
  "error": "Invalid status transition",
  "code": "INVALID_TRANSITION",
  "details": [
    { "field": "status", "from": "closed", "to": "resolved",
      "message": "Cannot transition from 'closed' to 'resolved'. Reopen first ('closed' → 'in_progress')." }
  ],
  "allowed": ["in_progress"],
  "requestId": "..."
}
```

**Side effects on transition:** to `resolved` sets `resolved_at = now`. Reopen out of `resolved`/`closed` clears `resolved_at = null`. Implemented in repository inside the same transaction as status update + audit log insert.

### 3.5 Bulk import response

```jsonc
{
  "total":     50,
  "succeeded": 47,
  "failed": [
    { "row": 3,  "stage": "validate", "field": "customer_email", "message": "Invalid email format" },
    { "row": 17, "stage": "parse",    "message": "Malformed CSV: unterminated quoted string" },
    { "row": 22, "stage": "insert",   "message": "Duplicate ticket id (UUID collision in batch)" }
  ],
  "ticket_ids":      ["01933a8e-...","..."],
  "auto_classified": 47                        // present only when ?auto_classify=true
}
```

Stages: `parse` (format-specific), `validate` (Zod), `insert` (DB). Per-row errors with `row` (1-based, matches user file), `stage`, optional `field`, `message`.

**HTTP status:** always `200` for processable response. If entire file fails parse → `400 PARSE_ERROR` with single `failed[]` entry without `row`.

**Limits:**
- File size: 5 MB → `413 Payload Too Large` if exceeded.
- Row count: 1000 max → `400` without partial processing if exceeded.

### 3.6 Error format (uniform)

```jsonc
{
  "error":     "Invalid status transition",
  "code":      "INVALID_TRANSITION",
  "details":   [ { "field": "status", "message": "..." } ],   // present for VALIDATION/INVALID_TRANSITION
  "requestId": "req_01HXY..."
}
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `PARSE_ERROR` | 400 | Import file unparseable as a whole |
| `MISSING_FORMAT` | 400 | `?format=` absent |
| `NOT_FOUND` | 404 | Ticket id not found |
| `PRECONDITION_REQUIRED` | 428 | Mutation without `If-Match` |
| `VERSION_CONFLICT` | 412 | `If-Match` mismatch |
| `PAYLOAD_TOO_LARGE` | 413 | File > 5 MB or > 1000 rows |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | POST without `application/json` or `multipart/form-data` |
| `INVALID_TRANSITION` | 422 | FSM rejects transition |
| `INTERNAL` | 500 | Unhandled exception |

`requestId` always present. `details[]` for `VALIDATION_ERROR` and `INVALID_TRANSITION`. `VERSION_CONFLICT` adds `current_version` and `your_version`.

### 3.7 v1 simplifications (called out in README)

- **No authentication** — all endpoints public. `assigned_to` and `changed_by` are unverified strings from clients.
- **No soft-delete** — `DELETE` physically removes ticket with cascade on transitions/classifications. `closed` is a terminal status but tickets are deletable from any state.
- **No notification side effects** — no email/Slack on assign or resolve.
- **Concurrency safety only optimistic** — no advisory locks or row-level locking. First wins, second gets `412`.

---

## 4. Data layer & validation

### 4.1 Database schema (Drizzle)

#### `tickets`

```ts
export const tickets = pgTable('tickets', {
  id:              uuid('id').primaryKey(),
  customerId:      varchar('customer_id', { length: 64 }).notNull(),
  customerEmail:   varchar('customer_email', { length: 255 }).notNull(),
  customerName:    varchar('customer_name', { length: 200 }).notNull(),
  subject:         varchar('subject', { length: 200 }).notNull(),
  description:     text('description').notNull(),
  category:        categoryEnum('category').notNull().default('other'),
  priority:        priorityEnum('priority').notNull().default('medium'),
  status:          statusEnum('status').notNull().default('new'),
  createdAt:       timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at',  { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:      timestamp('resolved_at', { withTimezone: true }),
  assignedTo:      varchar('assigned_to', { length: 200 }),
  tags:            text('tags').array().notNull().default(sql`'{}'`),
  metadata:        jsonb('metadata').$type<TicketMetadata>().notNull().default({ source: 'api' }),
  version:         integer('version').notNull().default(1),
}, (t) => ({
  byCustomerEmail:  index('ix_tickets_customer_email').on(t.customerEmail),
  byStatusPriority: index('ix_tickets_status_priority').on(t.status, t.priority),
  byCreatedAt:      index('ix_tickets_created_at').on(t.createdAt.desc()),
  byCategory:       index('ix_tickets_category').on(t.category),
  subjectLen:       check('subject_len', sql`char_length(${t.subject}) BETWEEN 1 AND 200`),
  descriptionLen:   check('description_len', sql`char_length(${t.description}) BETWEEN 10 AND 2000`),
  emailFormat:      check('email_format', sql`${t.customerEmail} ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'`),
}));
```

#### `ticket_transitions` (append-only audit log)

```ts
export const ticketTransitions = pgTable('ticket_transitions', {
  id:           uuid('id').primaryKey(),
  ticketId:     uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  fromStatus:   statusEnum('from_status'),                 // nullable: creation entry has from = null
  toStatus:     statusEnum('to_status').notNull(),
  changedAt:    timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  changedBy:    varchar('changed_by', { length: 200 }),    // nullable: 'system' for auto-events
  reason:       text('reason'),                            // optional, max 500 chars
}, (t) => ({
  byTicket: index('ix_transitions_ticket').on(t.ticketId, t.changedAt.desc()),
}));
```

**Append-only invariant:** no UPDATE or DELETE outside the cascade-on-ticket-delete. Enforced by code review.

#### `classifications` (append-only history)

```ts
export const classifications = pgTable('classifications', {
  id:                uuid('id').primaryKey(),
  ticketId:          uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  category:          categoryEnum('category').notNull(),
  priority:          priorityEnum('priority').notNull(),
  confidence:        real('confidence').notNull(),
  reasoning:         text('reasoning').notNull(),
  matchedKeywords:   text('matched_keywords').array().notNull().default(sql`'{}'`),
  source:            varchar('source', { length: 32 }).notNull(),   // 'auto' | 'manual_override'
  classifiedAt:      timestamp('classified_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTicket:        index('ix_classifications_ticket').on(t.ticketId, t.classifiedAt.desc()),
  confidenceCheck: check('confidence_range', sql`${t.confidence} BETWEEN 0 AND 1`),
}));
```

### 4.2 Enum single source of truth

```ts
// domain/ticket.ts
export const TICKET_CATEGORIES = ['account_access','technical_issue','billing_question','feature_request','bug_report','other'] as const;
export type TicketCategory = typeof TICKET_CATEGORIES[number];

export const TICKET_PRIORITIES = ['urgent','high','medium','low'] as const;
export type TicketPriority = typeof TICKET_PRIORITIES[number];

export const TICKET_STATUSES = ['new','in_progress','waiting_customer','resolved','closed'] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

// validators/metadata.schemas.ts
export const TICKET_SOURCES = ['web_form','email','api','chat','phone'] as const;
export const DEVICE_TYPES   = ['desktop','mobile','tablet'] as const;
```

Both `db/schema.ts` (`pgEnum`) and `validators/*.schemas.ts` (`z.enum`) import these arrays. One change → propagates to DB schema, runtime validation, TypeScript types, and frontend dropdowns.

### 4.3 Repository transactions

```ts
// repository/ticket.repository.ts
async transition(ticketId: string, to: TicketStatus, expectedVersion: number, reason?: string, by?: string) {
  return await db.transaction(async (tx) => {
    // 1. Optimistic check + update
    const [updated] = await tx.update(tickets)
      .set({
        status: to,
        updatedAt: clock.now(),
        version: sql`${tickets.version} + 1`,
        resolvedAt: to === 'resolved' ? clock.now()
                  : (currentStatus === 'resolved' || currentStatus === 'closed') ? null
                  : tickets.resolvedAt,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.version, expectedVersion)))
      .returning();
    if (!updated) throw new VersionConflictError(/* fetch current */);

    // 2. Audit log entry (same transaction)
    await tx.insert(ticketTransitions).values({
      id: uuidv7(), ticketId, fromStatus: currentStatus, toStatus: to,
      changedAt: updated.updatedAt, changedBy: by ?? 'system', reason,
    });

    return updated;
  });
}
```

### 4.4 Zod schemas (single source of truth for validation)

```ts
// validators/common.schemas.ts
export const Email = z.string().trim().toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')
  .max(255);
export const NonEmptyString = (max: number) => z.string().trim().min(1).max(max);

// validators/metadata.schemas.ts
export const TicketMetadataSchema = z.object({
  source:      z.enum(TICKET_SOURCES),
  browser:     z.string().max(200).optional(),
  device_type: z.enum(DEVICE_TYPES).optional(),
}).strict();

// validators/ticket.schemas.ts
export const CreateTicketSchema = z.object({
  customer_id:    NonEmptyString(64),
  customer_email: Email,
  customer_name:  NonEmptyString(200),
  subject:        NonEmptyString(200),
  description:    z.string().trim().min(10).max(2000),
  category:       z.enum(TICKET_CATEGORIES).default('other'),
  priority:       z.enum(TICKET_PRIORITIES).default('medium'),
  assigned_to:    z.string().trim().min(1).max(200).nullable().optional(),
  tags:           z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  metadata:       TicketMetadataSchema,
}).strict();

export const UpdateTicketSchema = CreateTicketSchema
  .omit({ customer_id: true, customer_email: true })
  .partial().strict()
  .refine(v => Object.keys(v).length > 0, 'Update body must contain at least one field');

export const TransitionRequestSchema = z.object({
  to:     z.enum(TICKET_STATUSES),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const ListFiltersSchema = z.object({
  status:      z.enum(TICKET_STATUSES).optional(),
  category:    z.enum(TICKET_CATEGORIES).optional(),
  priority:    z.enum(TICKET_PRIORITIES).optional(),
  assigned_to: z.string().trim().max(200).optional(),
  customer_id: z.string().trim().max(64).optional(),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
  q:           z.string().trim().min(2).max(200).optional(),
  limit:       z.coerce.number().int().positive().max(200).default(50),
  offset:      z.coerce.number().int().nonnegative().default(0),
}).refine(v => !(v.from && v.to) || v.from <= v.to, { message: 'from must be <= to', path: ['to'] });
```

### 4.5 Classifier — pure function

```ts
// domain/classifier.ts
export interface ClassificationResult {
  category:        TicketCategory;
  priority:        TicketPriority;
  confidence:      number;             // 0.0 – 1.0
  reasoning:       string;
  matchedKeywords: string[];
}

export function classify(text: string): ClassificationResult {
  const haystack = text.toLowerCase();
  const categoryHits = CATEGORY_RULES
    .map(r => ({ category: r.category, matched: r.keywords.filter(kw => haystack.includes(kw)) }))
    .filter(h => h.matched.length > 0);
  const priorityHits = PRIORITY_RULES
    .map(r => ({ priority: r.priority, matched: r.keywords.filter(kw => haystack.includes(kw)) }))
    .filter(h => h.matched.length > 0);

  const c = categoryHits[0] ?? { category: 'other' as const, matched: [] };
  const p = priorityHits[0] ?? { priority: 'medium' as const, matched: [] };

  const totalHits = c.matched.length + p.matched.length;
  const confidence = totalHits === 0 ? 0.5 : Math.min(1.0, 0.7 + (totalHits - 1) * 0.1);

  return {
    category:  c.category,
    priority:  p.priority,
    confidence: Number(confidence.toFixed(2)),
    reasoning: buildReasoning(c, p),
    matchedKeywords: [...c.matched, ...p.matched],
  };
}
```

**Pure function.** No I/O. Deterministic. Case-insensitive. Substring (phrase) match. Rules ordered by specificity — `bug_report` precedes `technical_issue`, etc. Confidence bounded [0, 1].

### 4.6 Importer interface

```ts
// importers/importer.types.ts
export interface ImporterResult {
  rows:        Array<{ rowIndex: number; raw: Record<string, unknown> }>;
  parseErrors: Array<{ rowIndex?: number; message: string }>;
}
export interface Importer {
  format: 'csv' | 'json' | 'xml';
  parse(file: Buffer): ImporterResult;
}
export const importers: Record<Format, Importer> = { csv, json, xml };
```

Parsers do **not** validate against `CreateTicketSchema` — only format-mapping. Validation is a separate step in `import.service.ts` using the same schema as `POST /tickets`. Parsers/validators/inserts collect errors per-row and the service aggregates the summary.

**CSV (`papaparse`):** flat headers with dot-notation for nested fields (`metadata.source`); local `unflattenRow()` reconstructs nested objects (~15 LOC, no `flat` library); `tags` is comma-separated within a cell.

**JSON:** root must be a non-empty array of ticket objects; no mapping needed beyond passing each element to validation.

**XML (`fast-xml-parser`):** `isArray` callback for `tickets.ticket` and `tickets.ticket.tags.tag` ensures deterministic shape regardless of element count; small `unwrapTicket()` post-processor unwraps `{ tag: [...] }` to `[...]`.

### 4.7 Test data fixtures

```
tests/fixtures/
├── csv/{valid, partial, malformed, huge, edge_quoting}.csv
├── json/{valid, partial, empty, not_array, malformed}.json
├── xml/{valid, partial, single_ticket, empty, no_root, malformed}.xml
└── shared/{ticket_full, ticket_minimal, classifications}.json
```

Loaded via `readFileSync(resolve('tests/fixtures', rel))` helper. Used in importer unit tests, integration tests, and Newman e2e.

---

## 5. Dashboard & branded docs page

### 5.1 Routes & purpose

- `/` — **branded landing + API docs.** Hero, "Open Dashboard" CTA, 8 endpoint cards with request/response schemas and inline Try-it buttons, bulk-import section with curl examples (no Try-it for file upload — link to dashboard instead), state-machine SVG visualization.
- `/dashboard` — **operator dashboard.** Four panes: filter bar + stats pill (top), tickets table (center), import dropzone (bottom collapsible), ticket detail modal (Details / Status / History tabs) on row click.

### 5.2 Build

No JS framework. Vanilla TypeScript bundled by **esbuild** (one bundle per page). Tailwind via `tailwindcss` CLI. No CDNs in production.

### 5.3 Type sharing

Single `models/ticket.types.ts` re-exports DB row types (Drizzle `InferSelectModel`), API input types (`z.infer`), and runtime enum arrays (`TICKET_STATUSES` etc. from `domain/ticket.ts`). Frontend imports from this file. Two `tsconfig` files (`tsconfig.server.json`, `tsconfig.web.json`) reference a shared base; `tsconfig.web.json` has `"verbatimModuleSyntax": true` to enforce type-only imports of DB types.

### 5.4 ETag-aware API client

`api-client.ts` caches per-id version after each `GET /tickets/:id`. All mutations apply `If-Match` automatically. Selective single auto-retry on `412` for idempotent operations (PUT, auto-classify); explicit user resolution for state-changing operations (transitions, delete) — no infinite loops, max 1 retry then surface conflict to user.

### 5.5 Drag-and-drop import

`import-dropzone.ts` accepts CSV/JSON/XML files. Format auto-detected from extension; user can override via dropdown. Browser file picker fallback via hidden `<input type="file">`. On submit, displays per-row error table from `ImportSummary.failed[]`.

### 5.6 State

URL search params for all dashboard state (filters, selected account, modal open). No `localStorage`, no cookies. Reload-safe and shareable.

### 5.7 Responsive & accessibility

Mobile-first. Tickets table → stacked cards under `md`. Modal → full-screen sheet on mobile, side-panel on desktop. Drag-and-drop hidden on touch (tap-to-upload only). Keyboard navigation, `<label for>`, `aria-describedby` on form errors, `aria-invalid` on invalid fields. WCAG AA contrast enforced by design skill.

### 5.8 `/high-end-visual-design` integration

Visual brief (`docs/specs/visual-brief.md`) constrains output:

> **Brand:** Operator-focused tooling. Calmer than fintech, denser than marketing site. Think Linear / Height / Plane.so — not Mercury or Stripe Press.
>
> **Required components:** nav with stats pill, filter bar (5 selects + search), tickets table with status/priority cell components, ticket modal (3 tabs), drag-and-drop dropzone (idle/hover/uploading/success/error states), FSM-aware transition buttons, classification badge with confidence indicator, mixed-source history timeline, endpoint cards with method pills (4 variants), state-machine SVG.

Wireframes (`docs/specs/wireframes.md`) provide layouts. Skill produces Tailwind classes, custom CSS, motion specs.

---

## 6. Testing strategy

Four layers, each with one job. **API/integration layer intentionally compressed** — no wire-level repetition of what unit tests + Newman cover.

### 6.1 Layer 1 — Unit tests (Vitest)

Pure functions and logic without I/O. Colocated with units (`src/**/*.test.ts`).

```
src/domain/{classifier, classifier-rules, ticket-state-machine}.test.ts  → ~26 tests
src/validators/{ticket, metadata, common}.schemas.test.ts                → ~30 tests
src/importers/{csv, json, xml}.importer.test.ts                          → ~22 tests
src/utils/{http-errors, clock}.test.ts                                   → ~7 tests
TOTAL: ~85 unit tests
```

**Required cases:**

- `domain/classifier.classify`: all 6 categories matched at least once; all 4 priorities matched at least once; **ordering test** (bug_report wins over technical_issue when both match); case-insensitivity; confidence formula at 0/1/2/5+ hits; reasoning contains matched keywords.
- `domain/ticket-state-machine.canTransition`: full 5×5 matrix (25 cases); reopen from `closed` and `resolved`; `transition()` side effects on `resolved_at`.
- `importers`: each format — happy + 1 file-level error + 1 row-level error. CSV special case for RFC 4180 quoting.

**Coverage threshold:** ≥85% lines/branches/functions overall, with elevated thresholds: ≥95% on `src/domain/`, ≥95% lines / 90% branches on `src/validators/`, ≥90% on `src/services/`.

### 6.2 Layer 2 — Integration tests (Vitest + Supertest + real Postgres) — compressed

Full Express from `createApp()`, real Neon `test` branch, real transactions. **Goal: wiring + DB invariants.** No duplication with Layer 1.

```
tests/integration/
├── tickets-crud.test.ts      → 6 tests
├── transitions.test.ts       → 4 tests
├── classifications.test.ts   → 3 tests
├── import.test.ts            → 4 tests
├── concurrency.test.ts       → 3 tests
└── error-shape.test.ts       → 2 tests
TOTAL: ~22 integration tests (vs HW1: 41 — focused, no Layer-1 duplication)
```

**DB testing setup:**

- Separate Neon `test` branch (free-tier, isolated from `dev`).
- `beforeEach` — `TRUNCATE tickets, ticket_transitions, classifications RESTART IDENTITY CASCADE` (~5ms).
- `afterAll` — `pool.end()`.
- Vitest config: `pool: 'forks'`, `singleThread: true` for integration files (no race on shared DB).
- `.env.test` overrides `DATABASE_URL`; loaded via `dotenv/config` in `tests/setup.ts`.

### 6.3 Layer 3 — End-to-end (Newman / Postman)

Black-box, against running server. **Smoke + happy-path lifecycle.** Not duplicating Layer 1/2.

Coverage: smoke, full ticket lifecycle (create → classify → transition → transition → audit → delete), CSV happy import, XML malformed import, optimistic concurrency 428 case. **~12 requests / ~25 assertions.**

Pipeline: Zod → OpenAPI 3.1 (`zod-to-openapi`) → `docs/openapi.yaml` → Postman MCP workspace `Customer Support API — homework-2` → generated collection → scripted assertions added → exported to `demo/postman-collection.json` → Newman runs against local or production URL via `npm run test:e2e`.

### 6.4 Layer 4 — Performance & concurrent

**4a. Concurrency correctness (Vitest, ~3 tests):**

- 20 concurrent PUTs with same `If-Match`: exactly 1 wins (`200`), 19 get `412`. Winner has `version + 1`.
- 20 concurrent imports (same file): no row corruption; `ticket_ids` unique.
- PUT + auto-classify race: both succeed in sequence; version increments twice.

**4b. Performance benchmarks (autocannon, separate scripts):**

```bash
npm run perf:list      # GET /api/tickets, c=20, d=30s
npm run perf:create    # POST /api/tickets, c=20, d=30s
npm run perf:classify  # POST /tickets/:id/auto-classify, c=10, d=10s
npm run perf:bench     # all three
```

Raw outputs in `docs/perf-results/*.json` (committed). Curated table in `TESTING_GUIDE.md` (manually updated or via `npm run perf:summary` script).

### 6.5 What we don't test (called out in README)

- Full filter combination matrix in `GET /tickets` — covered by one combined test + Layer 1 validator unit tests.
- Real Neon network performance — not-our-system.
- Frontend (`public/js/`) beyond Playwright screenshot smoke.
- `/health` deep checks beyond `db: ok|down`.
- Security (XSS / SQL injection) — Drizzle parameterized queries + Zod cover the standard vectors; formal pen-test out of scope.

### 6.6 CI workflow

`.github/workflows/e2e.yml` runs on `push`/`pull_request`:

1. Spin up Postgres 15 service container.
2. `npm ci` + `npm run db:migrate` against container.
3. `npm test` (Vitest: Layers 1, 2, 4a — all in one run).
4. `npm run db:seed` + `npm run start &` background.
5. `npx wait-on http://localhost:3000/health -t 30000`.
6. `npm run test:e2e` (Newman against local).
7. Upload `docs/screenshots/newman-results.html` as artifact.

CI uses containerized Postgres (not Neon — public repo, no key risk; ephemeral DB per run). Production deploys use Neon. Drizzle generates standard SQL — diff is non-material for HW.

### 6.7 Test counts

| Layer | Files | Tests/Asserts |
|---|---|---|
| 1 — Unit | ~12 | ~85 |
| 2 — Integration | 6 | ~22 |
| 4a — Concurrency | 1 | 3 |
| **Total Vitest** | **19** | **~110** |
| 3 — Newman | 1 collection | ~25 assertions |

---

## 7. AI workflow integration

### 7.1 Context-Model-Prompt framework (per phase)

| Phase | Surface | Context | Model | Prompt strategy |
|---|---|---|---|---|
| 0 | Scaffold | This spec + repo state | Sonnet 4.6 | Imperative kickoff with explicit ground rules |
| 1 | Domain & validators | Spec §3-4 + Zod docs | Sonnet 4.6 | Phase-scoped: state machine + classifier + Zod schemas + unit tests |
| 2 | DB layer | Spec §2,4 + Drizzle docs + Neon docs | Sonnet 4.6 | Phase-scoped: schema + migrations + repositories with transactions |
| 3 | HTTP layer | Spec §3 + Phase 1-2 outputs | Sonnet 4.6 | Phase-scoped: routes/controllers/middleware + integration tests |
| 4 | Importers | Spec §4.5-4.7 + fixtures | Sonnet 4.6 | Phase-scoped: 3 importer modules with unified interface |
| 5 | OpenAPI + Postman | Zod schemas + zod-to-openapi docs | Sonnet 4.6 + Postman MCP | Tool orchestration |
| 6 | CI workflow | Spec §6.6 + GHA docs | Sonnet 4.6 | Single-file output: `.github/workflows/e2e.yml` |
| 7 | Wireframes + briefs | Spec §3-5 | Sonnet 4.6 | 4 markdown specs |
| 8 | Frontend visual | wireframes + visual-brief | **/high-end-visual-design** (skill internal) | Skill invocation |
| 9 | Performance | Running app + perf-brief | Sonnet 4.6 + autocannon | Tool orchestration + extract to markdown |
| 10 | Code review | Branch diff + review-brief | **/codex:review** (skill internal) | Skill invocation |
| 11a | ARCHITECTURE.md | Spec + final code structure | **Opus 4.6** | Documentation prompt with Mermaid instructions |
| 11b | README.md | Spec + final repo + screenshots | **Sonnet 4.6** | Standard repo README prompt |
| 11c | TESTING_GUIDE.md | Spec §6 + perf results + coverage | **Sonnet 4.6** | Procedural documentation prompt |
| 11d | API_REFERENCE.md | docs/openapi.yaml | **No LLM (Redoc)** | `redoc-cli build` |
| 11e | HOWTORUN.md | Spec §8 + final scripts | **Sonnet 4.6** | Cold-start runbook prompt |
| 12 | Pre-deploy screenshots | Running app | Sonnet 4.6 + Playwright MCP | Tool orchestration |
| 13 | Vercel deploy | Built app + spec §8 | **/vercel:deploy** (skill internal) | Skill invocation |
| 14 | Post-deploy screenshot | Live URL | Sonnet 4.6 + Playwright MCP | Tool orchestration |
| 15 | AI-USAGE + PR | Conversation + per-phase notes | Sonnet 4.6 | Editorial pass + PR composition |

### 7.2 Phase pipeline

| # | Phase | Driver | Inputs | Outputs | Exit criteria |
|---|---|---|---|---|---|
| 0 | Scaffold | Claude Code | Spec | `package.json`, tsconfigs, `.gitignore`, env examples, scaffolded folders | `npm run dev` boots empty Express; `/health` returns 200 (no DB yet) |
| 1 | Domain & validators | Claude Code | Spec §3, §4 | `src/domain/`, `src/validators/`, unit tests | Layer 1 unit tests green; coverage ≥85% on domain + validators |
| 2 | DB layer | Claude Code | Spec §2, §4 + Phase 1 | `src/db/schema.ts`, migrations, `src/repository/`, seed scripts | `npm run db:migrate` green against `test` branch; repository tests green |
| 3 | HTTP layer | Claude Code | Spec §3 + Phases 1-2 | `src/routes/`, `src/controllers/`, `src/middleware/`, `src/services/`, integration tests | Layer 2 tests green; manual `curl` matches contract |
| 4 | Importers | Claude Code | Spec §4.5-4.7 + fixtures | `src/importers/{csv,json,xml}.importer.ts`, unit tests | Importer tests green |
| 5 | OpenAPI + Postman | Claude Code + Postman MCP | Zod schemas | `docs/openapi.yaml`, `demo/postman-collection.json`, Postman MCP workspace | Newman runs full collection green |
| 6 | CI workflow | Claude Code | Spec §6.6 | `.github/workflows/e2e.yml` | Workflow green on push to branch |
| 7 | Wireframes + briefs | Claude Code | Spec §5, §6, §7 | `docs/specs/{wireframes, visual-brief, review-brief, perf-brief}.md` | All 4 files; user-approved wireframes |
| 8 | Frontend visual | /high-end-visual-design | wireframes + visual-brief | `public/index.html`, `public/dashboard.html`, `public/css/`, `public/js/components/` | Both pages render; mobile + desktop screenshots |
| 9 | Performance | Claude Code + autocannon | Running app + perf-brief | `docs/perf-results/*.json` + table in `TESTING_GUIDE.md` | All 3 benchmarks succeeded |
| 10 | Code review | /codex:review | Branch diff + review-brief | `docs/reviews/codex-review-<date>.md` | All blocking findings addressed |
| 11 | Multi-model docs | Claude Code (Opus + Sonnet) | Spec + repo state + perf | README, ARCHITECTURE, TESTING_GUIDE, HOWTORUN, API_REFERENCE | 5 files + ≥3 Mermaid diagrams |
| 12 | Pre-deploy screenshots | Claude Code + Playwright MCP | Running app | All `docs/screenshots/*.png` except `vercel-deployed.png` | Per §8.1 |
| 13 | Deploy | /vercel:deploy | Built app + Vercel config | Live site | `curl <url>/health` → 200; Newman against prod URL green |
| 14 | Post-deploy screenshot | Claude Code + Playwright MCP | Live URL | `vercel-deployed.png` | Captured after Phase 13 |
| 15 | AI-USAGE + PR | Claude Code | Conversation + notes | Consolidated AI-USAGE.md; PR opened | PR has summary + AI tools + challenges + screenshots; `Alexey-Popov` requested |

### 7.3 Phase ordering rules

- **`docs/AI-USAGE.md` is a living document** — append after every code-producing phase (0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 13). Phase 15 = consolidation.
- **Phase 2 blocks on Phase 1** — Drizzle imports enums from `domain/ticket.ts`.
- **Phase 5 blocks on Phases 1-4** — OpenAPI generated from stable Zod schemas.
- **Phase 8 blocks on Phase 7** — visual-brief required for `/high-end-visual-design`.
- **Phase 10 blocks on Phases 1-9 except docs**. Re-run if Phase 8 produced significant frontend code.
- **Phase 11 blocks on Phase 10** — review must clear before docs describe final state.
- **Phase 13 blocks on Phase 10 clean + `npm test` + `npm run test:e2e` green locally + production migrations applied manually**.
- **Phase 14 blocks on Phase 13 success**.

### 7.4 `/codex:review` brief (`docs/specs/review-brief.md`)

> Review for: (1) state machine correctness + `resolved_at` side effects in transactions; (2) classifier determinism + ordering (`bug_report` wins over `technical_issue`); (3) optimistic concurrency atomicity; (4) importer error contracts + 1-based row indexing; (5) audit log append-only invariant (no UPDATE/DELETE outside cascade); (6) frontend type-sharing rules (no runtime imports from DB/repository/services).
>
> Out of scope: production-grade money handling (no money here), authentication, scaling beyond Vercel free tier, schema migration rollback strategy.
>
> Output as `docs/reviews/codex-review-<date>.md` with `[BLOCKING]`, `[SUGGESTED]`, `[INFO]` tags.

### 7.5 `/vercel:deploy` responsibilities

Spec defines responsibilities (not skill API):

- Detect Express app entry (`api/index.ts`) as serverless function.
- Build pipeline: `npm run build` (tsc + esbuild + tailwindcss).
- `vercel.json` config: `framework: null`, `outputDirectory: "public"`, rewrites `/api/*` and `/health` → serverless function.
- Env vars: `DATABASE_URL` (production Neon), `NODE_ENV=production`, `LOG_LEVEL=info`.
- Root `tsconfig.json` includes `"lib": ["ES2022","DOM","DOM.Iterable"]` (Vercel's `tsc` pass touches all TypeScript files including frontend).
- **Migrations NOT in build step** — applied manually via `DATABASE_URL=$NEON_PROD_URL npm run db:migrate` before deploy. Rationale in `HOWTORUN.md`.
- Smoke test post-deploy: `curl <url>/health` → 200, `curl <url>/api/tickets?limit=1` → 200.

### 7.6 `docs/AI-USAGE.md` template

```markdown
# AI Tools — Usage Log

> Living document — appended after each phase, consolidated in Phase 15.

## Context-Model-Prompt summary table
[§7.1 reproduced here for one-page reference]

## Phase 0: Scaffold
**Tool:** Claude Code (claude-sonnet-4-6)
**Context loaded:** spec at `docs/specs/...`, empty repo state
**Prompt:** [verbatim kickoff prompt]
**Outcome:** accepted | edited | rejected
**What changed and why:** [one paragraph]

[... one entry per code-producing phase ...]

## Phase 11: Multi-model documentation

### 11a — ARCHITECTURE.md
**Model:** claude-opus-4-6
**Why this model:** Heavy reasoning required for component diagrams + design rationale + Mermaid output
**Prompt:** [verbatim]
**Outcome:** ...

### 11b — README.md
**Model:** claude-sonnet-4-6
**Why this model:** Standard repo README — well-known patterns
**Prompt:** [verbatim]
**Outcome:** ...

### 11c — TESTING_GUIDE.md
**Model:** claude-sonnet-4-6
**Why this model:** Procedural; mostly transcribing existing test structure
**Prompt:** [verbatim]
**Outcome:** ...

### 11d — API_REFERENCE.md
**Model:** none (Redoc auto-render from `docs/openapi.yaml`)
**Why no LLM:** OpenAPI is the source of truth; LLM-generated reference would drift from schema

### 11e — HOWTORUN.md
**Model:** claude-sonnet-4-6
**Why this model:** Cold-start runbook — clear procedural writing
**Prompt:** [verbatim]
**Outcome:** ...

## Decisions log
- Settled on Neon branches over separate projects because [...]
- Chose guarded state machine over free transitions because [...]
- Rejected LLM-fallback in classifier because [...]
- [etc.]

## Cost summary (optional)
| Phase | Tokens in | Tokens out | Cost (USD) |
[total at the bottom]
```

### 7.7 What the spec does NOT prescribe

- Verbatim prompts for phases 1-4, 6-7, 9, 11-12, 14-15.
- Internal behavior of `/high-end-visual-design`, `/codex:review`, `/vercel:deploy` — opaque.
- Specific AI vendor for auto-generated documents beyond Claude. If ChatGPT or another tool is available and used, log in AI-USAGE.md.

---

## 8. Deliverables & repo conventions

### 8.1 Final file tree

See full tree in §2 (src/) + §5 (public/) + §6 (tests/) + this section (top-level layout):

```
homework-2/
├── README.md                          # Multi-model: Sonnet 4.6
├── HOWTORUN.md                        # Cold-start runbook
├── ARCHITECTURE.md                    # Multi-model: Opus 4.6
├── API_REFERENCE.md                   # Auto-generated from openapi.yaml via Redoc
├── TESTING_GUIDE.md                   # Multi-model: Sonnet 4.6
├── package.json
├── tsconfig.json / tsconfig.server.json / tsconfig.web.json
├── .gitignore
├── .env.example
├── .env.test.example
├── .nvmrc
├── vitest.config.ts
├── tailwind.config.ts
├── esbuild.config.mjs
├── drizzle.config.ts
├── vercel.json
│
├── src/                               # see §2
├── public/                            # see §5
├── api/index.ts                       # Vercel serverless entry
├── tests/                             # see §6
├── scripts/                           # generate-openapi, postman-sync, perf-summary, seed
│
├── .github/
│   ├── workflows/e2e.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docs/
│   ├── openapi.yaml
│   ├── AI-USAGE.md
│   ├── perf-results/*.json
│   ├── specs/
│   │   ├── 2026-04-30-customer-support-api-design.md   # this file
│   │   ├── claude-code-kickoff-prompt.md
│   │   ├── wireframes.md, visual-brief.md, review-brief.md, perf-brief.md
│   ├── reviews/codex-review-2026-04-30.md
│   └── screenshots/*.png
│
└── demo/
    ├── run.sh, run.bat
    ├── sample-requests.http
    ├── perf/create.json
    ├── postman-collection.json
    └── fixtures/
        ├── sample_tickets.{csv,json,xml}              # 50/20/30 — required by brief
        └── invalid_tickets.{csv,json,xml}             # negative-test fixtures
```

### 8.2 `package.json` scripts (contract)

```jsonc
{
  "scripts": {
    "dev":              "concurrently -n api,web 'tsx watch src/index.ts' 'node esbuild.config.mjs --watch'",
    "build":            "tsc -p tsconfig.server.json && node esbuild.config.mjs && tailwindcss -i src/styles.css -o public/css/tailwind.css --minify",
    "start":            "node dist/index.js",
    "test":             "vitest run --coverage",
    "test:watch":       "vitest",
    "test:unit":        "vitest run src",
    "test:int":         "vitest run tests/integration",
    "test:perf":        "vitest run tests/performance",
    "test:e2e":         "newman run demo/postman-collection.json --env-var baseUrl=${E2E_URL:-http://localhost:3000}",
    "perf:list":        "autocannon -c 20 -d 30 --json http://localhost:3000/api/tickets > docs/perf-results/list-$(date +%s).json",
    "perf:create":      "autocannon -c 20 -d 30 -m POST -H 'Content-Type: application/json' -b @demo/perf/create.json --json http://localhost:3000/api/tickets > docs/perf-results/create-$(date +%s).json",
    "perf:classify":    "autocannon -c 10 -d 10 -m POST --json http://localhost:3000/api/tickets/$ID/auto-classify > docs/perf-results/classify-$(date +%s).json",
    "perf:bench":       "npm run perf:list && npm run perf:create && npm run perf:classify",
    "perf:summary":     "tsx scripts/perf-summary.ts",
    "db:generate":      "drizzle-kit generate",
    "db:migrate":       "drizzle-kit migrate",
    "db:studio":        "drizzle-kit studio",
    "db:seed":          "tsx scripts/seed.ts",
    "db:reset":         "drizzle-kit drop && npm run db:migrate && npm run db:seed",
    "openapi":          "tsx scripts/generate-openapi.ts",
    "openapi:redoc":    "redoc-cli build docs/openapi.yaml -o API_REFERENCE.md",
    "postman:sync":     "tsx scripts/postman-sync.ts",
    "lint":             "eslint . --ext .ts",
    "typecheck":        "tsc --noEmit -p tsconfig.server.json && tsc --noEmit -p tsconfig.web.json",
    "deploy:preview":   "vercel",
    "deploy:prod":      "vercel --prod"
  }
}
```

### 8.3 Environment

`.env.example` (committed):

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-XXX.neon.tech/dev?sslmode=require
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
SEED=0
CORS_ORIGIN=*
```

`.env.test.example` (committed):

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-XXX.neon.tech/test?sslmode=require
NODE_ENV=test
LOG_LEVEL=silent
```

Production env vars only in Vercel dashboard. `.env`, `.env.test`, `.env.production` in `.gitignore`. Node version pinned via `.nvmrc` (LTS, e.g. `22`).

### 8.4 Repo conventions

- **Branch:** `homework-2-submission` (already created).
- **Commits:** Conventional Commits. One logical change per commit. Phase boundaries from §7.2 are natural commit boundaries.
- **PR target:** the *fork's* `main` (not upstream), per repo `README.md §1.2`.
- **Reviewer:** `Alexey-Popov`.
- **Labels:** `homework-2`, `ready-for-review`.
- **PR template** at `.github/PULL_REQUEST_TEMPLATE.md` — see §8.5 mapping.

PR template body:

```markdown
## Summary
<what was implemented, ~150 words>

## AI tools used (Context-Model-Prompt summary)
| Phase | Tool | Model | Outcome |
|---|---|---|---|
| Backend domain | Claude Code | Sonnet 4.6 | accepted |
| DB layer | Claude Code | Sonnet 4.6 | accepted; manual fix on Drizzle enum |
| Visual design | /high-end-visual-design | (skill internal) | accepted; tweaked status badges |
| Code review | /codex:review | (skill internal) | N findings, N addressed |
| ARCHITECTURE.md | Claude Code | Opus 4.6 | edited Mermaid sequence diagram |
| README.md, TESTING_GUIDE.md, HOWTORUN.md | Claude Code | Sonnet 4.6 | accepted |
| API_REFERENCE.md | Redoc CLI | (no LLM) | auto-generated from openapi.yaml |
| Deploy | /vercel:deploy | (skill internal) | live at <url> |

## How to verify
1. `git checkout homework-2-submission && cd homework-2`
2. `npm i && cp .env.example .env && cp .env.test.example .env.test`
3. Provision Neon: 3 branches (`main`, `dev`, `test`); update DATABASE_URLs
4. `npm run db:migrate` (against dev), `npm run db:seed`
5. `npm run dev` → http://localhost:3000
6. `npm test` (Vitest, ~110 tests, ≥85% coverage)
7. `npm run test:e2e` (Newman, server must be running)
8. Live: <Vercel URL>

## Challenges
<2-4 honest bullets>

## Screenshots
<embed dashboard-desktop.png, ticket-modal-history.png, coverage-report.png, vercel-deployed.png inline; link rest>
```

### 8.5 Grading-rubric mapping

Extrapolating HW1 weights (Func 30 / AI Usage 25 / Quality 20 / Docs 15 / Demo 10):

| Rubric line | Where it lives |
|---|---|
| Functionality | `src/`, integration tests, Newman pass, live Vercel demo |
| AI Usage Documentation | `docs/AI-USAGE.md` with §7.1 CMP table, `docs/specs/*-brief.md`, `docs/reviews/`, AI-prompt screenshots, **multi-model evidence** in Phase 11 entries |
| Code Quality | Layered + `domain/` slice, Zod single-source-of-truth, ≥85% coverage (≥95% on critical paths), `/codex:review` clean, type-sharing rules enforced |
| Documentation | 5 files (README, ARCHITECTURE, API_REFERENCE, TESTING_GUIDE, HOWTORUN), Mermaid diagrams (≥3, actually 5+), `docs/openapi.yaml` |
| Demo & Screenshots | `demo/`, `docs/screenshots/`, live Vercel URL in PR body, autocannon perf table |

**Brief-specific requirements (explicit verification):**

- ✅ ">85% code coverage" — `vitest.config.ts` enforced threshold = 85%; actual in `coverage-report.png`.
- ✅ "Use different AI models for different doc types" — §7.1 CMP table + AI-USAGE.md Phase 11 entries.
- ✅ "Include at least 3 Mermaid diagrams across documents" — actually ≥5: ARCHITECTURE (component, sequence for create+classify, sequence for transition), TESTING_GUIDE (test pyramid), README (high-level architecture).
- ✅ "Sample data: 50 CSV / 20 JSON / 30 XML" — `demo/fixtures/sample_tickets.{csv,json,xml}`.
- ✅ "Invalid data files for negative tests" — `demo/fixtures/invalid_tickets.{csv,json,xml}`.
- ✅ "Concurrent operations (20+ simultaneous requests)" — `tests/performance/concurrent-mutations.test.ts`.
- ✅ "Performance benchmarks table" — section in `TESTING_GUIDE.md`, raw in `docs/perf-results/`.

---

## 9. Open questions / future work

Stated in `README.md` under "Future work":

- Authentication (API key per agent, JWT for users).
- LLM-backed classification fallback for `category: "other"` with low confidence (would require ANTHROPIC_API_KEY).
- Soft-delete with `deleted_at` and audit-log preservation.
- Email/Slack notifications on assign and resolve.
- Saved filter views (named filter combinations stored per user).
- CSV import via streaming for files > 5 MB.
- Format auto-detection by content sniffing (currently extension only).
- Schema migration rollback automation + advisory lock for migrate-on-deploy CI.
- Full text search via Postgres `tsvector` indexes (currently `q` filter is `ILIKE`).
- Performance baseline in CI with regression detection.
- API versioning (`/api/v1/...`).
- Rate limiting middleware.

---

## 10. Acceptance checklist

The implementation is complete when **all** of the following are true:

- [ ] `npm run dev` boots and serves both `/api/*` and `/`, `/dashboard` from port 3000.
- [ ] All endpoints in §3.2 implemented and conform to the contract.
- [ ] `npm test` passes with ≥85% coverage overall, ≥95% on `src/domain/`, ≥95% lines / 90% branches on `src/validators/`, ≥90% on `src/services/`.
- [ ] `npm run test:e2e` passes against the running server (Newman, full Postman collection).
- [ ] `demo/sample-requests.http` runs top-to-bottom against a fresh server without errors.
- [ ] `npm run db:seed` loads `demo/fixtures/sample_tickets.{csv,json,xml}` cleanly; `GET /api/tickets` returns the seeded rows.
- [ ] `docs/openapi.yaml` is current and matches the running API.
- [ ] `public/index.html` and `public/dashboard.html` render correctly on desktop and mobile, styled by `/high-end-visual-design` output.
- [ ] `docs/reviews/codex-review-<date>.md` exists with all blocking comments addressed or explicitly waived with rationale.
- [ ] `docs/AI-USAGE.md` covers every phase from §7.1, with entries appended in real-time and consolidated in Phase 15. Phase 11 entries explicitly list which model wrote each doc and why.
- [ ] `docs/screenshots/` contains every artifact listed in §8.1 (`vercel-deployed.png` captured post-deploy per §7.3 Phase 14).
- [ ] All 5 documentation files (`README.md`, `HOWTORUN.md`, `ARCHITECTURE.md`, `API_REFERENCE.md`, `TESTING_GUIDE.md`) are written and accurate. README documents v1 simplifications and known limitations.
- [ ] At least 3 Mermaid diagrams across documentation (target: 5+).
- [ ] `.github/workflows/e2e.yml` runs green on push.
- [ ] `docs/perf-results/*.json` exists for list/create/classify benchmarks; `TESTING_GUIDE.md` has the curated table.
- [ ] Site is live on Vercel; `/health` returns 200; Newman collection passes against the production URL.
- [ ] Production Neon migrations applied before deploy (manual, documented in HOWTORUN).
- [ ] PR opened against the fork's `main` with the templated body, `Alexey-Popov` requested as reviewer, labels `homework-2` and `ready-for-review`.
