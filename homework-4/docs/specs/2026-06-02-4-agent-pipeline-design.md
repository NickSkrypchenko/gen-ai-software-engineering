# 4-Agent Pipeline — Design Specification

**Project:** Homework 4 — 4-Agent Pipeline (Bug Research Verifier, Bug Fixer, Security Verifier, Unit Test Generator)
**Course:** GenAI and Agentic AI for Software Engineering — Lesson 5 focus: ADW Multi-Agent Coding Workflows
**Author:** Nicko (drafted with Claude in brainstorming mode)
**Date:** 2026-06-02
**Status:** Approved for implementation
**Implementation driver:** Claude Code

---

## 0. Purpose & scope

This document is the implementation contract for Homework 4. Claude Code is the implementation driver and consumes this spec as authoritative input to produce the deliverables required by `homework-4/TASKS.md` and the submission rules in the repository's top-level `README.md`.

**In scope.** A 6-stage multi-agent pipeline built on **Claude Code CLI as runtime** (not direct Anthropic SDK calls): Bug Researcher → Bug Research Verifier → Bug Planner → Bug Fixer → (Security Verifier ‖ Unit Test Generator). 4 of these are the brief's required agents; Researcher and Planner are added to make the pipeline truly end-to-end autonomous. Each agent is defined in `agents/*.agent.md` with YAML frontmatter (model, tools, skills, role, justification) and markdown prompt body. Two skills required by brief (Task 1.2 research-quality, Task 4.2 FIRST principles) live in `skills/*.md`, injected into agent system prompts as `<skill name="...">` XML blocks. A small JWT verifier CLI in `src/` serves as the artifact being analyzed, with 3 seeded issues (1 logic bug, 2 security vulnerabilities). The pipeline is invoked via a single command (`npm run pipeline -- --bug <ID>`) per `context/bugs/<ID>/bug-context.md`. The orchestrator dispatches each agent stage via `claude -p` subprocess with `--model` and `--allowed-tools` flags; Claude Code handles the tool-use loop, retries, and 4 built-in tools (Read, Grep, Edit, Write) internally. Tests cover orchestrator plumbing (~30 unit tests with mocked subprocess) plus baseline JWT app tests (5 tests, 3 failing pre-fix as observable before/after). Code review via `/codex:review`. No deployment — local CLI only. **Runs on user's existing Claude Code subscription — no separate Anthropic API key required.**

**Out of scope.** HTTP server for JWT verifier (CLI only); RS256/ES256 (HS256 only); real Anthropic SDK orchestration with custom tool registry (replaced by Claude Code subprocess runtime — see §1); E2E tests in CI invoking real Claude Code (out of CI scope — manual local runs only); cross-bug regression detection; streaming pipeline output; LLM-based skill auto-update (skills are hand-authored markdown); per-file coverage thresholds via Vitest (not supported — global threshold + manual review attention); pipeline-level deployment (local CLI only).

**Non-goals.** Production-grade agent reliability, formal pen-test of orchestrator, performance benchmarks for pipeline (LLM-bound by design), direct Anthropic SDK integration (the user has Claude Code; using it as runtime avoids API key setup and out-of-pocket cost).

---

## 1. Architectural approach

**Approach A — Linear pipeline + file artifacts + Claude Code subprocess runtime.** One Node.js process. CLI entry (`scripts/run-pipeline.ts`) dispatches 6 agents sequentially by spawning `claude -p` subprocesses (Claude Code in non-interactive mode) with `--model` and `--allowed-tools` flags derived from each `agents/*.agent.md` frontmatter. Each agent reads previous outputs from `context/bugs/<ID>/` folder, writes its own. Parallelism only at the last stage (Security ‖ TestGen after Bug Fixer) per brief's mermaid diagram. Each `.agent.md` file is human-readable, editable, and self-contained.

**Why Claude Code runtime, not direct SDK.** The user already has Claude Code with model access via their existing subscription. Routing agent calls through `claude -p` subprocess:
- Costs nothing beyond the existing subscription (no separate API key, no out-of-pocket per-run cost)
- Delegates tool-use loop, retry logic, and 4 built-in tools (Read, Grep, Edit, Write) to Claude Code internally
- Demonstrates Claude Code mastery, which is the course's overall focus
- Trade-off accepted: ~2-5s subprocess startup per stage (vs ~100ms SDK), no fine-grained tool registry control. For 3 bug runs × 6 stages = +~1 minute total overhead — negligible.

**No deployment.** Pipeline is a local CLI tool; artifacts live in the repo. Reviewer clones, installs deps + Claude Code, authenticates Claude Code, runs the pipeline once, inspects artifacts.

**TypeScript end-to-end** for orchestrator and sample app. Zod schemas validate agent frontmatter at startup (before any subprocess spawn); Zod-derived `MODELS` and `TOOLS` enums catch typos at compile time. `gray-matter` parses frontmatter.

**File-artifact-driven communication between agents.** Orchestrator passes context through file paths + parsed content via XML-style `<bug-context>`, `<verified-research>`, `<changed-file name="...">` tags in the user-message text streamed to `claude -p`. No shared mutable state.

---

## 2. Module map

```
homework-4/
├── agents/                              # 6 agent definitions (.md with YAML frontmatter)
│   ├── researcher.agent.md              # Sonnet 4.6
│   ├── research-verifier.agent.md       # Opus 4.8 — uses skills/research-quality-measurement
│   ├── planner.agent.md                 # Sonnet 4.6
│   ├── bug-fixer.agent.md               # Sonnet 4.6 — Edit/Write tools
│   ├── security-verifier.agent.md       # Opus 4.8
│   └── unit-test-generator.agent.md     # Sonnet 4.6 — Write tool — uses skills/unit-tests-FIRST
│
├── skills/                              # 2 required skills (brief Task 1.2, 4.2)
│   ├── research-quality-measurement.md  # L0-L4 levels
│   └── unit-tests-FIRST.md              # F-I-R-S-T principles
│
├── scripts/
│   ├── run-pipeline.ts                  # CLI entry — 30 LOC
│   ├── seed-bugs.ts                     # one-time helper for Phase 4
│   ├── generate-fixtures.ts             # one-time helper for tests/fixtures/
│   └── pipeline/
│       ├── agent-loader.ts              # ~50 LOC
│       ├── skill-loader.ts              # ~30 LOC
│       ├── validators.ts                # ~25 LOC (cross-ref + system deps incl. claude CLI presence)
│       ├── claude-runner.ts             # ~60 LOC — spawns `claude -p` subprocess per stage
│       ├── stages.ts                    # ~120 LOC
│       ├── messages.ts                  # ~10 LOC
│       ├── logger.ts                    # pino, ~15 LOC
│       └── types.ts                     # shared types
│
├── src/                                 # sample JWT verifier CLI (the artifact being analyzed)
│   ├── index.ts                         # CLI entry
│   ├── jwt/
│   │   ├── verifier.ts                  # Bug 001 lives here (alg=none bypass)
│   │   ├── decoder.ts                   # raw + parsed shape per §5.7
│   │   ├── signature.ts                 # Bug 003 lives here (=== compare)
│   │   └── claims.ts                    # Bug 002 lives here (off-by-one exp)
│   └── types.ts                         # Token, Header, Claims, VerifyResult
│
├── tests/
│   ├── jwt-verifier.test.ts             # 5 baseline tests, 3 failing pre-fix
│   ├── jwt-fixtures.ts                  # token helper functions
│   ├── fixtures/                        # pre-generated tokens for CLI demos
│   │   ├── valid-token.txt
│   │   ├── alg-none-token.txt
│   │   └── expired-token.txt
│   ├── jwt-verifier/                    # populated by Test Generator at Phase 10
│   └── pipeline/                        # orchestrator unit tests (~30)
│       ├── agent-loader.test.ts
│       ├── skill-loader.test.ts
│       ├── validators.test.ts
│       ├── claude-runner.test.ts        # mocks child_process subprocess
│       ├── stages.test.ts
│       ├── messages.test.ts
│       ├── _setup/
│       │   └── mock-subprocess.ts       # mocks execFile/spawn for `claude` CLI
│       └── fixtures/
│           ├── agents/                  # valid + invalid agent.md files
│           ├── skills/                  # valid + missing-section skills
│           └── mock-responses/          # canned `claude -p` stdout per agent
│
├── context/
│   └── bugs/
│       ├── 001-alg-none-bypass/
│       │   ├── bug-context.md           # seeded, committed
│       │   ├── research/
│       │   │   ├── codebase-research.md # generated at Phase 10
│       │   │   └── verified-research.md
│       │   ├── implementation-plan.md
│       │   ├── fix-summary.md
│       │   ├── security-report.md
│       │   └── test-report.md
│       ├── 002-expiration-off-by-one/
│       └── 003-timing-attack-signature/
│
└── docs/
    ├── AI-USAGE.md
    ├── specs/
    │   ├── 2026-06-02-4-agent-pipeline-design.md   # this file
    │   ├── claude-code-kickoff-prompt.md
    │   └── review-brief.md
    ├── reviews/
    │   └── codex-review-<date>.md
    └── screenshots/
        └── *.png (~12-15 shots)
```

**Total: ~330 LOC orchestrator (down from ~500 because tool registry moved to Claude Code) + ~250 LOC sample app + ~45 tests.**

---

## 3. Agents contract

### 3.1 Frontmatter schema

All 6 `agents/*.agent.md` files follow one YAML schema (Zod-validated at startup):

```yaml
---
name: research-verifier                # unique id, kebab-case
model: claude-opus-4-8                 # exact model string; Zod enum: claude-opus-4-8 | claude-sonnet-4-6
max_tokens: 8192                       # optional, default 8192, max 16384
tools: [Read, Grep]                    # registry keys; resolved in claude-runner.ts
skills: [research-quality-measurement] # optional; injected into system prompt
role: Fact-checker for Bug Researcher output.
inputs:                                # documentation
  - context/bugs/<ID>/bug-context.md
  - context/bugs/<ID>/research/codebase-research.md
outputs:                               # documentation — orchestrator writes this artifact from agent's text response
  - context/bugs/<ID>/research/verified-research.md
model_justification: |
  Verification requires fact-checking line:file references and snippet matching
  against source. False positives are worse than slow responses. Opus 4.8 chosen
  for highest precision on this comparison-heavy task.
---

# (markdown body below — the agent's system prompt)

You are a Research Verifier...
```

### 3.2 `agent-loader.ts` contract

```ts
export const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'] as const;
export const TOOLS  = ['Read', 'Grep', 'Edit', 'Write'] as const;

export const AgentSpecSchema = z.object({
  name:                z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab-case'),
  model:               z.enum(MODELS),
  max_tokens:          z.number().int().positive().max(16384).default(8192),
  tools:               z.array(z.enum(TOOLS)).default([]),
  skills:              z.array(z.string()).default([]),
  role:                z.string().min(1),
  inputs:              z.array(z.string()).default([]),
  outputs:             z.array(z.string()).default([]),
  model_justification: z.string().min(1),
}).strict();

export type AgentSpec = z.infer<typeof AgentSpecSchema> & { prompt: string };
```

Frontmatter с опечаткой (e.g., `model: claude-opus-4-7`) → Zod fail at startup with clear message, before any API call.

### 3.3 Per-agent contract

| # | Agent | Model | Tools | Skills | Inputs | Output (orchestrator writes) | Output (agent writes) |
|---|---|---|---|---|---|---|---|
| 1 | researcher | Sonnet 4.6 | Read, Grep | — | bug-context.md, src/** | codebase-research.md | — |
| 2 | research-verifier | **Opus 4.8** | Read, Grep | research-quality-measurement | bug-context.md, codebase-research.md | verified-research.md | — |
| 3 | planner | Sonnet 4.6 | Read, Grep | — | bug-context.md, verified-research.md | implementation-plan.md | — |
| 4 | bug-fixer | Sonnet 4.6 | Read, Grep, **Edit, Write** | — | implementation-plan.md, files in plan | fix-summary.md (+ Test Results appended by orchestrator) | src/** modifications |
| 5 | security-verifier | **Opus 4.8** | Read, Grep | — | fix-summary.md, changed src/** files | security-report.md | — |
| 6 | unit-test-generator | Sonnet 4.6 | Read, Grep, **Write** | unit-tests-FIRST | fix-summary.md, changed src/** files, existing tests/** patterns | test-report.md (+ Final Test Run appended by orchestrator) | tests/** new files |

**Read-only agents (1, 2, 3, 5):** return plain markdown text; orchestrator writes single output file via `artifactWriter`. No `Edit`/`Write` tools.

**Write-enabled agents (4, 6):** return plain markdown summary AND use Edit/Write tools to mutate `src/` (Bug Fixer) or `tests/` (Test Generator). The summary is written by orchestrator to `context/bugs/<ID>/`.

### 3.4 Per-agent system prompts (high-level)

Brief per-agent prompt direction (full prompts authored at Phase 9 by Claude Code):

- **Researcher:** «Given bug description, explore `src/` to find relevant files and code paths. Return markdown with sections: Bug Summary, Affected Files (file:line), Relevant Code Snippets (verbatim), Reproduction Steps, Hypothesis on Root Cause.»
- **Research Verifier:** «[INJECTED SKILL]. Verify every file:line reference and snippet in `codebase-research.md` against actual source. Use skill's quality levels (L0-L4) to score. Required output sections per skill: Verification Summary, Verified Claims, Discrepancies Found, Research Quality Assessment, References.»
- **Planner:** «Read verified research. Produce actionable plan with sections: Goal, Files to Change (per file: before snippet → after snippet), Order of Operations, Verification Command, Risk Notes.»
- **Bug Fixer:** «Read plan. For each file, use Edit tool to apply before → after change. Return markdown summary: Changes Made, Overall Status, Manual Verification Steps, References. Do NOT execute shell — orchestrator runs tests post-hoc.»
- **Security Verifier:** «Read fix-summary and changed files. Scan for injection, hardcoded secrets, insecure comparisons, missing validation, unsafe deps, XSS/CSRF where relevant. Rate findings CRITICAL/HIGH/MEDIUM/LOW/INFO with file:line and remediation. Report only — no code edits.»
- **Test Generator:** «[INJECTED SKILL]. Read fix-summary and changed files. Generate Vitest tests for new/changed behavior only. Each test must satisfy F-I-R-S-T per skill. Write tests via Write tool. Return test-report: Tests Generated (per test: name, what it covers, FIRST compliance ✓/✗ per letter), Coverage Delta estimate, FIRST Violations.»

### 3.5 Parallelism: Security ‖ TestGen

After Bug Fixer + `npm test` run, orchestrator dispatches Security Verifier and Test Generator **via `Promise.allSettled`** (NOT `Promise.all`). Both read the same inputs and write to different artifacts. If one fails, the other completes — partial-failure isolation. Failed stage names accumulate in `failures[]`.

### 3.6 Failure modes per agent

| Failure | Where caught | What happens |
|---|---|---|
| `claude` CLI not on PATH | `claude-runner` ENOENT | Friendly error with install URL; exit 2 at first subprocess spawn |
| `claude -p` non-zero exit | `claude-runner` | Throw with stderr captured; failed stage in `failures[]` |
| Subprocess exceeds 5min timeout | `claude-runner` SIGTERM handler | Throw timeout error; stage marked failed |
| Subprocess returns empty stdout | `claude-runner` empty check | Throw — agent produced no output |
| Tool errors inside Claude Code | Claude Code internal | Handled by CC's own loop; we don't see them unless they cause non-zero exit |
| Frontmatter Zod fail | `loadAllAgents` at startup | Exit code 2, before any subprocess spawn |
| Skill ref broken | `validateAgentSkillRefs` at startup | Exit code 2 |
| Stages 1-4 throw | sequential propagation | Stop pipeline immediately |
| Stages 5 or 6 throw | `Promise.allSettled` | Other stage still completes; failed name in failures[] |
| `npm test` after Bug Fixer fails | `runTests` | NOT hard fail — stdout written to fix-summary.md, pipeline continues |

---

## 4. Skills contract

### 4.1 What a skill is

A skill is a **markdown document** in `skills/` that describes **rubric, taxonomy, or evaluation criteria** for an agent. It is not code, not a tool, not a prompt template. It is the **definition of quality** for one specific task.

The skill is **injected into the agent's system prompt** as `<skill name="...">` XML block before the agent's own prompt body. The agent treats it as part of its instruction.

**Two required skills (per brief):**
- `skills/research-quality-measurement.md` — used by `research-verifier.agent.md` (Task 1.2)
- `skills/unit-tests-FIRST.md` — used by `unit-test-generator.agent.md` (Task 4.2)

### 4.2 Common skill file shape

```markdown
# <Skill name>

> One-paragraph purpose.

## Levels / Categories

[Table or ordered list defining labels / scores / categories.]

## Application

[Step-by-step instructions for the agent applying the skill.]

## Required output sections

[Sections the agent's output document MUST contain.]

## Examples

[1-2 fully worked examples with input fragment + correct output.]
```

`skill-loader.ts` validates required headers (`## Levels`, `## Application`, `## Required output sections`). Missing → hard fail at startup.

### 4.3 `skills/research-quality-measurement.md` content

**Purpose:** How high-quality bug research looks. Used by Research Verifier when producing `verified-research.md`.

**Levels (5-tier):**

| Level | Label | Definition |
|---|---|---|
| L0 | Unverifiable | References to files/lines that don't exist, or snippets that don't match source. Researcher hallucinated. |
| L1 | Speculative | All references exist, but hypothesis on root cause is not grounded in code — only in bug description. Investigation incomplete. |
| L2 | Adequate | All references verified. Root cause hypothesis has at least one piece of supporting evidence from code. Sufficient for planner with risk. |
| L3 | Solid | Verified references + root cause traceable through 2+ code locations + reproduction steps described + likely fix region identified. Plan-ready. |
| L4 | Comprehensive | All of L3 + edge cases noted + impact analysis (other call sites) + related historical bugs/CVEs referenced if applicable. Plan-ready with high confidence. |

**Application section:**
1. For every file:line reference in `codebase-research.md`, use `Read` tool to fetch lines ±3.
2. Compare snippet character-by-character (allow whitespace normalization). Record match/mismatch.
3. Check whether root cause hypothesis cites specific code, not just symptom.
4. Count corroborating code locations.
5. Note presence/absence of: reproduction steps, edge case discussion, impact analysis.
6. Assign single Level (L0–L4) with one-sentence justification citing what was/wasn't present.

**Required output sections** (per brief Task 1.2):
- Verification Summary (overall pass/fail + Research Quality Level)
- Verified Claims (per claim: ✓/✗ + evidence)
- Discrepancies Found (per discrepancy: claimed vs actual + impact)
- Research Quality Assessment (level + reasoning)
- References (file:line list for audit)

### 4.4 `skills/unit-tests-FIRST.md` content

**Purpose:** F-I-R-S-T principles for unit tests. Used by Unit Test Generator.

| Letter | Principle | Concrete check |
|---|---|---|
| **F** | Fast | <100ms. No network. No real timers (use `vi.useFakeTimers()`). No real fs (use `tmp` or mocked fs). |
| **I** | Independent | Test passes regardless of execution order. No shared state. `beforeEach` resets. **`vi.useFakeTimers()` MUST be paired with `vi.useRealTimers()` in afterEach** (worked example: see §7.1). |
| **R** | Repeatable | Same input, same result, on any machine, in any timezone. No `Date.now()` without injection. No randomness without seed. |
| **S** | Self-validating | Test passes/fails on its own. Single assertion per test (or tightly grouped on one behavior). No "check console output." |
| **T** | Timely | Tests written alongside the change, scoped to changed code only. |

**Application section:**
1. Read `fix-summary.md` to identify which functions/files changed.
2. For each changed function: write tests covering happy path, edge cases that surface the original bug, regression test for the specific fix.
3. Before writing each test, self-check F/I/R/S/T compliance — note any borderline.
4. Use existing `tests/**` patterns (Vitest, describe/it, vi.mock for deps).
5. Write tests via `Write` tool to `tests/jwt-verifier/<changed-module>.test.ts`.
6. In `test-report.md`, list each test with F/I/R/S/T check column.

**Required output sections** (per brief Task 4.2):
- Tests Generated (per file: name, what it covers, FIRST compliance check ✓/✗ per letter)
- Test Run Results (placeholder — orchestrator fills in)
- Coverage Delta (rough estimate)
- FIRST Violations (any tests that compromised on a principle, with reason)

### 4.5 Injection mechanism

Skills are pre-loaded once at orchestrator startup into a `Map<string, string>`:

```ts
// scripts/pipeline/skill-loader.ts
export async function loadAllSkills(dir: string): Promise<Map<string, string>> {
  const files = await fs.readdir(dir);
  const out = new Map<string, string>();
  for (const f of files.filter(f => f.endsWith('.md'))) {
    const content = await fs.readFile(`${dir}/${f}`, 'utf-8');
    validateSkillStructure(content, f);
    out.set(f.replace(/\.md$/, ''), content);
  }
  return out;
}

// scripts/pipeline/claude-runner.ts
export function buildSystemPrompt(agent: AgentSpec, skills: Map<string, string>): string {
  const skillBlocks = agent.skills
    .map(id => {
      const content = skills.get(id);
      if (!content) throw new Error(`Agent ${agent.name} references unknown skill: ${id}`);
      return `\n\n<skill name="${id}">\n${content}\n</skill>\n\n`;
    })
    .join('');
  return agent.prompt + skillBlocks;
}
```

XML-style delimiters (Claude is trained on `<tag>` boundaries; `[INJECTED SKILL: ...]` is just text).

### 4.6 What skills are NOT

- **Skills ≠ tools.** Skill is a document-rubric. Tool is a callable function. Agent reads skill as part of instruction.
- **Skills ≠ prompts.** Skill is a reusable rubric. Prompt is a concrete instruction for a role.
- **Skills ≠ Claude Code skills from `~/.claude/skills/`.** Those are plug-ins for Claude Code CLI. Our skills are domain documents for this homework. Name overlap is brief's terminology; clarified in README.

---

## 5. Sample JWT verifier CLI

### 5.1 What it does

Minimal CLI for JWT verification (HS256 only). One-shot: `npm run cli -- verify <token>` → JSON `{ valid: boolean, claims?: object, error?: string }`. Single shared secret from env var `JWT_SECRET`. ~250 LOC TypeScript total.

### 5.2 File structure

```
src/
├── index.ts                  # CLI: parse argv, dispatch to verifyToken(), print JSON
├── jwt/
│   ├── verifier.ts           # verifyToken() — contains Bug 001 (alg=none accepted)
│   ├── decoder.ts            # base64url decode header/payload — see §5.7 shape
│   ├── signature.ts          # HMAC-SHA256 sign + verify — contains Bug 003 (=== compare)
│   └── claims.ts             # exp/nbf/iat checks — contains Bug 002 (off-by-one exp)
└── types.ts                  # Token, Header, Claims, VerifyResult
```

### 5.3 Seeded issue 1 — `alg=none` bypass (CRITICAL security, Bug 001)

```ts
// src/jwt/verifier.ts (with Bug 001)
export function verifyToken(token: string): VerifyResult {
  const { rawHeader, rawPayload, signature, header, payload } = decode(token);
  
  if (header.alg === 'none') {                            // ← Bug 001
    return { valid: true, claims: payload };
  }
  if (header.alg !== 'HS256') {
    return { valid: false, error: 'unsupported alg' };
  }
  
  const signingInput = `${rawHeader}.${rawPayload}`;
  if (!verifySignature(signingInput, signature, process.env.JWT_SECRET!)) {
    return { valid: false, error: 'bad signature' };
  }
  return validateClaims(payload);
}
```

**Fix:** remove `if (header.alg === 'none') { return { valid: true, ... } }` block.

### 5.4 Seeded issue 2 — Expiration off-by-one (LOGIC bug, MEDIUM, Bug 002)

```ts
// src/jwt/claims.ts (with Bug 002)
export function validateClaims(payload: Claims): VerifyResult {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {                                // ← Bug 002 (should be <=)
    return { valid: false, error: 'expired' };
  }
  if (payload.nbf && payload.nbf > now) {
    return { valid: false, error: 'not yet valid' };
  }
  return { valid: true, claims: payload };
}
```

**Fix:** `payload.exp <= now` — token with `exp === now` must be expired (boundary inclusive per RFC 7519 §4.1.4).

### 5.5 Seeded issue 3 — Timing attack on signature compare (HIGH security, Bug 003)

```ts
// src/jwt/signature.ts (with Bug 003)
import { createHmac } from 'node:crypto';

export function verifySignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return signature === expected;                          // ← Bug 003 (timing-attack vulnerable)
}
```

**Fix:** `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))` with length pre-check (timingSafeEqual throws on length mismatch).

### 5.6 Bug-context.md files

Each `context/bugs/<ID>/bug-context.md` is the seed input to the pipeline. Committed at Phase 4. Format:

```markdown
# Bug 001 — JWT verifier accepts unsigned tokens

## Symptom
Passing token with "alg":"none" returns valid:true without signature check.

## Reproduction
$ npm run cli -- verify <unsigned-token>
{ "valid": true, "claims": {...} }
Expected: { "valid": false, "error": "..." }

## Suspected severity
Critical — bypasses authentication entirely.

## Hint
src/jwt/verifier.ts — verifyToken() function.
```

Similar shape for bugs 002 and 003.

### 5.7 Decoder return shape (critical correctness)

JWT signing requires the **raw base64url-encoded** header and payload (separated by `.`), NOT decoded JS objects. The decoder must return both:

```ts
// src/types.ts
export interface DecodedToken {
  rawHeader:  string;        // base64url string from token
  rawPayload: string;        // ditto
  signature:  string;        // base64url signature
  header:     Header;        // JSON.parse'd — for alg check
  payload:    Claims;        // JSON.parse'd — for exp/nbf check
}

// src/jwt/decoder.ts
export function decode(token: string): DecodedToken {
  const [rawHeader, rawPayload, signature] = token.split('.');
  if (!rawHeader || !rawPayload || signature === undefined) {
    throw new Error('malformed token');
  }
  const header  = JSON.parse(b64urlDecode(rawHeader))  as Header;
  const payload = JSON.parse(b64urlDecode(rawPayload)) as Claims;
  return { rawHeader, rawPayload, signature, header, payload };
}
```

Without correct `rawHeader/rawPayload`, signing flow is broken even for valid tokens — baseline tests would be unreadable. Type contract MUST be enforced at Phase 2.

### 5.8 What's not in scope for sample app

- No RS256/ES256 — HS256 only.
- No JWKS — single shared secret from env.
- No refresh tokens, revocation, blacklist.
- No HTTP server — pure CLI.
- One bug = one pipeline run = one-two touched files (narrow scope for review).

---

## 6. Pipeline orchestrator

### 6.1 Exit codes (canonical)

| Code | Meaning |
|---|---|
| 0 | Full success — all 6 stages completed cleanly |
| 1 | At least one stage failed during execution (agents ran but errors) |
| 2 | Pre-flight failure: usage error, missing inputs (bug folder), system dep missing (rg/git), broken frontmatter (Zod), broken skill ref |

### 6.2 Entry point `scripts/run-pipeline.ts`

```ts
#!/usr/bin/env tsx
import { parseArgs } from 'node:util';
import { loadAllAgents } from './pipeline/agent-loader';
import { loadAllSkills } from './pipeline/skill-loader';
import { validateAgentSkillRefs } from './pipeline/validators';
import { checkSystemDependencies } from './pipeline/validators';
import { runStages } from './pipeline/stages';
import { logger } from './pipeline/logger';

const { values } = parseArgs({ options: { bug: { type: 'string', short: 'b' } } });
if (!values.bug) {
  console.error('Usage: npm run pipeline -- --bug <id>');
  process.exit(2);
}

async function main() {
  checkSystemDependencies();                                // claude, git, npx — exit 2 if missing
  const agents = await loadAllAgents('agents/');            // Zod-validated; exit 2 on fail
  const skills = await loadAllSkills('skills/');
  validateAgentSkillRefs(agents, skills);                   // exit 2 on broken refs
  
  const bugId = values.bug!;
  const bugDir = `context/bugs/${bugId}`;
  if (!existsSync(`${bugDir}/bug-context.md`)) {
    throw new Error(`Bug not found: ${bugDir}/bug-context.md`);   // → exit 2 via main().catch
  }
  
  const result = await runStages({ bugId, agents, skills, bugDir });
  logger.info('Pipeline complete', result.summary);
  process.exit(result.failures.length === 0 ? 0 : 1);
}

main().catch(err => { logger.error('Pipeline failed', err); process.exit(2); });
```

### 6.3 Claude Code subprocess — no custom tool registry

**Key architectural choice:** instead of implementing a custom tool registry + tool-use loop on `@anthropic-ai/sdk` Messages API, the orchestrator delegates this to Claude Code by spawning `claude -p` subprocess per agent stage. Claude Code internally handles:

- The full tool-use loop (assistant tool_use → executes tool → tool_result → continue → end_turn)
- Built-in tools: Read, Grep, Edit, Write, Bash, WebFetch, etc.
- Retries on rate limits and transient errors
- Model selection via `--model <id>` flag
- Tool authorization via `--allowed-tools <comma-list>` flag

Our orchestrator's only responsibility for each stage:
1. Build system prompt from agent prompt body + injected skills
2. Build user message with XML-tagged context (`<bug-context>...</bug-context>`)
3. Spawn `claude -p` subprocess with `--model`, `--allowed-tools`, `--append-system-prompt`
4. Capture stdout (the agent's final markdown response)
5. Write to artifact file

**Frontmatter `tools: [Read, Grep, Edit, Write]` maps directly to Claude Code's `--allowed-tools` flag.** Tool names are identical (the brief and Claude Code use the same names).

**Why this is safer than custom registry:**
- Path traversal protection is built into Claude Code's tools — we don't reinvent `resolveSafe`.
- Output capping is Claude Code's responsibility — we don't track 50 KB cuts.
- Edit's "one occurrence" constraint is Claude Code's behavior — we inherit it.
- ripgrep availability is Claude Code's concern (it bundles or shells out as it sees fit).

**What we lose:** fine-grained control over tool behavior (e.g., we can't customize Grep output format), and we depend on Claude Code being installed and authenticated. For homework scope, both are acceptable trade-offs.

### 6.4 Claude runner — subprocess wrapper (`pipeline/claude-runner.ts`)

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

const SUBPROCESS_TIMEOUT_MS = 5 * 60 * 1000;     // 5 minutes hard cap per agent stage

export async function runAgent(
  spec: AgentSpec,
  skills: Map<string, string>,
  userMessage: string,
): Promise<{ text: string; durationMs: number }> {
  const systemPrompt = buildSystemPrompt(spec, skills);     // agent prompt + injected <skill> blocks

  const args = [
    '-p',                                                    // non-interactive print mode
    '--model', spec.model,
    '--append-system-prompt', systemPrompt,
    '--allowed-tools', spec.tools.join(','),                 // [Read,Grep] → "Read,Grep"
    // userMessage passed via stdin to handle long content without arg length limits
  ];

  const start = Date.now();
  try {
    const { stdout } = await execFileAsync('claude', args, {
      input: userMessage,
      encoding: 'utf-8',
      timeout: SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,                           // 10 MB output cap
    });
    const durationMs = Date.now() - start;
    const text = stdout.trim();
    if (!text) throw new Error(`Agent ${spec.name} returned empty output`);
    return { text, durationMs };
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      throw new Error('claude CLI not found. Install Claude Code: https://docs.anthropic.com/claude-code. See HOWTORUN.md.');
    }
    if (e.killed && e.signal === 'SIGTERM') {
      throw new Error(`Agent ${spec.name} exceeded ${SUBPROCESS_TIMEOUT_MS / 1000}s timeout`);
    }
    throw new Error(`Agent ${spec.name} failed: ${e.message}\n${e.stderr ?? ''}`);
  }
}

export function buildSystemPrompt(agent: AgentSpec, skills: Map<string, string>): string {
  const skillBlocks = agent.skills
    .map(id => {
      const content = skills.get(id);
      if (!content) throw new Error(`Agent ${agent.name} references unknown skill: ${id}`);
      return `\n\n<skill name="${id}">\n${content}\n</skill>\n\n`;
    })
    .join('');
  return agent.prompt + skillBlocks;
}
```

**Down from ~80 LOC (tool-use loop + retry + executeOneTool) to ~40 LOC.** Claude Code does the heavy lifting.

**Subprocess details:**
- `--append-system-prompt` (not `--system-prompt`) — preserves Claude Code's default system prompt + adds ours. We DO want CC's default behavior around tool usage, just with our agent-specific instructions appended.
- User message via stdin — agent prompts + injected skill blocks can exceed shell arg length limits (~128 KB on most systems). Stdin has no such cap.
- Timeout 5 minutes per agent stage — generous (longest stage Bug Fixer may take 2-3 min with multi-tool-use). On SIGTERM, throw clear timeout error.
- maxBuffer 10 MB — Claude Code's final markdown response is rarely > 50 KB but we leave headroom.
- ENOENT → friendly install error (mirror of HW spec's ripgrep handling).

### 6.5 Stages — `pipeline/stages.ts`

```ts
export async function runStages({ bugId, agents, skills, bugDir }: RunCtx): Promise<RunResult> {
  const failures: string[] = [];
  const usages: Record<string, any> = {};

  async function runStage(agentName: string, userMsg: string, outputPath: string) {
    const spec = agents.get(agentName)!;
    logger.info(`[${agentName}] starting (model: ${spec.model})`);
    try {
      const { text, turns, usage } = await runAgent(spec, skills, userMsg);
      await fs.writeFile(`${bugDir}/${outputPath}`, text, 'utf-8');
      usages[agentName] = usage;
      logger.info(`[${agentName}] done — ${turns} turns, ${usage.input_tokens + usage.output_tokens} tokens → ${outputPath}`);
    } catch (e: any) {
      logger.error(`[${agentName}] FAILED: ${e.message}`);
      failures.push(agentName);
      throw e;     // sequential stages — downstream depends
    }
  }

  const bugContext = await fs.readFile(`${bugDir}/bug-context.md`, 'utf-8');

  // Stages 1-4: sequential
  await runStage('researcher',
    buildUserMessage([{ type: 'bug-context', content: bugContext }]),
    'research/codebase-research.md');

  const codebaseResearch = await fs.readFile(`${bugDir}/research/codebase-research.md`, 'utf-8');
  await runStage('research-verifier',
    buildUserMessage([
      { type: 'bug-context', content: bugContext },
      { type: 'codebase-research', content: codebaseResearch },
    ]),
    'research/verified-research.md');

  const verifiedResearch = await fs.readFile(`${bugDir}/research/verified-research.md`, 'utf-8');
  await runStage('planner',
    buildUserMessage([
      { type: 'bug-context', content: bugContext },
      { type: 'verified-research', content: verifiedResearch },
    ]),
    'implementation-plan.md');

  const plan = await fs.readFile(`${bugDir}/implementation-plan.md`, 'utf-8');
  await runStage('bug-fixer',
    buildUserMessage([{ type: 'implementation-plan', content: plan }]),
    'fix-summary.md');

  // 4a. Orchestrator runs tests (deterministic, NOT agent)
  const testResult = runTests();
  await fs.appendFile(`${bugDir}/fix-summary.md`,
    `\n\n## Test Results (orchestrator-recorded)\n\`\`\`\n${testResult}\n\`\`\`\n`);

  // Build context for parallel stages
  const fixSummary = await fs.readFile(`${bugDir}/fix-summary.md`, 'utf-8');
  const changedFiles = gitDiffNames('src/');
  const changedFileContents = await Promise.all(
    changedFiles.map(async f => ({ type: 'changed-file', name: f, content: await fs.readFile(f, 'utf-8') }))
  );
  const msgForReviewers = buildUserMessage([
    { type: 'fix-summary', content: fixSummary },
    ...changedFileContents,
  ]);

  // Stages 5 & 6: parallel via allSettled (partial-failure isolation)
  const [secRes, testRes] = await Promise.allSettled([
    runStage('security-verifier', msgForReviewers, 'security-report.md'),
    runStage('unit-test-generator', msgForReviewers, 'test-report.md'),
  ]);
  if (secRes.status === 'rejected')  logger.error('security-verifier failed', secRes.reason);
  if (testRes.status === 'rejected') logger.error('unit-test-generator failed', testRes.reason);

  // 6a. Re-run tests to capture freshly generated ones
  const finalTests = runTests();
  await fs.appendFile(`${bugDir}/test-report.md`,
    `\n\n## Final Test Run (orchestrator-recorded)\n\`\`\`\n${finalTests}\n\`\`\`\n`);

  return {
    summary: { bugId, stagesRun: 6, failures, totalTokens: sumUsage(usages) },
    failures,
  };
}

function gitDiffNames(scope: string): string[] {
  return execFileSync('git', ['diff', '--name-only', 'HEAD', '--', scope], { encoding: 'utf-8' })
    .trim().split('\n').filter(Boolean);
}

function runTests(): string {
  try {
    return execFileSync('npx', ['vitest', 'run', 'tests/'], { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e: any) {
    return (e.stdout?.toString() ?? '') + '\n' + (e.stderr?.toString() ?? '');
  }
}
```

### 6.6 User message builder (`pipeline/messages.ts`)

```ts
export function buildUserMessage(parts: { type: string; name?: string; content: string }[]): string {
  return parts.map(p => {
    const attrs = p.name ? ` name="${p.name}"` : '';
    return `<${p.type}${attrs}>\n${p.content}\n</${p.type}>`;
  }).join('\n\n');
}
```

XML-style structural delimiters throughout — agents see typed context: `<bug-context>`, `<verified-research>`, `<changed-file name="...">`.

### 6.7 What lives in `pipeline/` total

```
scripts/pipeline/
├── agent-loader.ts          # ~50 LOC
├── skill-loader.ts          # ~30 LOC
├── validators.ts            # ~25 LOC (cross-ref + system deps incl. `claude` CLI presence)
├── claude-runner.ts         # ~40 LOC (subprocess wrapper)
├── stages.ts                # ~120 LOC
├── messages.ts              # ~10 LOC
├── logger.ts                # ~15 LOC
└── types.ts                 # shared types
```

Total: ~290 LOC orchestrator (down from ~500 because tool-use loop + tool registry + retry logic moved to Claude Code).

---

## 7. Testing strategy

### 7.1 Layer 1 — Sample JWT app tests (`tests/jwt-verifier.test.ts`)

5 baseline tests, 3 failing pre-fix as observable before/after:

```ts
import { verifyToken } from '../src/jwt/verifier';
import { signedToken, unsignedToken, now } from './jwt-fixtures';

describe('verifyToken — baseline behavior', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(()  => vi.useRealTimers());

  test('happy path: valid signed token → valid:true with claims', () => {
    const t = signedToken({ sub: 'alice', exp: now() + 3600 });
    expect(verifyToken(t)).toEqual({ valid: true, claims: expect.objectContaining({ sub: 'alice' }) });
  });

  test('wrong secret: signed with X, verified with Y → bad signature', () => {
    const t = signedToken({ sub: 'alice' }, 'wrong-secret');
    expect(verifyToken(t).valid).toBe(false);
  });

  test('rejects alg=none (Bug 001 — failing pre-fix)', () => {
    const t = unsignedToken({ sub: 'alice', exp: now() + 3600 });
    expect(verifyToken(t).valid).toBe(false);
    expect(verifyToken(t).error).toMatch(/none|unsupported/);
  });

  test('expiration boundary inclusive (Bug 002 — failing pre-fix)', () => {
    vi.setSystemTime(new Date(1_700_000_000_000));
    const t = signedToken({ sub: 'alice', exp: 1_700_000_000 });
    expect(verifyToken(t).valid).toBe(false);
    expect(verifyToken(t).error).toMatch(/expired/);
  });

  test('signature comparison is constant-time (Bug 003 — failing pre-fix)', () => {
    const src = readFileSync('src/jwt/signature.ts', 'utf-8');
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).not.toMatch(/===\s*expected|signature\s*===/);
  });
});
```

`beforeEach/afterEach` pair around fake timers — FIRST Independent compliance, this is the worked example referenced in skill `unit-tests-FIRST.md`.

Test Generator (Phase 10 of OUR build, via real agent run) adds files to `tests/jwt-verifier/` per bug.

### 7.2 Layer 2 — Orchestrator unit tests (`tests/pipeline/`)

~30 tests covering ~330 LOC orchestrator. `child_process` subprocess mocked (Claude Code CLI not actually invoked in tests).

```
tests/pipeline/
├── agent-loader.test.ts         (8 tests)
├── skill-loader.test.ts         (4 tests)
├── validators.test.ts           (3 tests — incl. claude CLI presence check)
├── claude-runner.test.ts        (6 tests — incl. subprocess mock, ENOENT, timeout)
├── stages.test.ts               (4 tests — incl. allSettled isolation)
├── messages.test.ts             (2 tests)
└── _setup/mock-subprocess.ts    # mocks execFile for `claude` CLI per agent invocation
```

**Mock structure for Claude Code subprocess:**

Since Claude Code handles the tool-use loop internally, our mock is **single-response per agent invocation** (much simpler than the previous Message[][] multi-turn sequence):

```ts
// tests/pipeline/_setup/mock-subprocess.ts
import { vi } from 'vitest';

export function mockClaudeSubprocess(responsesByInvocation: string[]) {
  let invocationIdx = 0;
  return vi.mock('node:child_process', () => ({
    execFile: vi.fn((cmd, args, opts, callback) => {
      if (cmd !== 'claude') {
        // fall through to real execFile for `git`, `npx`, etc.
        return realExecFile(cmd, args, opts, callback);
      }
      if (invocationIdx >= responsesByInvocation.length) {
        callback(new Error(`mock-subprocess: no more responses queued (${invocationIdx})`));
        return;
      }
      const stdout = responsesByInvocation[invocationIdx++];
      // mimic execFile signature: (err, stdout, stderr)
      callback(null, stdout, '');
    }),
  }));
}
```

**Usage in stages.test.ts:**

```ts
test('full pipeline writes all 6 artifacts', async () => {
  mockClaudeSubprocess([
    '# Codebase Research\n...',                  // Stage 1 → researcher
    '# Verified Research\nLevel: L3 Solid\n...', // Stage 2 → research-verifier
    '# Implementation Plan\n...',                 // Stage 3 → planner
    '# Fix Summary\nApplied 1 edit to verifier.ts', // Stage 4 → bug-fixer (CC applied Edit internally)
    '# Security Report\nNo critical issues.',    // Stage 5 → security-verifier
    '# Test Report\nGenerated 3 tests.',         // Stage 6 → unit-test-generator (CC applied Write internally)
  ]);

  await runStages({ bugId: '001-test', agents, skills, bugDir });

  expect(existsSync('context/bugs/001-test/research/codebase-research.md')).toBe(true);
  expect(existsSync('context/bugs/001-test/research/verified-research.md')).toBe(true);
  // ... etc.
});
```

**Important caveat:** since Claude Code handles tool execution internally, mocked subprocess tests DON'T verify that Bug Fixer's Edit tool actually modified `src/jwt/verifier.ts`. That kind of verification only happens in Phase 10 manual E2E run with the real Claude Code subprocess. Layer 2 tests verify only orchestrator plumbing: subprocess spawn args, output capture, file writing, sequential vs allSettled flow, ENOENT handling, timeout handling.

### 7.3 Coverage thresholds

```ts
// vitest.config.ts
coverage: {
  provider: 'v8',
  perFile: true,                                       // every file must hit threshold individually
  thresholds: {
    lines:      85,
    branches:   85,
    functions:  85,
    statements: 85,
  },
  exclude: [
    '**/*.test.ts',
    'tests/**',
    'src/index.ts',
    'scripts/run-pipeline.ts',              // thin entry point with process.exit() — covered indirectly via stages.test.ts
    'scripts/seed-bugs.ts',
    'scripts/generate-fixtures.ts',
  ],
}
```

Vitest does not support per-path-pattern thresholds. Safety/correctness-critical files (`claude-runner.ts`, `stages.ts`, `src/jwt/signature.ts`) are documented in README section as requiring extra review attention, aim for ≥95% coverage there manually.

### 7.4 No E2E with real Claude Code in CI

CI runs Layer 1 + Layer 2 with mocked subprocess. Phase 10 (manual local) runs real Claude Code on 3 bugs to produce demo artifacts. **Cost: $0** (uses developer's existing Claude Code subscription, not a separate API key). Wall-time estimate: ~5-10 minutes per bug run (~30 minutes total for 3 bugs); much of this is Claude Code's internal LLM latency.

### 7.5 Fixture generation

`tests/jwt-fixtures.ts` — token helpers using node:crypto, no external `jsonwebtoken` dep. Pre-generated tokens for CLI demos in `tests/fixtures/`:

```ts
// scripts/generate-fixtures.ts (one-time helper)
import { signedToken, unsignedToken } from '../tests/jwt-fixtures';
import { writeFileSync } from 'fs';
writeFileSync('tests/fixtures/valid-token.txt',     signedToken({ sub: 'alice', exp: 9_999_999_999 }) + '\n');
writeFileSync('tests/fixtures/alg-none-token.txt',  unsignedToken({ sub: 'alice', exp: 9_999_999_999 }) + '\n');
writeFileSync('tests/fixtures/expired-token.txt',   signedToken({ sub: 'alice', exp: 1_577_836_800 }) + '\n');
```

Run once via `npm run fixtures:gen` at Phase 3. Outputs committed.

### 7.6 What we don't test

- **Agent output quality** — manual review territory. Quality of `verified-research.md` or `security-report.md` is evaluated by human, not unit test.
- **Real Claude Code subprocess behavior** — mocked in CI.
- **Claude Code's built-in tool correctness** — we delegate Read/Grep/Edit/Write to Claude Code and trust their implementation. (HW1/HW2 did test our custom registry — here we don't have one.)
- **Performance** — orchestrator overhead trivial (~50ms per subprocess spawn + subprocess startup ~2-5s outside our control).
- **CI workflow** — homework doesn't require GitHub Actions. Future work bullet.

### 7.7 Test counts

| Layer | Files | Tests |
|---|---|---|
| 1 — JWT verifier baseline | 1 + 1 fixtures | 5 (3 failing pre-fix) |
| 1 — Generated per bug (Phase 10) | 3 | ~9-15 (Test Gen decides) |
| 2 — Orchestrator units | 6 | ~30 |
| **Total** | **11** | **~45-50** |

---

## 8. AI workflow integration

### 8.1 Context-Model-Prompt framework (CMP) for OUR build of HW4

| Phase | Surface | Context | Model | Prompt strategy |
|---|---|---|---|---|
| 0 | Scaffold | This spec | Sonnet 4.6 | Imperative kickoff prompt |
| 1 | Skills (research-quality, FIRST) | Spec §4 + Task 1.2/4.2 briefs | Sonnet 4.6 | 2 skill .md files per defined shape |
| 2 | Sample JWT app | Spec §5 + 3 seeded-bug specs | Sonnet 4.6 | `src/jwt/*`, `src/index.ts`, types |
| 3 | Baseline tests + fixtures | Spec §7.1, §7.5 | Sonnet 4.6 | 5 baseline tests + jwt-fixtures.ts + generate-fixtures.ts |
| 4 | Bug context files | Spec §5.6 | Sonnet 4.6 | 3 files in context/bugs/<ID>/ |
| 5 | Loaders + validators | Spec §3.2, §4.5 | Sonnet 4.6 | agent-loader, skill-loader, validators + unit tests |
| 6 | Claude runner (subprocess wrapper) + messages | Spec §6.4, §6.6 | Sonnet 4.6 | ~40 LOC subprocess wrapper + 6 unit tests (with mocked execFile) |
| 7 | Stages | Spec §6.5 | Sonnet 4.6 | Sequential 1-4 + allSettled 5-6 + unit tests |
| 8 | Run-pipeline entry | Spec §6.2 | Sonnet 4.6 | CLI argv parsing, startup validation, integrates phases 5-7 |
| 9 | 6 agents (.agent.md) | Spec §3 per-agent contract | Sonnet 4.6 | 6 markdown files with frontmatter + prompts |
| 10 | E2E manual pipeline run | Built pipeline + 3 bugs | Mixed (Claude Code subprocess uses each agent's assigned Opus 4.8 / Sonnet 4.6 via `--model` flag) | `npm run pipeline -- --bug <ID>` × 3, runs against developer's Claude Code subscription |
| 11 | Code review | Branch diff + review-brief.md | **/codex:review** | Skill invocation |
| 12 | README + agent justifications | Spec + final repo | **claude-opus-4-8** | Opus for per-agent model justification section (brief's showcase) |
| 12 | HOWTORUN | Spec + final scripts | claude-sonnet-4-6 | Cold-start runbook |
| 13 | Screenshots | Pipeline runs + final code | Playwright MCP (fallback: manual) | Tool orchestration |
| 14 | AI-USAGE consolidation | Conversation + per-phase notes | Sonnet 4.6 | Editorial pass |
| 15 | PR | All commits | Sonnet 4.6 | PR body composition |

**Note:** this is CMP for our build of HW4. Inside the pipeline (at runtime), agents have their own model assignments (§3.3 — Opus 4.8 for Verifier+Security, Sonnet 4.6 for others).

### 8.2 Phase pipeline

| # | Phase | Inputs | Outputs | Exit criteria |
|---|---|---|---|---|
| 0 | Scaffold | This spec | `package.json` (deps: vitest, gray-matter, zod, dotenv, pino, tsx — **no @anthropic-ai/sdk**, runtime is `claude` CLI subprocess), `tsconfig.json`, folder skeleton, `.gitignore`, `.env.example` | `tsx scripts/run-pipeline.ts --bug nonexistent` exits 2 with `Bug not found: ...` message |
| 1 | Skills | Spec §4 | `skills/research-quality-measurement.md`, `skills/unit-tests-FIRST.md` | Both pass `validateSkillStructure` |
| 2 | Sample JWT app | Spec §5 | `src/jwt/{verifier,decoder,signature,claims}.ts`, `src/types.ts`, `src/index.ts` (CLI) | `npm run cli -- verify <valid-token>` returns `{valid: true}`; 3 seeded bugs in code exactly per spec |
| 3 | Baseline tests + fixtures | Spec §7.1, §7.5 | `tests/jwt-verifier.test.ts`, `tests/jwt-fixtures.ts`, `tests/fixtures/{valid,alg-none,expired}-token.txt` | `npm test` → 3 failing, 2 passing; fixture files exist and contain valid base64url tokens |
| 4 | Bug context files | Spec §5.6 | `context/bugs/{001,002,003}/bug-context.md` | 3 files with required sections |
| 5 | Loaders + validators | Spec §3.2, §4.5 | `agent-loader.ts`, `skill-loader.ts`, `validators.ts` + unit tests | Loaders parse fixtures correctly (valid + invalid); validators detect missing `claude` CLI at startup |
| 6 | Claude runner (subprocess wrapper) + messages | Spec §6.4, §6.6 | `claude-runner.ts` (~40 LOC), `messages.ts` + tests | Subprocess mock tests pass: spawn args correct, stdout captured, ENOENT friendly error, timeout handled |
| 7 | Stages | Spec §6.5 | `stages.ts` + tests | Sequential 1-4 stop on throw; parallel 5-6 use allSettled isolation; orchestrator runs tests deterministically |
| 8 | Run-pipeline entry | Spec §6.2 | `run-pipeline.ts` + smoke test | `--bug nonexistent` exits 2 with clear error; full happy-path with mocked subprocess writes all artifacts |
| 9 | 6 agents | Spec §3 | `agents/{researcher,research-verifier,planner,bug-fixer,security-verifier,unit-test-generator}.agent.md` | All 6 load without Zod errors; cross-ref valid |
| 10 | E2E manual run | Phases 0-9 + authenticated Claude Code CLI | `context/bugs/<ID>/research/*.md`, `*-report.md`, applied fixes, generated tests — all 3 bugs | All 3 runs exit 0; final `npm test` → 5+ passing, 0 failing; demo artifacts committed. **No separate API key required — uses developer's Claude Code subscription.** |
| 11 | Code review | Branch diff + `docs/specs/review-brief.md` | `docs/reviews/codex-review-<date>.md` | All `[BLOCKING]` findings addressed or waived |
| 12 | README + HOWTORUN | Spec + final repo | `README.md` (incl. per-agent model justification table), `HOWTORUN.md` (incl. ripgrep prerequisite) | Brief's required sections all present |
| 13 | Screenshots | Pipeline runs + final code | `docs/screenshots/*.png` (~12-15) | All brief-required screenshots present |
| 14 | AI-USAGE consolidation | Conversation + per-phase notes | Consolidated `docs/AI-USAGE.md` | Covers every phase; CMP table at top; decisions log HW4-specific (no HW2 copypasta) |
| 15 | PR | All commits | PR opened against fork's `main` with `Alexey-Popov` requested | PR body has summary + AI tools + per-agent table + challenges + screenshots; labels `homework-4`, `ready-for-review` |

### 8.3 Phase ordering rules

- **`docs/AI-USAGE.md` is a living document** — append after each code-producing phase (0-9, 12). Phases 10, 13 get one-liner entries. Phase 14 = consolidation.
- **Phase 1 blocks Phase 9** — agent frontmatter references skills; cross-ref validator fails if skill missing.
- **Phase 2 blocks Phase 3** — tests need `src/` to import.
- **Phase 4 blocks Phase 10** — pipeline reads `bug-context.md`.
- **Phases 5-8 are linear** — loaders → claude-runner (subprocess wrapper) → stages → entry CLI.
- **Phase 9 blocks Phase 10** — pipeline loads agents at startup.
- **Phase 10 blocks Phase 11** — review wants to see full picture.
- **Phase 11 blocks Phase 12** — docs describe post-review state.
- **Phase 13 blocks PR** — brief requires screenshots.

### 8.4 `/codex:review` brief (`docs/specs/review-brief.md`)

> Review the `homework-4-submission` branch diff vs `main`. Focus on:
> 1. **Subprocess wrapper safety** — `scripts/pipeline/claude-runner.ts`. Does `execFile('claude', args)` properly handle stdin for long user messages (no arg-length truncation)? Does the 5min timeout fire correctly? Is ENOENT distinguished from other errors with a clear install hint?
> 2. **Parallel stages isolation** — `stages.ts`. Security + TestGen via `Promise.allSettled`, not `Promise.all`? Does a TestGen failure leave half-written test files? Does the orchestrator correctly aggregate `failures[]` from both stages?
> 3. **Frontmatter validation strictness** — `agent-loader.ts`. Zod rejects all malformed inputs (bad model, missing required, kebab-case, unknown tool)? Does the `tools` enum match what `--allowed-tools` flag accepts?
> 4. **System dependency check** — `validators.ts`. Does startup detect missing `claude` CLI before first stage runs? Exit code 2 with clear install URL?
> 5. **Agent prompts hygiene** — `agents/*.agent.md`. Each prompt references its skills explicitly? `model_justification` specific? `tools` list is minimum-necessary (no `Bash` granted unnecessarily)?
> 6. **JWT verifier seeded bugs** — `src/jwt/`. 3 bugs exploitable as described? Decoder signature shape (rawHeader/rawPayload/header/payload) works end-to-end?
> 7. **Baseline test independence** — `tests/jwt-verifier.test.ts`. `vi.useFakeTimers()` paired with `vi.useRealTimers()` in afterEach?
>
> Out of scope: agent prompt quality (subjective), Claude Code subprocess internal behavior, real LLM output testing, formal pen-test.
>
> Output: `docs/reviews/codex-review-<date>.md` with `[BLOCKING]`, `[SUGGESTED]`, `[INFO]` tags.

### 8.5 No deploy phase

HW4 is local CLI tool. Reviewer clones, installs deps, runs pipeline once, inspects artifacts. All evidence lives in `context/bugs/<ID>/` and `docs/screenshots/`.

### 8.6 `docs/AI-USAGE.md` template

```markdown
# AI Tools — Usage Log (HW4)

> Living document — appended after each code-producing phase, consolidated in Phase 14.

## Context-Model-Prompt summary table
[§8.1 reproduced for one-page reference]

## Phase 0: Scaffold
**Tool:** Claude Code (claude-sonnet-4-6)
**Context loaded:** spec at docs/specs/..., empty repo state, brief at homework-4/TASKS.md
**Prompt:** [verbatim]
**Outcome:** accepted | edited | rejected
**What changed and why:** [one paragraph]

[... one entry per code-producing phase ...]

## Phase 10: E2E manual pipeline run
**Tool:** Claude Code CLI subprocess (via built pipeline)
**Models used by agents during run** (passed via `--model` flag on each `claude -p` invocation):
- Researcher: claude-sonnet-4-6
- Research Verifier: claude-opus-4-8
- Planner: claude-sonnet-4-6
- Bug Fixer: claude-sonnet-4-6
- Security Verifier: claude-opus-4-8
- Unit Test Generator: claude-sonnet-4-6
**Total cost per bug run:** $0 — runs against developer's Claude Code subscription.
**Wall time per bug run:** ~5-10 min (6 stages × ~1-2 min each).
**3 bug IDs processed:** 001-alg-none-bypass, 002-expiration-off-by-one, 003-timing-attack-signature
**Outcome:** all 3 runs exit 0, fixes applied, tests passing

## Decisions log (HW4-specific)
- Orchestrator runtime is `claude -p` subprocess (NOT direct @anthropic-ai/sdk). Considered but rejected because user has Claude Code subscription, no need for separate API key.
- 6 agents total (4 brief-required + Researcher + Planner) for true end-to-end autonomy
- **Switched orchestrator runtime from `@anthropic-ai/sdk` to `claude -p` subprocess** to use developer's Claude Code subscription instead of separate API key. Eliminates ~$15 cost barrier, delegates tool registry + tool-use loop + retries to Claude Code internally. Trade-off: ~2-5s subprocess startup per stage vs ~100ms SDK; ~290 LOC orchestrator vs ~500.
- Tools list in frontmatter (`tools: [Read, Grep, Edit, Write]`) maps directly to Claude Code `--allowed-tools` flag — no custom registry implementation needed
- Promise.allSettled for stages 5-6 for partial-failure isolation
- Single-bug per pipeline invocation matching context/bugs/XXX/ structure
- [add more during build as decisions arise]

## Cost summary (final)
| Phase | Tokens in | Tokens out | Cost (USD) |
[total at bottom]
```

---

## 9. Deliverables & repo conventions

### 9.1 `package.json` scripts (contract)

```jsonc
{
  "scripts": {
    "pipeline":         "tsx scripts/run-pipeline.ts",
    "pipeline:all":     "for bug in 001-alg-none-bypass 002-expiration-off-by-one 003-timing-attack-signature; do npm run pipeline -- --bug $bug || exit 1; done",
    "cli":              "tsx src/index.ts",
    "build":            "tsc -p tsconfig.json",
    "test":             "vitest run --coverage",
    "test:watch":       "vitest",
    "test:unit":        "vitest run tests/",
    "lint":             "eslint . --ext .ts",
    "typecheck":        "tsc --noEmit",
    "seed:bugs":        "tsx scripts/seed-bugs.ts",
    "fixtures:gen":     "tsx scripts/generate-fixtures.ts"
  }
}
```

**Platform notes:**
- `pipeline` (single-bug) — cross-platform (mac, linux, Windows-PowerShell/WSL).
- `pipeline:all` (batch) — POSIX shell only (uses bash `for` loop). On Windows native, use WSL2 or invoke 3 single-bug commands manually. HOWTORUN.md "Platform notes" section documents the workaround.
- Future-work bullet (see §10): rewrite `pipeline:all` as Node script wrapper for cross-platform execution.

### 9.2 Environment

`.env.example` (committed):

```bash
JWT_SECRET=test-secret-for-cli-demo-only
LOG_LEVEL=info
```

`.env` gitignored. **No `ANTHROPIC_API_KEY` needed** — agent dispatch goes through `claude -p` subprocess against developer's Claude Code subscription. Phase 10 prerequisite: Claude Code installed (`which claude`) and authenticated (`claude /login` once); all unit tests mock the subprocess.

### 9.3 Repo conventions

- **Branch:** `homework-4-submission`
- **Commits:** Conventional Commits. Phase boundaries from §8.2 are natural commit boundaries.
- **PR target:** fork's `main` (not upstream).
- **Reviewer:** `Alexey-Popov`.
- **Labels:** `homework-4`, `ready-for-review`.
- **PR body:** template per §9.4 with per-agent model justification table.

### 9.4 PR body template

```markdown
## Summary
<what was implemented, ~150 words; emphasize 4 required agents + 2 skills + sample app + orchestrator>

## AI tools used (CMP summary for OUR build)
| Phase | Tool | Model | Outcome |
|---|---|---|---|
| Phases 0-9 (scaffold → agents) | Claude Code | Sonnet 4.6 | accepted |
| Phase 10 (E2E pipeline run) | Claude Code CLI subprocess | Mixed (Opus 4.8 + Sonnet 4.6 per agent, via `--model` flag) | 3 bugs processed; $0 cost — uses Claude Code subscription |
| Phase 11 (Code review) | /codex:review | (skill internal) | N findings, N addressed |
| Phase 12 (README + agent justifications) | Claude Code | Opus 4.8 | accepted |
| Phase 12 (HOWTORUN) | Claude Code | Sonnet 4.6 | accepted |
| Phase 13 (Screenshots) | Playwright MCP / manual | N/A | 12+ shots |

## Per-agent model justification (also in README)
| Agent | Model | Justification |
|---|---|---|
| Researcher | Sonnet 4.6 | Routine grep/read; reasoning not critical |
| Research Verifier | **Opus 4.8** | Fact-checking line refs + snippet match — false positives unacceptable |
| Planner | Sonnet 4.6 | Structured planning from verified inputs |
| Bug Fixer | Sonnet 4.6 | Mechanical Edit per plan |
| Security Verifier | **Opus 4.8** | Security review — false negatives are critical |
| Unit Test Generator | Sonnet 4.6 | FIRST-compliant tests, pattern-driven |

## How to verify
1. `git checkout homework-4-submission && cd homework-4`
2. `npm i && cp .env.example .env` (no API key needed)
3. Install Claude Code: see https://docs.anthropic.com/claude-code, then `claude /login` once.
4. `npm test` — orchestrator + baseline tests (offline, mocked subprocess)
5. `npm run cli -- verify "$(cat tests/fixtures/alg-none-token.txt)"` — exploit demo (returns valid:true pre-fix!)
6. `npm run pipeline -- --bug 001-alg-none-bypass` — runs 6-stage pipeline via `claude -p` subprocess
7. `npm test` again — bug-specific tests now green
8. Inspect `context/bugs/001-alg-none-bypass/` for all 6 generated artifacts

## Challenges
<2-4 honest bullets>

## Screenshots
<embed pre-pipeline-tests.png, pipeline-run-001-stdout.png, post-pipeline-tests.png, security-report-001.png inline; link rest>
```

### 9.5 Grading-rubric mapping

Extrapolating from HW1/HW2 + brief emphasis:

| Rubric line | Where it lives | Weight (est.) |
|---|---|---|
| Pipeline correctness & single-command | `scripts/run-pipeline.ts`, `pipeline:all`, all 6 agents executable | 30% |
| AI Usage Documentation | `docs/AI-USAGE.md` with CMP table, per-agent model justification table, brief's "justify the choice" requirement | 25% |
| Code quality | Layered orchestrator (~500 LOC), Zod-validated frontmatter, ≥85% test coverage, `/codex:review` clean | 20% |
| Documentation | README (incl. per-agent table + author), HOWTORUN, in-line agent prompts as docs | 15% |
| Demo & Screenshots | `docs/screenshots/` (~12+ shots), `context/bugs/*/` as committed evidence | 10% |

**Brief-specific requirements (explicit verification):**

- ✅ **4 required agents** — `agents/{research-verifier,bug-fixer,security-verifier,unit-test-generator}.agent.md` + 2 supporting (researcher, planner).
- ✅ **Single-command execution** — `npm run pipeline -- --bug <ID>`. Loads agents + skills automatically (§6.2).
- ✅ **Explicit model selection per agent** — `model:` field in every frontmatter, Zod-validated against `MODELS` enum.
- ✅ **Justify the choice in README** — per-agent table.
- ✅ **Skill for research quality (Task 1.2)** — `skills/research-quality-measurement.md` per §4.3.
- ✅ **FIRST skill (Task 4.2)** — `skills/unit-tests-FIRST.md` per §4.4.
- ✅ **Sample mini app with ≥2 bugs + ≥1 security issue** — JWT verifier per §5, with 3 issues (1 logic + 2 security).
- ✅ **Before/after state demonstrable** — baseline tests fail pre-pipeline, pass post-pipeline; exploit CLI run captured in screenshots.
- ✅ **Agent outputs all present** — `context/bugs/<ID>/{verified-research,fix-summary,security-report,test-report}.md` for all 3 bugs.

---

## 10. Open questions / future work

Stated in README "Future work":

- HTTP server for JWT verifier (CLI only in v1).
- RS256/ES256 support (HS256 only in v1).
- Real Claude Code E2E smoke tests in CI (requires headless `claude` CLI authentication, currently manual).
- Migration path to direct `@anthropic-ai/sdk` with custom tool registry (for production use cases where Claude Code subscription isn't available) — currently out of scope.
- Parallel multi-bug pipeline runs (single bug per invocation; `pipeline:all` is sequential wrapper).
- Cross-bug regression detection (each bug isolated).
- Streaming pipeline output (orchestrator buffers, prints final summary).
- LLM-based skill auto-update (skills hand-authored).
- Per-file coverage thresholds via custom Vitest reporter (current: global threshold + manual review attention).
- Cross-platform `pipeline:all` via Node script wrapper instead of bash `for` loop (current: POSIX shell only; Windows native users must invoke 3 single-bug commands manually or use WSL2).
- GitHub Actions workflow.

---

## 11. Acceptance checklist

The implementation is complete when **all** are true:

- [ ] `npm run pipeline -- --bug nonexistent` exits 2 with clear error message
- [ ] `npm run pipeline -- --bug 001-alg-none-bypass` exits 0, produces all 6 artifacts
- [ ] Same for bugs 002 and 003
- [ ] All 6 `agents/*.agent.md` files load without Zod errors and cross-ref to skills correctly
- [ ] Both `skills/*.md` files pass `validateSkillStructure`
- [ ] `npm test` passes with ≥85% coverage (lines/branches/functions/statements) — perFile threshold
- [ ] Baseline tests pre-fix: 3 failing, 2 passing
- [ ] Baseline tests post-pipeline (all 3 bugs): all green
- [ ] `tests/fixtures/{valid,alg-none,expired}-token.txt` exist and contain valid JWT-shaped strings
- [ ] `tests/jwt-verifier/` contains 3+ generated test files (one per bug), all FIRST-compliant
- [ ] `context/bugs/<ID>/` for all 3 bugs contains: bug-context.md (seeded), research/, implementation-plan.md, fix-summary.md (incl. Test Results section), security-report.md, test-report.md (incl. Final Test Run section)
- [ ] `docs/reviews/codex-review-<date>.md` exists with all blocking comments addressed or waived
- [ ] `docs/AI-USAGE.md` covers every phase from §8.2, CMP table at top, decisions log HW4-specific
- [ ] `docs/screenshots/` contains all artifacts listed in §2 module map (~12-15 shots)
- [ ] `README.md` and `HOWTORUN.md` written; README contains per-agent model justification table; HOWTORUN contains Claude Code prerequisite (`which claude` + `claude /login`) + step-by-step setup; no `ANTHROPIC_API_KEY` referenced anywhere
- [ ] PR opened against fork's `main` with templated body, `Alexey-Popov` requested as reviewer, labels `homework-4` and `ready-for-review`
