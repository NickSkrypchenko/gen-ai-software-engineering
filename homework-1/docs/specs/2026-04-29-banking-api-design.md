# Banking Transactions API — Design Specification

**Project:** Homework 1 — Banking Transactions API
**Course:** GenAI and Agentic AI for Software Engineering
**Author:** Nicko (drafted with Claude)
**Date:** 2026-04-29
**Status:** Approved for implementation
**Implementation driver:** Claude Code

---

## 0. Purpose & scope

This document is the implementation contract for Homework 1. Claude Code is the implementation driver and consumes this spec as authoritative input to produce the deliverables required by `homework-1/TASKS.md` and the submission rules in the repository's top-level `README.md`.

**In scope.** A Node.js + Express + TypeScript REST API for banking transactions, an in-memory data store, validation, filtered transaction history, two optional features (account summary, CSV export), a static dashboard and branded API-docs landing page, a full test pyramid (unit + integration + Postman end-to-end), an OpenAPI 3.1 document generated from the source schemas, code review via `/codex:review`, visual design via `/high-end-visual-design`, API testing via the Postman MCP connector, and deployment to `www.here.now` via the `/here-now` skill.

**Out of scope.** Persistence (no DB), authentication or authorization, multi-tenant accounts, currency conversion, async settlement workers, rate limiting, two-phase commit semantics, production-grade money types, CI configuration. These are explicitly noted to keep the build focused on the rubric.

**Non-goals.** Concurrency safety beyond what Node's single-threaded run-to-completion provides, horizontal scaling, observability beyond JSON request logs.

---

## 1. Architectural approach

**Approach A — Layered.** One Node.js process. Code is organized as `routes → controllers → services → repository`, with `validators/` and `models/` as siblings and `middleware/` + `utils/` for cross-cutting concerns. Each layer has one job and one set of dependencies. The repository is the only thing that mutates state. Services are pure business logic and unit-testable without HTTP. Controllers stay thin so PR review focuses on logic.

**Single deployable.** Express serves both `/api/*` (the JSON REST API) and `/` (the static dashboard + branded docs page) from the same port. One `npm run dev`, one process, one Dockerfile.

**TypeScript end-to-end.** Backend and frontend share types. Zod schemas in the backend produce both runtime validators and TypeScript types via `z.infer`; the frontend imports those types directly so request and response shapes are guaranteed identical on both sides.

**In-memory storage.** A `Map<id, Transaction>` wrapped by `TransactionRepository`, with a secondary `byAccount` index for query performance. State is lost on restart; this is acceptable per the brief and is called out in `README.md`.

---

## 2. Module map

```
homework-1/
├── src/
│   ├── index.ts                  # bootstrap: load env, build app, listen
│   ├── app.ts                    # createApp() — composes middleware + routes (testable)
│   ├── config.ts                 # env parsing (PORT, NODE_ENV, SEED, CORS_ORIGIN, LOG_LEVEL)
│   ├── routes/
│   │   ├── transactions.routes.ts
│   │   ├── accounts.routes.ts
│   │   └── health.routes.ts
│   ├── controllers/
│   │   ├── transactions.controller.ts
│   │   └── accounts.controller.ts
│   ├── services/
│   │   ├── transactions.service.ts   # create, settle, list (with filters), getById
│   │   ├── accounts.service.ts       # balance, summary
│   │   └── export.service.ts         # CSV serialization
│   ├── repository/
│   │   └── transaction.repository.ts # Map-backed; sole owner of mutation
│   ├── validators/
│   │   ├── transaction.schemas.ts    # Zod: CreateTransaction, ListFilters
│   │   └── common.schemas.ts         # AccountId, Currency, Money, FailureReason
│   ├── models/
│   │   └── transaction.types.ts      # types from z.infer; re-exported for the frontend
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   └── validate.ts               # generic Zod request validator
│   ├── utils/
│   │   ├── http-errors.ts            # ValidationError, NotFoundError, ConflictError
│   │   ├── clock.ts                  # injectable now() — tests pass a fake
│   │   ├── money.ts                  # Money namespace: parse, add, format
│   │   └── logger.ts                 # pino, JSON logs
│   └── styles.css                    # Tailwind input
├── public/
│   ├── index.html                    # branded landing + docs page
│   ├── dashboard.html
│   ├── css/
│   │   └── tailwind.css              # built from src/styles.css
│   ├── js/
│   │   ├── api-client.ts
│   │   ├── components/
│   │   │   ├── tx-table.ts
│   │   │   ├── balance-card.ts
│   │   │   └── tx-form.ts
│   │   ├── dashboard.ts
│   │   └── docs.ts
│   └── assets/                       # logo, og image, favicons
├── tests/
│   └── integration/                  # supertest-based
└── scripts/
    ├── generate-openapi.ts           # Zod → OpenAPI 3.1
    └── postman-sync.ts               # Postman MCP wiring
```

**Request lifecycle:** `route → validate(zodSchema) middleware → controller → service → repository → service → controller → JSON response`. Errors throw typed `HttpError` subclasses; the error-handler middleware maps them to status + body.

---

## 3. API contract

All endpoints are mounted under `/api`. Responses are JSON unless noted. Every response includes an `x-request-id` header that mirrors the request's `x-request-id` (or one generated server-side if absent).

### 3.1 Transaction resource

```jsonc
{
  "id": "txn_01HXYZ...",            // ULID, generated server-side; pattern: ^txn_[0-9A-HJKMNP-TV-Z]{26}$
  "fromAccount": "ACC-12345",       // pattern: ^ACC-[A-Z0-9]{5}$ (or sentinel "EXTERNAL")
  "toAccount":   "ACC-67890",       // same pattern
  "amount":      100.50,            // positive number, max 2 decimal places, ≤ MAX_AMOUNT
  "currency":    "USD",             // ISO 4217, whitelisted
  "type":        "transfer",        // "deposit" | "withdrawal" | "transfer"
  "timestamp":   "2026-04-29T10:15:30.000Z",  // server-assigned ISO 8601, UTC
  "status":      "completed",       // "completed" | "failed" — see §3.4
  "failureReason": null             // null | "INSUFFICIENT_FUNDS"; only set when status="failed"
}
```

### 3.2 Endpoints

| Method | Path | Success | Notes |
|---|---|---|---|
| `POST` | `/api/transactions` | `201` + `Transaction` | Body validated against `CreateTransactionSchema`. Server assigns `id`, `timestamp`, `status`, `failureReason`. Body containing any of those fields is rejected (`strict()` schema). |
| `GET`  | `/api/transactions` | `200` + `{ data: Transaction[], count: number }` | Filters via query: `accountId`, `type`, `from` (ISO date), `to` (ISO date). Filters AND-combine. `accountId` matches either `fromAccount` or `toAccount`, **with one exception: `failed` transactions are visible only to their `fromAccount`** (the initiating side). The counterparty never sees a row that didn't actually move money. Sorted by `timestamp` descending. |
| `GET`  | `/api/transactions/:id` | `200` + `Transaction` / `404` | |
| `GET`  | `/api/transactions/export?format=csv` | `200` `text/csv` | Same filter set as list (visibility rule applies). `Content-Disposition: attachment; filename="transactions-<ISO>.csv"`. RFC 4180 quoting. Header row included. |
| `GET`  | `/api/accounts/:accountId/balance` | `200` + balance | `{ accountId, balances: [{ currency, amount }], asOf }`. One entry per currency the account has completed transactions in. **Always `200` for any well-formed `accountId`** (no account registry); returns `balances: []` when no completed transactions exist for that account. `400` only if `accountId` fails the `ACC-XXXXX` regex. |
| `GET`  | `/api/accounts/:accountId/summary` | `200` + summary | `{ accountId, perCurrency: [{ currency, totalDeposits, totalWithdrawals, transactionCount, lastTransactionAt }] }`. `transactionCount` includes both `completed` and `failed` rows referencing this account (subject to the visibility rule); `totalDeposits` and `totalWithdrawals` include `completed` rows only. Same "always 200 for well-formed accountId" semantics as balance — returns `perCurrency: []` for accounts with no transactions. |
| `GET`  | `/health` | `200` + `{ status: "ok", uptime, version }` | Mounted outside `/api` so platform health probes don't need the prefix. |

### 3.3 Per-type semantics

- **`deposit`** — `toAccount` must be a real `ACC-XXXXX`; `fromAccount` must be `"EXTERNAL"` (whitelisted sentinel).
- **`withdrawal`** — `fromAccount` must be a real `ACC-XXXXX`; `toAccount` must be `"EXTERNAL"`.
- **`transfer`** — both must be real `ACC-XXXXX` and must differ.

Enforced at create time via Zod `superRefine`. Documented on the API docs page.

### 3.4 Settlement model — `pending → completed | failed` (synchronous)

Inside the `POST /api/transactions` handler:

1. Validate input. On failure: `400` with the uniform validation error.
2. Repository inserts the transaction with `status: "pending"`. ID and timestamp assigned.
3. `transactions.service.settle()` runs the business rules **inside a try/catch**:
   - Deposits always succeed.
   - Withdrawals require `balance(fromAccount, currency) ≥ amount`.
   - Transfers require `balance(fromAccount, currency) ≥ amount`.
4. On success: repository transitions the row to `completed`. On any non-success path — explicit business-rule failure **or any thrown error** — repository transitions to `failed` with `failureReason: "INSUFFICIENT_FUNDS"`. Thrown errors are logged via `logger.error` with the request id and the original stack so they aren't silently swallowed. **A row never remains in `pending`** once the handler exits.
5. Response is `201` with the terminal-state transaction. **Clients never observe `pending`.**

**Failure-reason taxonomy (v1).** `INSUFFICIENT_FUNDS` is the only enum value; it serves as both the explicit balance-check failure and the catch-all for unexpected exceptions. The trade-off — losing the distinction between "balance check failed" and "code threw" — is acceptable at v1 because there's only one normal failure mode and unexpected exceptions are rare and observable in logs. A future version can widen `FailureReason` to include `INTERNAL_ERROR` / `INVALID_STATE` if real failure modes emerge (logged in §9 future work).

**HTTP success ≠ business success.** A `201` with `status: "failed"` means the request was accepted and recorded; the business operation did not settle. This matches Stripe-style payment-intent semantics. Documented prominently on the docs page and in the `README`.

**Concurrency note.** Node's single-threaded run-to-completion guarantees no interleaving between the balance read and the status write inside one handler. No locking required at v1 scale.

### 3.5 Error format (uniform)

```jsonc
{
  "error":     "Validation failed",
  "code":      "VALIDATION_ERROR",   // VALIDATION_ERROR | NOT_FOUND | UNSUPPORTED_MEDIA_TYPE | INTERNAL
  "details": [
    { "field": "amount",   "message": "Amount must be a positive number" },
    { "field": "currency", "message": "Invalid currency code" }
  ],
  "requestId": "req_..."
}
```

`details[]` is always present for `VALIDATION_ERROR`; absent or empty for others. `requestId` is always present.

### 3.6 Status codes

`200` reads, `201` creates, `400` validation, `404` not found, `415` wrong content-type on POST, `500` unexpected. No `429` (rate limiting is out of scope).

### 3.7 v1 simplifications (called out in README)

- `status` resolves to `completed` or `failed` synchronously; `pending` is never observable through the API.
- Failed transactions persist and appear in `GET /transactions` results **for the initiating account only** (the counterparty doesn't see a row that didn't move money). They are excluded from balance math and from `totalDeposits`/`totalWithdrawals` in summaries; they are included in `summary.transactionCount` for the initiator.
- Transfers settle atomically within a single handler — no two-phase commit.
- Currency conversion is not performed; balances are reported per currency.

---

## 4. Data layer & validation

### 4.1 Repository

```ts
class TransactionRepository {
  private byId = new Map<string, Transaction>();
  private byAccount = new Map<string, Set<string>>();  // accountId → txn ids

  create(input: CreateTransactionInput, id: string, timestamp: Date): Transaction;  // status: "pending"
  markCompleted(id: string): Transaction;
  markFailed(id: string, reason: FailureReason): Transaction;
  getById(id: string): Transaction | undefined;
  list(filters: ListFilters): Transaction[];
  bulkLoad(transactions: Transaction[]): void;  // seeding/tests only
}
```

The `byAccount` index keeps list/balance/summary queries O(matching) instead of O(all). It is updated during `create` only; transitions don't touch it.

**`list(filters)` visibility rule.** When iterating candidates, any transaction with `status === 'failed'` is included only if its `fromAccount` equals the requested `accountId` (when an `accountId` filter is supplied). When no `accountId` filter is supplied, failed transactions are always returned (admin/debug view; the dashboard never calls without an `accountId` for production-style use). Concretely:

```ts
// inside list(filters), per-row predicate
if (txn.status === 'failed' && filters.accountId && txn.fromAccount !== filters.accountId) {
  return false;  // counterparty doesn't see failed rows
}
```

### 4.2 IDs and time

- **IDs:** ULID via the `ulid` package, prefixed `txn_`. Sortable by time, URL-safe, monotonic within a process.
- **Time:** all timestamp generation goes through `utils/clock.ts` (`now(): Date`). Production uses `new Date()`; tests inject a fake. Services never call `Date` directly.

### 4.3 Money

Stored as `number` (sufficient for homework scope). Every read/write goes through the `Money` namespace in `utils/money.ts`:

- `Money.parse(input)` — validates positivity, finiteness, **upper bound (`MAX_AMOUNT = 1_000_000`)**, and ≤ 2 decimal places via Zod refinement.
- `Money.add(a, b)` — rounds to cents (`Math.round((a + b) * 100) / 100`) to avoid float drift in summaries.
- `Money.format(amount, currency)` — `Intl.NumberFormat` for display (used by frontend and CSV).

`MAX_AMOUNT` also protects summary aggregates from float-precision degradation across many transactions on a single account.

**Documented limitation:** `number` is not safe for production money math. A real system uses integer minor units or `decimal.js`. Stated in README under "Out of scope / future work."

### 4.4 Zod schemas (single source of truth)

```ts
// validators/common.schemas.ts
export const AccountId = z.string().regex(/^ACC-[A-Z0-9]{5}$/,
  'Account must match ACC-XXXXX (5 uppercase alphanumeric)');
export const ExternalAccount = z.literal('EXTERNAL');
export const AccountIdOrExternal = z.union([AccountId, ExternalAccount]);

export const CURRENCY_CODES = ['USD','EUR','GBP','JPY','CHF','CAD','AUD','SEK','NOK','DKK','PLN','CZK'] as const;
export const Currency = z.enum(CURRENCY_CODES);

export const MAX_AMOUNT = 1_000_000;  // hard upper bound; protects float precision and rejects absurd values
export const Money = z.number()
  .positive('Amount must be a positive number')
  .refine(Number.isFinite, 'Amount must be finite')
  .refine(n => n <= MAX_AMOUNT, `Amount must not exceed ${MAX_AMOUNT}`)
  .refine(n => Math.round(n * 100) === n * 100, 'Amount supports max 2 decimal places');

export const FailureReason = z.enum(['INSUFFICIENT_FUNDS']);

// validators/transaction.schemas.ts
export const CreateTransactionSchema = z.object({
  fromAccount: AccountIdOrExternal,
  toAccount:   AccountIdOrExternal,
  amount:      Money,
  currency:    Currency,
  type:        z.enum(['deposit','withdrawal','transfer']),
}).strict()
  .superRefine((v, ctx) => {
    if (v.type === 'transfer' && v.fromAccount === v.toAccount)
      ctx.addIssue({ path: ['toAccount'], code: 'custom', message: 'Transfer accounts must differ' });
    if (v.type === 'deposit' && v.fromAccount !== 'EXTERNAL')
      ctx.addIssue({ path: ['fromAccount'], code: 'custom', message: 'Deposit must originate from EXTERNAL' });
    if (v.type === 'withdrawal' && v.toAccount !== 'EXTERNAL')
      ctx.addIssue({ path: ['toAccount'], code: 'custom', message: 'Withdrawal must target EXTERNAL' });
  });

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

export const ListFiltersSchema = z.object({
  accountId: AccountId.optional(),
  type:      z.enum(['deposit','withdrawal','transfer']).optional(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
}).refine(v => !(v.from && v.to) || v.from <= v.to,
  { message: 'from must be <= to', path: ['to'] });
```

### 4.5 Validation middleware

`middleware/validate.ts` exports `validate({ body?, query?, params? })`. On Zod failure it maps the issue list into `details: [{field, message}]` and calls `next(new ValidationError(details))`. The error-handler middleware turns that into the uniform error response.

### 4.6 Seed data

`demo/sample-data.json` contains ~10 transactions across 3 accounts and 2 currencies. Loaded only when `SEED=1`, via `repository.bulkLoad()`. Production code paths never read seed files.

---

## 5. Dashboard & branded docs page

### 5.1 Routes & purpose

- `/` — **branded landing + API docs**, the public face at `www.here.now`. Hero section, "Live demo" CTA → `/dashboard`, "Read the spec" → in-page docs. Endpoints rendered as cards: method pill, path, description, request schema, response example, "Try it" button that fires the call against the running API and renders the live JSON inline. **Hand-rolled HTML, not Swagger UI.**
- `/dashboard` — **operator dashboard.** Three panes:
  - *Left:* account picker (dropdown of distinct accounts seen in transactions) → live balance card per currency, summary card (deposits, withdrawals, count, last activity).
  - *Right:* transaction table — sortable, filterable (account, type, date range mirrors API filters), with "Export CSV" button calling `/api/transactions/export` with current filters. Failed rows show a red badge and tooltip with `failureReason`.
  - *Top:* "New transaction" form — 5 fields, client-side Zod-mirror validation with inline errors, submits to `POST /api/transactions`. On `201` with `status: "failed"`, surfaces the `failureReason` as a non-blocking warning (the request succeeded; the transaction did not).

### 5.2 Build & shape

No JS framework. Vanilla TypeScript bundled by **esbuild** to one file per page. Tailwind compiled via `tailwindcss` CLI to `public/css/tailwind.css`. No CDNs in production.

```
public/
├── index.html              # landing + docs
├── dashboard.html
├── css/tailwind.css        # built
├── js/
│   ├── api-client.ts       # typed wrapper around fetch
│   ├── components/
│   │   ├── tx-table.ts
│   │   ├── balance-card.ts
│   │   └── tx-form.ts
│   ├── dashboard.ts        # entry: composes components, wires to api-client
│   └── docs.ts             # entry: docs "Try it" handlers
└── assets/                 # logo, og image, favicons
```

### 5.3 Type sharing

The backend exports a `models/transaction.types.ts` re-exporting `z.infer`-derived types. The frontend imports those types directly. Two separate `tsconfig` files (`tsconfig.server.json` for `src/**`, `tsconfig.web.json` for `public/js/**`) reference a shared base. Single source of truth, no duplicated types.

### 5.4 State

All dashboard state lives in URL search params (filters, selected account). No `localStorage`, no cookies. URL-shareable views; reload-safe.

### 5.5 Responsive & accessibility

- Mobile-first. Transaction table degrades to stacked cards under `md`.
- Keyboard navigation for all interactive elements, including docs "Try it" buttons.
- Form labels via `<label for>`, errors via `aria-describedby`.
- WCAG AA contrast — enforced by the design skill's defaults.

### 5.6 `/high-end-visual-design` integration

The visual layer is produced by the `/high-end-visual-design` skill, fed `docs/specs/wireframes.md` + `docs/specs/visual-brief.md`. The brief constrains the skill's output:

> Build the visual treatment for two pages of a banking transactions API: a public landing/docs page (`/`) and an operator dashboard (`/dashboard`). Brand: confident, calm, financial-but-modern (think Mercury / Stripe Press, not Wells Fargo). Required components: hero, endpoint cards, transaction table, balance card, summary stats, transaction form, navigation, footer. Wireframes for layout are in `docs/specs/wireframes.md`. Output: Tailwind classes, custom CSS where Tailwind is insufficient, motion specs for hover/loading/success states.

The skill produces the actual classes and any custom CSS. The spec defines components and required states; the skill chooses how to express them visually.

---

## 6. Testing strategy

Four layers, each with one job. None duplicates another.

### 6.1 Layer 1 — unit tests (Vitest)

Pure functions, no Express. Each service tested with a fresh in-memory repo and a fake clock. Colocated with units (`src/**/*.test.ts`).

Required cases:

- `transactions.service.settle`: happy paths for each type; `INSUFFICIENT_FUNDS` for withdrawal/transfer; multi-currency balance correctness (USD withdrawal cannot be paid by an EUR balance); **try/catch fallback** — if `accounts.service.balance` (or any settle-path call) throws, the row transitions to `failed` with `INSUFFICIENT_FUNDS` and the error is logged (asserted via spy on `logger.error`); never remains `pending`.
- `repository.list`: **failed-transaction visibility filter** — a failed transfer from `ACC-AAAAA` to `ACC-BBBBB` is returned when filtering by `accountId=ACC-AAAAA` (initiator) and is *not* returned when filtering by `accountId=ACC-BBBBB` (counterparty); is returned when no `accountId` filter is supplied.
- `accounts.service`: balance excludes `failed` rows; summary `transactionCount` includes failed rows while totals exclude them; both return empty arrays (not 404) for accounts with no transactions; multi-currency aggregation is computed per currency independently.
- `validators`: every Zod schema gets at least one happy + one failure case per rule, with the resulting `details[]` shape asserted.
- `Money` namespace: rejects 3-decimal numbers, rejects `Infinity`/`NaN`, rejects amounts > `MAX_AMOUNT` and at the `MAX_AMOUNT + 0.01` boundary, accepts exactly `MAX_AMOUNT`, sums without float drift across 1000 random small values.
- `export.service`: CSV header order, RFC 4180 quoting (commas, quotes, newlines defended even though regex disallows them in account ids).

**Coverage threshold:** ≥80% lines overall, ≥85% on `services/` and `validators/`. Below threshold = red.

### 6.2 Layer 2 — HTTP integration (Vitest + supertest)

Full Express app from `createApp()`, real routes, real validation, in-memory repo. Tests the wiring — that schemas, controllers, and middleware actually compose. A fresh app per test file.

```
tests/integration/
├── transactions.test.ts          # POST + GET + filters + 404 + validation 400
├── accounts.test.ts              # balance + summary edge cases (multi-currency, empty)
├── export.test.ts                # CSV download, content-type, content-disposition
└── error-handling.test.ts        # uniform error shape, requestId presence
```

### 6.3 Layer 3 — End-to-end via Postman MCP

Black-box tests against a *running* server. Workflow Claude Code drives:

1. Generate **OpenAPI 3.1** from Zod schemas at build time using `zod-to-openapi`. Output: `docs/openapi.yaml`. Single source of truth: schemas → OpenAPI → docs page → Postman collection.
2. Use **Postman MCP** to create or reuse a workspace named `Banking Transactions API — homework-1`. Push `docs/openapi.yaml` as a spec; generate a collection from it.
3. Add scripted tests to the collection — one folder per endpoint, each request asserting status code, response shape, and key invariants (balance equals expected, CSV row count matches filter, validation error has `details[]`).
4. Export the finalized collection to `demo/postman-collection.json` so reviewers can import it without an MCP setup.
5. `npm run test:e2e` runs Newman against the local server, producing a JUnit-format report in `docs/screenshots/postman-report.html`.

Coverage: smoke (server up), CRUD happy path, every validation rule from Layer 1 re-asserted at the wire level, multi-currency balance, CSV export round-trip, 404 paths. ~25 requests total.

### 6.4 Layer 4 — `demo/sample-requests.http`

Hand-curated, ~10 calls a human can run top-to-bottom in 30 seconds. REST Client format (works in VS Code's REST Client extension and convertible to curl). This is the "instructor opens the repo and runs it" path — distinct from the exhaustive Postman collection.

### 6.5 What's not tested (called out in README)

Load testing, security/pen testing, CSV import (only export is in scope), concurrent-request safety beyond what Node's run-to-completion provides. Each item explicit under "Out of scope / future work."

### 6.6 CI script

`npm test` runs Layers 1 + 2. Layer 3 (Postman) requires a live server and is run via `npm run test:e2e` after `npm run dev`. Pre-deploy check from `/here-now` runs `npm test && npm run test:e2e`.

---

## 7. AI workflow integration

The spec is opinionated about *when* each AI tool runs and *what* it consumes/produces. This both drives the build and produces the evidence required by the homework's "AI Usage Documentation (25%)" rubric line.

### 7.1 Phase pipeline

| # | Phase | Driver | Inputs | Outputs | Exit criteria |
|---|---|---|---|---|---|
| 0 | Scaffold | Claude Code | This spec | `package.json`, `tsconfig.*`, folder skeleton, `.gitignore`, empty `app.ts`/`index.ts` | `npm run dev` boots an empty Express on port 3000; `/health` returns 200 |
| 1 | Backend — domain & validation | Claude Code | §3 + §4 | `validators/`, `models/`, `repository/`, `services/` with unit tests | Layer 1 tests green at ≥80% coverage |
| 2 | Backend — HTTP layer | Claude Code | §3 | `routes/`, `controllers/`, `middleware/`, integration tests | Layer 2 tests green; manual `curl` against every endpoint matches the contract |
| 3 | OpenAPI + Postman wiring | Claude Code + **Postman MCP** | Zod schemas | `docs/openapi.yaml`, Postman MCP workspace + collection, `demo/postman-collection.json`, `npm run test:e2e` | Newman runs the full collection green against `npm run dev` |
| 4 | Frontend — wireframes & visual brief | Claude Code | §5 | `docs/specs/wireframes.md`, `docs/specs/visual-brief.md` | User-approved wireframes (text/ASCII acceptable) |
| 5 | Frontend — visual design | **/high-end-visual-design** | Visual brief + wireframes | `public/index.html`, `public/dashboard.html`, `public/css/`, `public/js/components/` styled and ready | Both pages render correctly against running API; mobile + desktop screenshots captured |
| 6 | AI usage log — **finalize** | Claude Code | Conversation history + appended notes from earlier phases | `docs/AI-USAGE.md` consolidated and proofread | File covers every phase, including any rework forced by Phase 7 |
| 7 | Code review | **/codex:review** | Whole branch diff vs `main` | `docs/reviews/codex-review-<date>.md` | All blocking comments addressed or explicitly waived with rationale |
| 8a | Screenshots & demo (pre-deploy) | Claude Code | Running app + Postman | All `docs/screenshots/*.png` **except** `here-now-deployed.png` | Pre-deploy screenshots present per §8.1 |
| 8b | Deploy screenshot (post-deploy) | Claude Code | Live `www.here.now` | `docs/screenshots/here-now-deployed.png` | Captured after Phase 10 succeeds |
| 9 | Docs finalization | Claude Code | Everything above | `homework-1/README.md`, `homework-1/HOWTORUN.md` populated | Both docs render correctly on GitHub; HOWTORUN runnable cold |
| 10 | Deploy | **/here-now** | Built artifact | Live site at `www.here.now` | `curl https://www.here.now/health` → 200; dashboard loads; Postman collection passes against prod URL |
| 11 | PR | Claude Code | All commits | PR opened from `homework-1-submission` against the fork's `main`, body templated per repo `README.md §1.2` | PR description has summary + AI tools + challenges + screenshots; reviewer `Alexey-Popov` requested |

### 7.2 Phase ordering rules (enforced by the spec)

- **`docs/AI-USAGE.md` is a living document, not a Phase-6 one-shot.** Append a section after every code-producing phase (0, 1, 2, 3, 5, 7) so prompts, outcomes, and decisions are captured while they're fresh. Phase 6 is the *consolidation* pass: re-read, deduplicate, fix references, and add the decisions log. Phase 7 (`/codex:review`) often forces edits that invalidate notes from earlier phases — those updates land in AI-USAGE.md as part of addressing the review.
- **Phases 1–2 must complete before Phase 3.** OpenAPI is generated from finalized Zod schemas; regenerating it later is fine, but Postman wiring shouldn't precede a stable contract.
- **Phase 5 (`/high-end-visual-design`) blocks on Phase 4 (visual brief).** Skipping the brief means the design skill has no constraints to honor.
- **Phase 7 (`/codex:review`) runs after every other code-producing phase.** Re-runs allowed if Phase 5 produced significant frontend code; otherwise one pass.
- **Phase 8 screenshot timing.** Every screenshot in §8.1 except `here-now-deployed.png` is captured at Phase 8a (after Phase 5 produces the dashboard). `here-now-deployed.png` is captured at Phase 8b — after Phase 10 completes.
- **Phase 10 (`/here-now`) blocks on Phase 7 being clean** and on `npm run test:e2e` green against the local build of the deploy artifact.

### 7.3 `/codex:review` brief (`docs/specs/review-brief.md`)

> Review this banking transactions API for a homework submission graded on functionality, AI-usage documentation, code quality, documentation, and demo. Focus on: (1) correctness of the `pending → completed | failed` settlement logic (especially the try/catch fallback path); (2) money math (any float-drift risks? `MAX_AMOUNT` enforcement?); (3) Zod schema completeness vs the API contract in `docs/specs/2026-04-29-banking-api-design.md`; (4) error-handler uniformity across all routes; (5) test coverage of edge cases (multi-currency balance, CSV quoting, transfer where from = to, failed-transaction visibility filter). Out of scope: production-grade money types, persistence, auth, scaling. Output as `docs/reviews/codex-review-<date>.md` with severity-tagged findings.

### 7.4 Postman MCP responsibilities

The spec does not pin tool names; it defines what the integration must do.

- Create or reuse a workspace named `Banking Transactions API — homework-1`.
- Push `docs/openapi.yaml` as a spec; generate a collection from it; add scripted tests per §6.3.
- After each backend change that touches a schema or route, regenerate the collection from the updated OpenAPI and re-run it against `npm run dev`.
- Export the final collection JSON to `demo/postman-collection.json`.

### 7.5 `docs/AI-USAGE.md` template

```
# AI Tools — Usage Log

## Phase 0: Scaffold
Tool: Claude Code
Prompt: <verbatim>
Outcome: <accepted | edited | rejected>
What I changed and why: <one paragraph>

## Phase 1: Backend domain & validation
Tool: Claude Code
Prompt: ...
[one entry per phase, including /high-end-visual-design, /codex:review,
 Postman MCP, and /here-now invocations]

## Decisions log
- Settled on `pending → completed|failed` synchronously (rather than always-completed) because <…>
- Chose Zod over Joi because <…>
- Rejected localStorage in dashboard because <…>
- Failed transactions visible only to initiator because <…>
```

### 7.6 What the spec does *not* prescribe

- No verbatim prompts for Phases 1/2/4. Claude Code authors them in-flight; the spec defines inputs (this document) and exit criteria (tests green, contract matches).
- No mocking of `/here-now` behavior. The skill is opaque from this spec's perspective.
- No CI configuration. Local + skill-driven deploy is sufficient for homework. Logged as future work.

---

## 8. Deliverables & repo conventions

### 8.1 Final file tree

```
homework-1/
├── README.md                       # Overview, features, architecture, decisions, AI tools
├── HOWTORUN.md                     # Cold-start: clone → run → test → seed → docs
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.server.json
├── tsconfig.web.json
├── .gitignore
├── .env.example
├── .nvmrc
├── vitest.config.ts
├── tailwind.config.ts
├── esbuild.config.mjs
├── Dockerfile
│
├── src/                            # see §2
├── public/                         # see §5
├── tests/integration/              # see §6.2
├── scripts/
│   ├── generate-openapi.ts
│   └── postman-sync.ts
│
├── docs/
│   ├── openapi.yaml                # generated
│   ├── AI-USAGE.md
│   ├── specs/
│   │   ├── 2026-04-29-banking-api-design.md   # this file
│   │   ├── claude-code-kickoff-prompt.md
│   │   ├── wireframes.md
│   │   ├── visual-brief.md
│   │   └── review-brief.md
│   ├── reviews/
│   │   └── codex-review-2026-04-29.md
│   └── screenshots/
│       ├── ai-prompt-claude-code.png
│       ├── ai-prompt-visual-design.png
│       ├── ai-prompt-codex-review.png
│       ├── api-running.png
│       ├── dashboard-desktop.png
│       ├── dashboard-mobile.png
│       ├── postman-collection-pass.png
│       ├── sample-curl-output.png
│       └── here-now-deployed.png   # captured at Phase 8b, after Phase 10
│
└── demo/
    ├── run.sh                      # ./run.sh [dev|test|seed|e2e]
    ├── run.bat                     # Windows mirror
    ├── sample-requests.http        # ~10 hand-curated calls
    ├── sample-data.json
    └── postman-collection.json
```

### 8.2 `package.json` scripts (contract)

```jsonc
{
  "scripts": {
    "dev":         "concurrently -n api,web 'tsx watch src/index.ts' 'node esbuild.config.mjs --watch'",
    "build":       "tsc -p tsconfig.server.json && node esbuild.config.mjs && tailwindcss -i src/styles.css -o public/css/tailwind.css --minify",
    "start":       "node dist/index.js",
    "test":        "vitest run --coverage",
    "test:watch":  "vitest",
    "test:e2e":    "newman run demo/postman-collection.json --env-var baseUrl=http://localhost:3000",
    "openapi":     "tsx scripts/generate-openapi.ts",
    "seed":        "SEED=1 npm run dev",
    "postman:sync":"tsx scripts/postman-sync.ts",
    "lint":        "eslint . --ext .ts",
    "typecheck":   "tsc --noEmit -p tsconfig.server.json && tsc --noEmit -p tsconfig.web.json"
  }
}
```

### 8.3 Environment

`.env.example`:

```
PORT=3000
NODE_ENV=development
SEED=0
CORS_ORIGIN=*
LOG_LEVEL=info
```

Node version pinned via `.nvmrc` (LTS, e.g. `20`); `engines.node` in `package.json` matches. No secrets in repo. `/here-now` consumes deploy credentials from its own configured store.

### 8.4 Repo conventions

- **Branch:** `homework-1-submission` (already created).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). One logical change per commit. Phase boundaries from §7.1 are natural commit boundaries.
- **PR target:** the *fork's* `main` (per the repo's `README.md §1.2`, not upstream).
- **Reviewer:** `Alexey-Popov`.
- **Labels:** `homework-1`, `ready-for-review`.
- **PR template** lives at `.github/PULL_REQUEST_TEMPLATE.md` and contains:

```
## Summary
<what was implemented, in prose, ~150 words>

## AI tools used
| Phase | Tool | Outcome |
|---|---|---|
| Backend domain | Claude Code | accepted, minor edits to Money refinement |
| Visual design | /high-end-visual-design | accepted; tweaked spacing on tx-table |
| Code review | /codex:review | 4 findings, 4 addressed |
| API testing | Postman MCP | 24/24 green |
| Deploy | /here-now | live at www.here.now |

## How to verify
1. `git checkout homework-1-submission && cd homework-1`
2. `npm i && cp .env.example .env`
3. `npm run dev` → http://localhost:3000
4. `npm run test` (unit + integration)
5. `npm run test:e2e` (Postman/Newman)
6. Live: https://www.here.now

## Challenges
<bullets, 2–4 items, honest>

## Screenshots
<embed dashboard-desktop.png, postman-collection-pass.png, here-now-deployed.png inline; link the rest>
```

### 8.5 Grading-rubric mapping

| Rubric line | Weight | Where it lives |
|---|---|---|
| Functionality | 30% | `src/`, integration tests, Postman pass |
| AI Usage Documentation | 25% | `docs/AI-USAGE.md`, `docs/specs/*-brief.md`, `docs/reviews/`, AI-prompt screenshots |
| Code Quality | 20% | Layered structure, Zod single-source-of-truth, ≥80% coverage, `/codex:review` clean |
| Documentation | 15% | `README.md`, `HOWTORUN.md`, `docs/openapi.yaml`, OpenAPI-driven docs page |
| Demo & Screenshots | 10% | `demo/`, `docs/screenshots/`, live `www.here.now` URL in PR body |

---

## 9. Open questions / future work

Stated in `README.md` under "Future work":

- Persistence (Postgres + Drizzle/Prisma).
- Authentication (API key per account holder).
- Concurrency safety beyond single-process Node (locking/optimistic concurrency).
- Production-grade money types (integer minor units or `decimal.js`).
- Currency conversion for cross-currency transfers.
- Async settlement workers and `pending` state visibility.
- CSV import counterpart to export.
- Rate limiting middleware.
- Widen `FailureReason` to distinguish balance-check failures (`INSUFFICIENT_FUNDS`) from unexpected exceptions (`INTERNAL_ERROR`) — currently collapsed to a single value (see §3.4 trade-off).
- CI pipeline (GitHub Actions running `npm test` + `npm run test:e2e`).

---

## 10. Acceptance checklist

The implementation is complete when **all** of the following are true:

- [ ] `npm run dev` boots and serves both `/api/*` and `/`, `/dashboard` from port 3000.
- [ ] All endpoints in §3.2 are implemented and conform to the contract.
- [ ] `npm test` passes with ≥80% line coverage overall, ≥85% on `services/` and `validators/`.
- [ ] `npm run test:e2e` passes against the running server (Newman, full Postman collection).
- [ ] `demo/sample-requests.http` runs top-to-bottom against a fresh server without errors (manual smoke).
- [ ] `SEED=1 npm run dev` loads `demo/sample-data.json` cleanly; `GET /api/transactions` returns the seeded rows.
- [ ] `docs/openapi.yaml` is current and matches the running API.
- [ ] `public/index.html` and `public/dashboard.html` render correctly on desktop and mobile, styled by `/high-end-visual-design` output.
- [ ] `docs/reviews/codex-review-<date>.md` exists with all blocking comments addressed.
- [ ] `docs/AI-USAGE.md` covers every phase from §7.1, with entries appended in real-time and consolidated in Phase 6.
- [ ] `docs/screenshots/` contains every artifact listed in §8.1 (`here-now-deployed.png` captured post-deploy per §7.2 Phase 8b).
- [ ] `homework-1/README.md` and `homework-1/HOWTORUN.md` are written and accurate; README documents that failed transactions are visible only to the initiating account.
- [ ] Site is live at `www.here.now`; `/health` returns 200; Postman collection passes against the prod URL.
- [ ] PR opened against the fork's `main` with the templated body and `Alexey-Popov` requested as reviewer.
