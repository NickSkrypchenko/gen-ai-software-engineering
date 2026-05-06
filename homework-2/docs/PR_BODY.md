# Homework 2 — Intelligent Customer Support System

**Student:** Nick Skrypchenko  
**Live demo:** https://customer-support-api-two.vercel.app/dashboard.html  
**API base:** https://customer-support-api-two.vercel.app  
**Branch:** `homework-2-submission`

---

## What was built

A full-stack customer support ticket system:

- REST API (Node.js + Express + TypeScript) with 11 endpoints
- Neon Postgres + Drizzle ORM with optimistic concurrency (ETag / If-Match)
- Rule-based auto-classifier (category + priority + confidence score)
- Multi-format bulk import: CSV, JSON, XML with per-row error isolation
- Append-only audit log for all status transitions and classifications
- State machine with correct `resolved_at` semantics
- Dark-mode operator dashboard (Linear/Height aesthetic) — landing page + dashboard with 3-tab ticket modal, import dropzone
- 212 tests, 96.3% statement coverage

---

## Quick test

```bash
git clone https://github.com/NickSkrypchenko/gen-ai-software-engineering.git
cd gen-ai-software-engineering/homework-2
npm install
cp .env.example .env          # fill in DATABASE_URL (Neon)
cp .env.test.example .env.test # fill in DATABASE_URL (separate Neon test branch)
npm run db:migrate
npm run db:seed
npm run dev                    # http://localhost:3000
npm test                       # 212 tests, 96% coverage
```

---

## Development process — Context · Model · Prompt per phase

### Phase 0 — Initial planning and brainstorming

Before writing a single line of code, I used Claude Code's `/brainstorming` workflow to align on architecture decisions. Key questions resolved upfront: rule-based classifier vs LLM, Drizzle neon-serverless vs neon-http, CSV unflatten approach, UI scope.

**Starting the session — switching to homework-2 branch, reading the repo state:**

![Starting prompt 1](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/01-starting-prompt.png)

**Brainstorming session — deciding skills, tech stack, classifier runtime, UI scope:**

![Brainstorming kickoff](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/02-brainstorming-kickoff.png)

Key decisions from this session:
- Auto-classification: **pure rules** (deterministic, no API key, testable confidence score)
- UI: full dashboard as in HW1 — `/high-end-visual-design` skill for visual
- Code review: `/codex:review` for review pass
- Deploy: `/vercel:deploy`

---

### Phase 1–4 — Domain, DB, HTTP, Importers

**Context loaded:** full design spec (§2–4), Zod docs, Drizzle + Neon serverless docs.  
**Model:** Claude Sonnet 4.6  
**Prompt strategy:** Phase-scoped — one self-contained prompt per phase with explicit output requirements and test coverage gates.

**Architecture clarifications during brainstorming — service layer design, Drizzle defaults, CSV unflatten:**

![Brainstorming arch](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/03-brainstorming-arch.png)

![Brainstorming schema](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/04-brainstorming-schema.png)

Why these questions mattered:
- `classify.service.ts` needs to sit between domain and controller — domain is pure, controller is thin HTTP. A service layer is the right place for I/O orchestration.
- Drizzle column defaults (`'other'` / `'medium'`) are set at DB level — the API must not inject them from userland to keep the single source of truth in the schema.
- CSV unflatten (`metadata.source` → `{ metadata: { source } }`) was implemented as a 15-line local function instead of the `flat` library — less dependency surface, same result.

**Kickoff prompt given to Claude Code to start implementation:**

![Claude kickoff prompt](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/06-claude-kickoff.png)

The kickoff prompt established the ground rules for the whole session: phase gating, spec authority, coverage thresholds, ETag semantics, and which skills to use at which phases.

---

### Phase 8 — Frontend (operator dashboard + landing page)

**Context loaded:** `docs/specs/wireframes.md`, `docs/specs/visual-brief.md`, all API contracts.  
**Model:** Claude Sonnet 4.6 + `/high-end-visual-design` skill  
**Prompt strategy:** Skill invocation with full backend contract as context.

**Brainstorming session for frontend planning — new components vs HW1, FSM-aware transitions, try-it panels:**

![Brainstorming frontend](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/05-brainstorming-frontend.png)

The `/high-end-visual-design` skill enforced: Ethereal Glass dark aesthetic (OLED `#050505`), Plus Jakarta Sans font, double-bezel card architecture, custom cubic-bezier transitions, no banned patterns (Bootstrap grids, `ease-in-out`, thick borders).

**Landing page:**

![Landing page](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/landing-full.png)

**Operator dashboard:**

![Dashboard](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/dashboard-full.png)

**Dashboard with filters active:**

![Dashboard filtered](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/dashboard-filtered.png)

**Ticket modal — Details / Status / History tabs:**

![Modal details](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/modal-details.png)

![Modal status](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/modal-status.png)

![Modal history](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/modal-history.png)

**Bulk import dropzone (5 states: idle / hover / uploading / success / error):**

![Import dropzone](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/dashboard-dropzone.png)

---

### Phase 10 — Code review

**Context loaded:** branch diff, `docs/specs/review-brief.md` (8-point checklist).  
**Model:** Claude Sonnet 4.6 (manual — `/codex:review` unavailable in this environment)  
**Prompt strategy:** External review prompt listing all 8 criteria with expected PASS/FAIL format.

**The review prompt used:**

![Code review prompt](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/07-code-review-prompt.png)

**Result — 2 FAILs found and fixed:**

![Spec review result](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/08-spec-review-result.png)

**FAIL 1 — `resolved_at` cleared on `resolved → closed`** (`ticket-state-machine.ts:36`):  
The branch condition covered `resolved → closed` in the "reopen" case, incorrectly setting `resolved_at = null`. Fixed with an explicit `to === 'closed'` branch that preserves the timestamp.

**FAIL 2 — `requestId` missing from parse-time errors** (`app.ts:14`):  
Body parsers ran before `requestId` middleware — malformed JSON errors returned without `X-Request-Id`. Fixed by moving `app.use(requestId)` to first position.

---

### Phase 11 — Documentation (3 models)

**ARCHITECTURE.md** — Claude Opus 4.7 (spawned as background subagent for deeper architectural reasoning):

![HOWTORUN prompt in Gemini](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/09-howtorun-gemini.png)

**HOWTORUN.md** — Gemini 2.5 Pro (non-Anthropic model, to satisfy "use different AI models" requirement). Prompt written by Sonnet 4.6, executed in Gemini 2.5 Pro. One bug found post-generation: placeholder `<repository-url>` was not replaced with the actual GitHub URL — fixed manually.

| Document | Model | Audience |
|---|---|---|
| `ARCHITECTURE.md` | Claude Opus 4.7 | Technical leads |
| `README.md` | Claude Sonnet 4.6 | Developers |
| `API_REFERENCE.md` | Claude Sonnet 4.6 | API consumers |
| `TESTING_GUIDE.md` | Claude Sonnet 4.6 | QA engineers |
| `HOWTORUN.md` | Gemini 2.5 Pro | Operators |

4 Mermaid diagrams across docs: state machine (README), test pyramid (TESTING_GUIDE), component graph + request sequence (ARCHITECTURE).

---

### Phase 13–14 — Vercel deploy + debugging

**3 bugs found and fixed during deployment:**

![Vercel debug](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/11-vercel-debug.png)

1. **Legacy `builds` key blocked static serving** — `outputDirectory: "public"` is silently ignored when `builds` is present. Fixed by removing the `builds` array (zero-config mode).
2. **Production `DATABASE_URL` pointed to unmigrated DB** — `/health` returned `ok` (hardcoded, no real query) while `/api/tickets` returned 500. Fixed by replacing the production env var with the already-migrated Neon connection string.
3. **`autoClassify` controller sent wrong response shape** — controller returned only `classification`, but `api-client.ts` expected `{ ticket, classification }` to refresh modal state. Fixed in `tickets.controller.ts`.

**Final test results — all 11 endpoints passing on both local and Vercel:**

![Testing result](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/prompts/10-testing-result.png)

**Post-deploy dashboard (Vercel production):**

![Post-deploy dashboard](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-2-submission/homework-2/docs/screenshots/post-deploy-dashboard.png)

---

## Challenges Encountered

### 1. Vercel static assets not served (404 on dashboard.html)

Vercel has two mutually exclusive deployment modes. The original `vercel.json` used the legacy `builds` array (`@vercel/node` builder for `api/index.ts`). In legacy Builders mode, `outputDirectory` is silently ignored — only what builders explicitly output is served. Every request to `/dashboard.html`, `/js/dist/dashboard.js`, etc. returned 404 regardless of the files being present in the repo.

Fixed by removing the `builds` array entirely, switching to zero-config mode where `outputDirectory: "public"` is respected and `api/index.ts` is auto-detected as a serverless function. The static files are served via Vercel's CDN; the API is routed through rewrites:

```json
{
  "framework": null,
  "outputDirectory": "public",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" },
    { "source": "/health",   "destination": "/api/index.ts" }
  ]
}
```

Vercel prints a warning during legacy-mode builds — `"Due to builds existing in your configuration file, the Build and Development Settings will not apply"` — which is the signal that `outputDirectory` will be ignored.

### 2. TypeScript build error — boolean comparison on query param

The `import.controller.ts` compared `req.query.auto_classify === true` (boolean literal) against an Express query param, which is always `string | string[] | ParsedQs | undefined`. TypeScript 5 correctly flagged this as `TS2367: This comparison appears to be unintentional because the types have no overlap`.

This came from a Phase 4 fix where the Zod middleware coerced `'true'` to boolean `true` for the `auto_classify` field — but the controller still received the raw query string before Zod ran. Fixed by comparing against the string `'true'` only:

```ts
// Before (TS2367):
const autoClassify = req.query.auto_classify === true || req.query.auto_classify === 'true';

// After:
const autoClassify = req.query.auto_classify === 'true';
```

The root misconception: Zod `validate()` middleware mutates `req.body` but does not replace `req.query` — query params remain raw strings at the controller level.

### 3. `autoClassify` response shape mismatch between controller and frontend

`classify.service.ts` returns `{ ticket, classification }`. The controller destructured and discarded `ticket`, sending only `classification` to the client:

```ts
// Before:
const { classification } = await ticketsService.autoClassify(...);
res.json(classification);
```

The frontend `api-client.ts` was typed to expect `{ ticket: Ticket; classification: Classification }` and used `res.ticket` to refresh the modal after classification — so the modal silently failed to update. The bug was invisible in unit tests (which only checked the HTTP response body shape) and only surfaced during manual UI testing on the live Vercel deployment.

Fixed by removing the destructuring:

```ts
// After:
const result = await ticketsService.autoClassify(...);
res.json(result);  // { ticket, classification }
```

Lesson: integration tests should assert on the full response shape, not just that the endpoint returns 200.

---

## Test coverage

```
Test Files  18 passed (18)
     Tests  212 passed (212)

File               | % Stmts | % Branch | % Funcs | % Lines
All files          |   96.29 |    79.75 |   95.77 |   96.29
 src/domain        |   99.15 |    96.66 |     100 |   99.15
 src/validators    |     100 |      100 |     100 |     100
 src/middleware     |   95.52 |    83.33 |     100 |   95.52
 src/services      |   93.75 |    81.57 |     100 |   93.75
 src/repository    |   97.04 |    75.43 |    90.9 |   97.04
```

Gate: ≥85% statements, ≥75% branches — both passed.

---

## Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| Classifier | Rule-based (no LLM) | Deterministic, no API key, testable confidence score |
| Concurrency | Optimistic (ETag/If-Match) | Throughput; Neon WebSocket pool limitations on pessimistic locking |
| DB driver | `neon-serverless` (WebSocket) | Only driver supporting `SELECT FOR UPDATE` + SAVEPOINTs in Node.js |
| Import errors | Per-row SAVEPOINTs | Partial success — 1 bad row doesn't roll back 499 good ones |
| Audit log | Append-only | Immutable history; no UPDATE ever touches `ticket_transitions` |

---

## AI usage summary (docs/AI-USAGE.md)

| Phase | Model | Prompt strategy |
|---|---|---|
| 0–9 | Claude Sonnet 4.6 | Phase-scoped imperative prompts |
| 8 | Sonnet 4.6 + `/high-end-visual-design` skill | Skill invocation |
| 10 | Sonnet 4.6 (manual review) | 8-point checklist |
| 11a | **Claude Opus 4.7** | Detailed architecture + Mermaid spec |
| 11e | **Gemini 2.5 Pro** | Cold-start runbook |
| 13–14 | Sonnet 4.6 + Vercel CLI | Tool orchestration |

Full log with per-phase context, outcomes, and bugs found: [`docs/AI-USAGE.md`](homework-2/docs/AI-USAGE.md)
