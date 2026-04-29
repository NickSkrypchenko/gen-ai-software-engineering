# AI Tools — Usage Log

## Phase 0: Scaffold

**Tool:** Claude Code (claude-sonnet-4-6)

**Prompt:**
> You are implementing Homework 1 — Banking Transactions API as the implementation driver for this repo. The full design spec is at `homework-1/docs/specs/2026-04-29-banking-api-design.md`. [Full kickoff prompt from `docs/specs/claude-code-kickoff-prompt.md`]

**Outcome:** Accepted — scaffold implemented exactly as described.

**What I changed and why:**
The scaffold prompt pointed Claude Code at the design spec as the authoritative source. Rather than waiting until later phases to stub the domain layer, I generated the full folder structure plus minimal-but-real implementations of all validators, models, repository, services, controllers, and routes in Phase 0 so the TypeScript compiler can verify the wiring from day one. The only stubs are the frontend components (populated in Phase 5) and the scripts (populated in Phase 3). The health route was implemented fully as the Phase 0 exit criterion. I chose to not gitignore the built CSS and JS bundles so the `/here-now` deploy can serve them as committed static assets without requiring a build step in the deploy pipeline.
