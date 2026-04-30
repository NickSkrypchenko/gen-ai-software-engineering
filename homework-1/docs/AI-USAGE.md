# AI Tools — Usage Log

## Phase 0: Scaffold

**Tool:** Claude Code (claude-sonnet-4-6)

**Prompt:**
> You are implementing Homework 1 — Banking Transactions API as the implementation driver for this repo. The full design spec is at `homework-1/docs/specs/2026-04-29-banking-api-design.md`. [Full kickoff prompt from `docs/specs/claude-code-kickoff-prompt.md`]

**Outcome:** Accepted — scaffold implemented exactly as described.

**What I changed and why:**
The scaffold prompt pointed Claude Code at the design spec as the authoritative source. Rather than waiting until later phases to stub the domain layer, I generated the full folder structure plus minimal-but-real implementations of all validators, models, repository, services, controllers, and routes in Phase 0 so the TypeScript compiler can verify the wiring from day one. The only stubs are the frontend components (populated in Phase 5) and the scripts (populated in Phase 3). The health route was implemented fully as the Phase 0 exit criterion. I chose to not gitignore the built CSS and JS bundles so the `/here-now` deploy can serve them as committed static assets without requiring a build step in the deploy pipeline.

---

## Phase 1+2: Backend domain & validation + HTTP layer

**Tool:** Claude Code (claude-sonnet-4-6)

**Prompt:** (authored in-flight per spec §7.6 — no verbatim prompt prescribed)

**Outcome:** Accepted — 143 tests written and passing; coverage 95.6% overall, 96.7% services, 100% validators.

**What I changed and why:**
The spec's coverage gate (≥80% overall, ≥85% services/validators) requires both unit and integration test layers since `npm test` runs them together. I wrote all four integration test files alongside the unit tests rather than waiting for Phase 2. Key decisions: the `validate` middleware uses Zod error `path.join('.')` to produce readable field names; the `errorHandler` omits the `details` key entirely (not just `[]`) for non-validation errors to keep the response minimal; the `TransactionRepository.list` applies the failed-transaction visibility filter as a single predicate function rather than scattering it. The `getBalance` method lives on `TransactionsService` rather than delegating to `AccountsService` to avoid a circular dependency between the two services.

---

## Phase 3: OpenAPI + Postman wiring

**Tool:** Claude Code + Postman MCP (via `@asteasolutions/zod-to-openapi`)

**Prompt:** (authored in-flight)

**Outcome:** Accepted — `docs/openapi.yaml` generated from Zod schemas; Postman workspace `Banking Transactions API — homework-1` created; collection generated from spec; 17 requests / 51 assertions all green via Newman.

**What I changed and why:**
Used `@asteasolutions/zod-to-openapi` with `extendZodWithOpenApi` to annotate the existing Zod schemas and drive the OpenAPI 3.1 document. The generator produces verbose inline schemas (no `$ref` in the generated YAML) due to how zod-to-openapi resolves unions — acceptable for the homework. The Postman MCP `putCollection` endpoint requires item IDs which are cumbersome to manage for a scripted update, so the scripted collection is maintained locally in `demo/postman-collection.json` and the Postman workspace holds the auto-generated version. Newman runs the local file; the workspace provides the visual spec for the reviewer.

---

## Phase 4: Wireframes + Visual Brief + Review Brief

**Tool:** Claude Code (claude-sonnet-4-6)

**Prompt:** (authored in-flight)

**Outcome:** Accepted — three spec docs written: `docs/specs/wireframes.md` (ASCII layout + interaction notes for both pages), `docs/specs/visual-brief.md` (full design system: brand direction, color palette, component specs, motion specs), `docs/specs/review-brief.md` (five focus areas with file:line references for the `/codex:review` phase).

---

## Phase 5: Frontend UI — `/high-end-visual-design`

**Tool:** Claude Code (claude-sonnet-4-6) via `/high-end-visual-design` skill

**Prompt:**
> Skill invoked with: `docs/specs/visual-brief.md docs/specs/wireframes.md`

**Outcome:** Accepted — fully styled landing/docs page (`public/index.html`), operator dashboard (`public/dashboard.html`), built CSS bundle (`public/css/tailwind.css`, 23 KB), and two esbuild JS bundles (`docs.bundle.js` 7 KB, `dashboard.bundle.js` 21 KB). All 143 backend tests still passing.

**What I changed and why:**
Chose "Soft Structuralism" vibe + asymmetric double-bezel cards to match the Mercury/Stripe Press brief direction. Key decisions: floating pill nav (not edge-to-edge sticky) per the skill's spec; `Plus Jakarta Sans` for typography (Inter was banned by the skill); `JetBrains Mono` for code blocks and IDs; inline `<style>` for custom CSS (dot-grid background, scroll-reveal keyframes, method pills) while relying on Tailwind JIT for everything else. The `api-client.ts` unwraps the `{ data, count }` envelope the `GET /api/transactions` controller produces — a shape mismatch that would have caused silent failures with a naive array assumption. The `/dashboard` route was added to `app.ts` since Express `static()` only serves `dashboard.html` at `/dashboard.html`, not `/dashboard`. The `tailwind.config.ts` safelist was extended with dynamically applied classes (toast transitions, health-pill colour swaps) to prevent JIT from purging them.

---

## Phase 10: Deploy — `/here-now`

**Tool:** Claude Code (claude-sonnet-4-6) via `/here-now` skill

**Prompt:**
> Skill invoked at Phase 10 approval gate.

**Outcome:** Accepted — static frontend published to **https://hallowed-sonnet-3dak.here.now/** (authenticated, permanent). Dashboard at `/dashboard/`.

**What I changed and why:**
here.now is static-only (no Node.js server support). The Express API backend cannot run there — reviewers run it locally via `npm run seed`. The `public/` directory was assembled into a `.deploy/` staging tree that restructures `dashboard.html` as `dashboard/index.html` so the clean URL `/dashboard/` works on the static host (Express had a dedicated `GET /dashboard` route; the static host does not). The `/dashboard` nav links in the deployed `index.html` were patched to `/dashboard/` (trailing slash) to match the static directory URL. All asset paths (`/css/tailwind.css`, `/js/*.bundle.js`) are root-relative and work from any depth. The `.deploy/` directory is gitignored since it is a derivative of `public/`.

---

## Phase 11: Vercel production deploy — `vercel:deploy` skill

**Tool:** Claude Code (claude-sonnet-4-6) via `vercel:deploy` skill + Playwright MCP

**Prompt:**
> "lets also deploy our project to vercel. edit all necessary and deploy"

**Outcome:** Accepted — full-stack Express API deployed at **https://homework-1-sepia.vercel.app** as a Vercel serverless function with seed data loaded on cold start.

**What I changed and why:**
Vercel requires the app to be exported as a module (not call `app.listen()`). Created `api/index.js` as the serverless entry point that imports the compiled `dist/app.js`, creates the repository, bulk-loads seed data, and exports the Express app — no TCP port binding. Updated `vercel.json` with `"framework": null` (disables Vercel's Express auto-detection which was creating a ghost root function that crashed with `FUNCTION_INVOCATION_FAILED`), `"outputDirectory": "public"` (serves static files via CDN), and rewrites routing `/api/*` and `/health` to the serverless function.

Root tsconfig needed `"lib": ["ES2022", "DOM", "DOM.Iterable"]` because Vercel's `@vercel/node` builder runs a full `tsc` pass on all project TypeScript files — including `public/js/docs.ts` and `dashboard.ts` which use DOM globals — independent of the `npm run build` step. Adding DOM types to the root tsconfig satisfies that pass without affecting server compilation.

Post-deploy verification via Playwright MCP confirmed all routes (landing, dashboard, `/api/transactions`, `/health`) return correct responses from the live serverless function.

---

## Phase 12: Test evidence screenshots

**Tool:** Claude Code (claude-sonnet-4-6) via Playwright MCP

**Prompt:**
> "run all available tests for project - i need to make screenshots of their results"

**Outcome:** Accepted — both test suites run clean; screenshots captured to `docs/screenshots/`.

- `npm test` → 145/145 passed, coverage 95.96% stmts · 92.68% branches · 97.77% functions
- `npm run test:e2e` → 17 requests, 51/51 assertions, 0 failures, avg 4ms response
- Istanbul HTML coverage report screenshotted via Playwright (served over local HTTP)
- Newman output rendered as terminal-style HTML and screenshotted
- App demo screenshots of the live Vercel deployment (landing, endpoints Try-it panel, dashboard)
- AI workflow screenshots (`prompt_1-4.png`) added manually by the student showing Claude Code sessions
