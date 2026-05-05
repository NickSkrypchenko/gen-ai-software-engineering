# AI Tools — Usage Log

> Living document — appended after each phase, consolidated in Phase 15.

---

## Context-Model-Prompt Summary Table

| Phase | Surface | Context | Model | Prompt strategy |
|---|---|---|---|---|
| 0 | Scaffold | Spec + repo state | Sonnet 4.6 | Imperative kickoff with explicit ground rules |
| 1 | Domain & validators | Spec §3-4 + Zod docs | Sonnet 4.6 | Phase-scoped: state machine + classifier + Zod schemas + unit tests |
| 2 | DB layer | Spec §2,4 + Drizzle + Neon docs | Sonnet 4.6 | Phase-scoped: schema + migrations + repositories with transactions |
| 3 | HTTP layer | Spec §3 + Phase 1-2 outputs | Sonnet 4.6 | Phase-scoped: routes/controllers/middleware + integration tests |
| 4 | Importers | Spec §4.5-4.7 + fixtures | Sonnet 4.6 | Phase-scoped: 3 importer modules with unified interface |
| 5 | OpenAPI + Postman | Zod schemas + zod-to-openapi docs | Sonnet 4.6 + Postman MCP | Tool orchestration |
| 6 | CI workflow | Spec §6.6 + GHA docs | Sonnet 4.6 | Single-file output: `.github/workflows/e2e.yml` |
| 7 | Wireframes + briefs | Spec §3-5 | Sonnet 4.6 | 4 markdown specs |
| 8 | Frontend visual | wireframes + visual-brief | /high-end-visual-design (skill) | Skill invocation |
| 9 | Performance | Running app + perf-brief | Sonnet 4.6 + autocannon | Tool orchestration + extract to markdown |
| 10 | Code review | Branch diff + review-brief | /codex:review (skill) | Skill invocation |
| 11a | ARCHITECTURE.md | Spec + final code structure | Opus 4.6 | Documentation prompt with Mermaid instructions |
| 11b | README.md | Spec + final repo + screenshots | Sonnet 4.6 | Standard repo README prompt |
| 11c | TESTING_GUIDE.md | Spec §6 + perf results + coverage | Sonnet 4.6 | Procedural documentation prompt |
| 11d | API_REFERENCE.md | docs/openapi.yaml | No LLM (Redoc) | `redoc-cli build` |
| 11e | HOWTORUN.md | Spec §8 + final scripts | Sonnet 4.6 | Cold-start runbook prompt |
| 12 | Pre-deploy screenshots | Running app | Sonnet 4.6 + Playwright MCP | Tool orchestration |
| 13 | Vercel deploy | Built app + spec §8 | /vercel:deploy (skill) | Skill invocation |
| 14 | Post-deploy screenshot | Live URL | Sonnet 4.6 + Playwright MCP | Tool orchestration |
| 15 | AI-USAGE + PR | Conversation + per-phase notes | Sonnet 4.6 | Editorial pass + PR composition |

---

## Phase 0: Scaffold

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- `docs/specs/2026-04-30-customer-support-api-design.md` — read end-to-end before any file creation
- `homework-2/TASKS.md` — brief requirements overview
- Repo top-level `README.md` — submission rules (PR to fork's main, Alexey-Popov reviewer)
- `.env` + `.env.test` — confirmed both have Neon URLs (dev + test branches)
- `.vercel/project.json` — confirmed Vercel project `customer-support-api` already linked

**Model:** claude-sonnet-4-6

**Prompt (verbatim kickoff prompt from user):**
> You are implementing Homework 2 — Intelligent Customer Support System as the implementation driver for this repo. [...] Step 0 — read the spec end-to-end before doing anything else. It is authoritative. [...] Once I confirm, execute Phase 0 (scaffold).

**Outcome:** accepted

**What changed and why:**
Created the full project skeleton matching spec §2 (module map) and §8.1 (file tree). All production config files written: `package.json` (all deps from spec §8.2), three `tsconfig` files (base/server/web), `vitest.config.ts`, `esbuild.config.mjs`, `tailwind.config.ts`, `drizzle.config.ts`, `vercel.json`. Core source files that make the dev server functional: `src/config.ts`, `src/utils/{logger,clock,http-errors}.ts`, `src/middleware/{request-id,error-handler}.ts`, `src/routes/health.routes.ts`, `src/app.ts`, `src/index.ts`, `api/index.ts`. All other `src/` files are typed stubs that will be filled in Phases 1-4. Domain files (`ticket.ts`, `classifier.ts`, `classifier-rules.ts`, `ticket-state-machine.ts`) contain their full implementation since they're pure functions needed by Phase 1 unit tests. Two deliberate spec deviations: (1) `"start"` script uses `node dist/src/index.js` instead of spec's `node dist/index.js` because `tsconfig.server.json` has `rootDir: "."` (to include both `src/` and `api/`), which places compiled output at `dist/src/index.js`; (2) `redoc-cli` replaced with `@redocly/cli` (upstream deprecated `redoc-cli`, no longer published).

---

## Phase 4: Importers

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §4.6 (Importer interface — `parse(Buffer): ImporterResult`, row-level errors)
- Spec §4.7 (fixture structure: csv/json/xml × valid/partial/malformed)
- Spec §3.5 (ImportSummary shape — total/succeeded/failed with stage labels, auto_classified)
- Spec §3.2 (POST /api/tickets/import — multipart, 5 MB limit, 1000 row max)
- Phase 3 outputs — classify.service.ts, ticketRepository.bulkInsert() already implemented

**Model:** claude-sonnet-4-6

**Prompt (verbatim):**
> Phase 4 — Importers. Implement csv.importer.ts (papaparse + unflattenRow + comma-split tags), json.importer.ts (root-array validation), xml.importer.ts (fast-xml-parser + isArray + unwrapTicket). Import service (parse → Zod validate → bulkInsert + optional classify). Import controller + routes (multer memoryStorage, 5 MB guard, ImportQuerySchema). Fixtures for all three formats. Unit + integration tests. Un-exclude from coverage.

**Outcome:** accepted (with two bug fixes)

**What changed and why:**
`csvImporter`: `unflattenRow()` splits dot-notation keys (`metadata.source`) into nested objects — ~15 LOC, no `flat` library. Tags: comma-separated string cell split and filtered. `papaparse` with `header: true` and `skipEmptyLines: true`.

`jsonImporter`: raw `JSON.parse` with `Array.isArray()` guard — whole-file failures produce a single `parseErrors` entry; per-row items passed through without validation (Zod step is downstream in service).

`xmlImporter`: `fast-xml-parser` with `isArray` callback keyed on `'tickets.ticket'` and `'tickets.ticket.tags.tag'`. `unwrapTicket()` normalises tags to `string[]`; handles `<tags/>` as `''` edge case that would otherwise fail Zod. **Bug found:** empty `<tags/>` element returned as `''` — fixed by explicitly mapping to `[]`.

`import.service`: parse → per-row Zod validation (collecting `stage: 'validate'` failures) → `ticketRepository.bulkInsert()` (per-row SAVEPOINTs) → optional `classifyService.autoClassify()` per inserted ticket. Returns `ImportSummary` matching spec §3.5.

**Bug found:** `auto_classify` query param coercion: `validate(ImportQuerySchema)` middleware coerces `'true'` string to boolean `true` via `z.coerce.boolean()`, but controller checked `=== 'true'` (string comparison). Fixed to `=== true || === 'true'`.

12 test fixtures, 18 unit tests, 10 HTTP integration tests. 212 tests total, 96.38% stmts — all thresholds pass.

---

## Phase 3: HTTP Layer

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §3.2 (all 9 endpoints, request/response shapes, status codes)
- Spec §3.3 (optimistic concurrency — If-Match / ETag contract, 428/412 error codes)
- Spec §3.4 (state machine transitions via service → domain → repository chain)
- Spec §4.3 (auto-classify: same transaction semantics for classify + ticket update)
- Phase 1/2 outputs — validators, domain functions, repository already implemented

**Model:** claude-sonnet-4-6

**Prompt (verbatim):**
> Phase 3 — HTTP layer. Implement validate.ts (generic Zod middleware), etag.ts (parseIfMatch + setETag), classify.service.ts (autoClassify in one transaction), tickets.service.ts (full orchestration), tickets.controller.ts (thin HTTP adapter), tickets.routes.ts (all 9 routes). Write integration tests using supertest covering every endpoint and all error paths (400/404/412/422/428). Un-exclude Phase 3 files from coverage config.

**Outcome:** accepted

**What changed and why:**
`validate.ts`: generic middleware that calls `schema.safeParse(req[target])`, maps Zod issues to `{ field, message }` and throws `ValidationError(400)`. Uses double-cast (`unknown → Record<string, unknown>`) to satisfy TypeScript's narrowing on `Request`.

`etag.ts`: `parseIfMatch` extracts the version integer from `If-Match: "N"` header (strips quotes), throws `PreconditionRequiredError(428)` if missing or malformed; attaches as `req.expectedVersion`. `setETag` writes `ETag: "N"` header on GET responses.

`classify.service.ts`: single `db.transaction()` — `SELECT FOR UPDATE` (lock + version check), `classify()` domain call, `INSERT INTO classifications`, `UPDATE tickets SET category/priority/version+1`. Returns `{ classification, ticket }`. Version conflict throws `VersionConflictError(412)`.

`tickets.service.ts`: thin orchestration. `transition()` calls `domainTransition()` first (throws `InvalidTransitionError(422)` if illegal, computes `resolved_at`), then `ticketRepository.transition()`. `create()` calls repository then optionally `classifyService.autoClassify()` when `auto_classify=true` query param present.

`tickets.controller.ts`: one try/catch per handler; accesses `req.expectedVersion` via type cast helper `ifMatchVersion(req)`. All mutating handlers use `setETag(res, ticket.version)` on success.

`tickets.routes.ts`: 9 routes registered with inline `validate()` and `parseIfMatch` middleware composition.

21 supertest integration tests covering full request/response cycle; all 184 tests pass. Coverage: 98.49% stmts / 81.5% branches / 95.16% fns — all above thresholds.

---

## Phase 2: Database Layer

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §2 (module map — db/schema, db/migrations, repository layer)
- Spec §4.1 (full DB schema: column types, constraints, CHECK clauses, indexes)
- Spec §4.2 (optimistic concurrency: version bump, SELECT FOR UPDATE)
- Spec §4.6 (bulk import: per-row SAVEPOINTs, partial success semantics)
- Drizzle ORM docs — `pgEnum`, `.for('update')`, `.returning()`, SQL template literals
- Neon serverless driver docs — HTTP vs WebSocket driver transaction support

**Model:** claude-sonnet-4-6

**Prompt (verbatim):**
> Phase 2 — DB layer. Implement the full Drizzle schema (src/db/schema.ts) with all columns, constraints, enums, and indexes from spec §4.1. Generate and apply migrations to both dev and test Neon branches. Implement the repository layer (ticket.repository.ts, transition.repository.ts, classification.repository.ts) with full CRUD, optimistic locking, status transitions, and bulkInsert with per-row SAVEPOINTs. Write integration tests covering every repository method. Coverage must continue to pass all thresholds.

**Outcome:** accepted (with driver fix)

**What changed and why:**
Implemented `src/db/schema.ts` with three tables: `tickets` (16 columns, 3 pgEnum types, 4 indexes, 3 CHECK constraints), `ticketTransitions` (FK cascade, append-only audit log), `classifications` (FK cascade, confidence_range CHECK). Generated migration `0000_furry_wendell_vaughn.sql` via `drizzle-kit generate` and applied to both `dev` and `test` Neon branches via `drizzle-kit migrate`.

Full `ticketRepository` — `create()` (with initial transition log), `findById()` (throws `NotFoundError`), `list()` (all 7 filter branches + pagination), `update()` (partial patch with optimistic lock), `delete()` (optimistic lock), `transition()` (serialisable transaction — `SELECT FOR UPDATE` + atomic audit entry), `bulkInsert()` (outer transaction + per-row SAVEPOINTs for partial success). Read-only `transitionRepository.findByTicketId()` and `classificationRepository.findByTicketId()`.

**Critical fix:** The scaffold used `drizzle-orm/neon-http` (HTTP driver) which doesn't support `db.transaction()`. Switched to `drizzle-orm/neon-serverless` (WebSocket/pool driver) with `neonConfig.webSocketConstructor = ws` — the only driver that supports transactions, `SELECT FOR UPDATE`, and SAVEPOINTs in Node.js.

Added `singleFork: true` to vitest pool options to prevent FK violation race conditions when multiple forks TRUNCATE and INSERT concurrently on the shared Neon test branch.

31 integration tests across 4 test files; all passing. Final coverage: 98.38% stmts / 81.35% branches / 91.66% fns (all above thresholds).

---

## Phase 1: Domain & Validators

**Tool:** Claude Code (claude-sonnet-4-6)

**Context loaded:**
- Spec §3 (API contract, optimistic concurrency, state machine, classifier ordering rationale)
- Spec §4 (Zod schemas, §4.5 classifier tie-breaking rules, §4.4 validator shapes)
- Phase 0 scaffold outputs — domain + validator source already written

**Model:** claude-sonnet-4-6

**Prompt (verbatim):**
> Phase 1 — Domain & validators. Write unit tests for everything and confirm coverage meets the gate (≥95% on src/domain/, ≥95% lines / 90% branches on src/validators/). Domain layer was already implemented in Phase 0 scaffolding since pure functions have no dependencies.

**Outcome:** accepted

**What changed and why:**
Wrote 132 unit tests across 9 test files. Tests exercise: full 5×5 state-machine transition matrix (25 `canTransition` cases), `resolved_at` side effects (resolve → reopen → re-resolve sequence), classifier ordering pin (`bug_report` wins over `technical_issue`), all 6 categories matched at least once, all 4 priorities matched at least once, confidence formula at 0/1/2/5+ keyword hits, case insensitivity, HTTP error class hierarchy (all 9 subclasses), Zod schema validation for all validator modules (CreateTicketSchema, UpdateTicketSchema, TransitionRequestSchema, ListFiltersSchema, TicketMetadataSchema, ImportQuerySchema, Email, NonEmptyString). Added a basic `createApp()` smoke test to cover middleware wiring and health route. Stub files excluded from coverage calculation until implemented (db, controllers, services, repository, importer implementations, logger) — un-excluded per phase. Final: domain 100%, validators 100%, global 89.47% lines / 90% branches (both above 85%/80% thresholds).
