# Research Notes — context7 queries (Agent 2)

Build-time documentation lookups via the **context7** MCP server. No runtime LLM/network
calls exist in the pipeline; these queries informed implementation decisions only.

---

## Query 1 — decimal.js: isolated constructor + banker's rounding

- **Library ID:** `/mikemcl/decimal.js` (source reputation: High, 809 snippets)
- **Question:** How to create an isolated `Decimal` constructor with `ROUND_HALF_EVEN`
  rounding via `Decimal.clone(...)` without mutating the global via `Decimal.set(...)`;
  `toFixed` rounding behavior and `times` precision.
- **Key findings applied:**
  - `Decimal.clone(config)` returns a **new, independent constructor** with its own
    `precision`/`rounding`; the parent/global `Decimal` is left untouched. `Decimal.set(...)`
    by contrast mutates the global and would leak across the whole process (and across reused
    Vitest workers — making test order matter).
  - Rounding-mode constant: `ROUND_HALF_EVEN === 6` (default is `ROUND_HALF_UP === 4`).
  - Each constructor's instances inherit that constructor's `rounding`, so
    `new Money(x).toFixed(2)` rounds half-even at the final formatting step.
- **Applied in:** `src/lib/money.ts` — `export const Money = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN })`.
  All amounts are constructed via `Money`, kept as strings, and only formatted to 2 dp at the
  final step (e.g. `amount_usd_equivalent`). The global `Decimal` is never reconfigured.

## Query 2 — fastmcp: tools, resources, stdio transport

- **Library ID:** `/punkpeye/fastmcp` (TypeScript framework; source reputation: High, 454 snippets)
- **Question:** `addTool` with validated parameters returning a string; `addResource` /
  `addResourceTemplate` for a custom URI scheme like `pipeline://summary`; `server.start`
  with stdio transport.
- **Key findings applied:**
  - `new FastMCP({ name, version })`, then `server.addTool({ name, description, parameters, execute })`.
    `parameters` is a Standard-Schema object (zod shown in docs); `execute` returns a `string`
    (or a structured `content` array).
  - Static resources: `server.addResource({ uri, name, mimeType, load })`; templated resources:
    `server.addResourceTemplate({ uriTemplate, ..., load })`. For a fixed `pipeline://summary`
    a static `addResource` is the right fit (no template variables).
  - `await server.start({ transportType: "stdio" })` is the Claude Desktop / CLI integration mode.
- **Applied in (Phase 4):** `mcp/server.ts` — `get_transaction_status` and
  `list_pipeline_results` as tools, `pipeline://summary` as a static resource, all reading the
  real `shared/results/` snapshot; launched via `npx tsx mcp/server.ts` (bare `node` cannot run
  `.ts`). Verified end-to-end with an MCP stdio client: all three artifacts respond.
- **Version note:** fastmcp tool parameters need a Standard-Schema validator — `zod` (already in
  fastmcp's dependency tree) is now declared explicitly in `package.json`. The `1.x` line crashes
  on `start()` against the current MCP SDK (`completion/complete` handler registered without the
  `completions` capability), so fastmcp was bumped to `4.x` (agents.md pins it as "latest"); the
  `addTool` / `addResource` / `start({ transportType: 'stdio' })` API used here is unchanged.

---

*Tool: context7 MCP (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`).*
