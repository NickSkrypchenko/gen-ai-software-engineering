# Homework 4 — 6-Agent Autonomous Bug-Fixing Pipeline

## Summary

A single-command, fully autonomous pipeline that takes a seeded bug report and drives it through research, verification, planning, fixing, security review, and test generation using 6 Claude agents in sequence. Each agent runs as a `claude -p` subprocess — the orchestrator never calls the Anthropic SDK directly, so the pipeline requires no `ANTHROPIC_API_KEY` and uses the developer's existing Claude Code subscription.

**Three JWT security bugs** (alg=none bypass, expiration off-by-one, timing-attack signature comparison) were used as the demonstration artifact. All three were found, planned, fixed, and tested autonomously by the pipeline.

---

## Implementation overview

### Architecture

```
npm run pipeline -- --bug <ID>
          │
          ▼
     Orchestrator
          │
          ├── Stage 1: Researcher        (Sonnet 4.6 · Read, Grep)
          ├── Stage 2: Research Verifier (Opus 4.8  · Read, Grep · skill: research-quality-measurement)
          ├── Stage 3: Planner           (Sonnet 4.6 · Read, Grep)
          ├── Stage 4: Bug Fixer         (Sonnet 4.6 · Read, Grep, Edit, Write)
          │              └── orchestrator runs vitest, appends results
          │
          └── Promise.allSettled ──┬── Stage 5: Security Verifier    (Opus 4.8  · Read, Grep)
                                   └── Stage 6: Unit Test Generator  (Sonnet 4.6 · Read, Grep, Write · skill: unit-tests-FIRST)
                                                  └── orchestrator re-runs vitest, appends to test-report
```

### Key design decisions

| Decision | Rationale |
|---|---|
| `claude -p` subprocess, not SDK | Uses Claude Code subscription; delegates tool-use loop + retries to Claude Code internally |
| CommonJS (`"module": "commonjs"`) | Eliminates `.js` extension friction with tsx; required for top-level `vi.mock` hoisting in Vitest |
| DI seam (`spawn` param on `runAgent`) | `vi.mock('node:child_process')` does not intercept CJS local bindings; injected `vi.fn()` does |
| `Promise.allSettled` for stages 5–6 | Partial-failure isolation — security review failure does not block test generation |
| `reportOnFailure: true` in Vitest | Pre-fix baseline tests intentionally fail; coverage must still generate to verify per-file thresholds |
| `/* c8 ignore */` on `spawnClaude` | Subprocess seam excluded from coverage; DI injection is the test contract |
| Opus 4.8 for stages 2 + 5 | Research verification and security review are precision-critical — false negatives worse than latency |
| `perFile: true` coverage threshold | Prevents one well-tested file from masking an undertested one in the global average |

### Pipeline bugs fixed during E2E run (Phase 10)

Two bugs in the orchestrator itself were discovered while running the pipeline against real Claude subprocesses:

1. **`execFile` ignores `input` option (async)** — `child_process.execFile` does not support stdin injection via `input` in async mode; only `execFileSync` does. Claude waited 3 s for stdin, got nothing, and errored. Fixed by replacing with `spawn` + `child.stdin.write()`.

2. **`git diff --name-only` returns repo-root-relative paths** — CWD is `homework-4/`, but git returned `homework-4/src/jwt/verifier.ts`. `readFile` resolved to `homework-4/homework-4/…` (ENOENT). Fixed by adding `--relative` flag.

### Code review findings (Phase 11 — `/code-review ultra`)

Local multi-agent review (9 finder angles + 1-vote verification + gap sweep). **4 confirmed bugs fixed:**

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | CRITICAL | `child.stdin` EPIPE → uncaughtException if subprocess exits before reading stdin | Added `child.stdin.on('error', () => {})` |
| 2 | HIGH | `tools:[]` → `[].join(',') = ''` falsy → `--allowedTools` omitted → unrestricted subprocess | Changed to `spec.tools.length > 0` guard; passes `'none'` explicitly |
| 3 | HIGH | `gitDiffNames` `execFileSync` no try/catch → partial pipeline state on git failure | Wrapped in try/catch; returns `[]` on failure |
| 4 | HIGH | `runTests()` no timeout on `execFileSync` → infinite hang on vitest deadlock | Added `timeout: 3 * 60 * 1000` |

---

## Test results

![Test Results — 72/72 passing, all per-file coverage ≥ 85%](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-4-submission/homework-4/docs/screenshots/01-test-results.png)

**72 tests passing / 0 failing** across 11 test files.  
All per-file coverage ≥ 85% (threshold: lines / branches / functions / statements).

---

## Pipeline run — all 3 bugs

![Pipeline runs — all 3 bugs, 6 agents each, 0 failures](https://raw.githubusercontent.com/NickSkrypchenko/gen-ai-software-engineering/homework-4-submission/homework-4/docs/screenshots/02-pipeline-run.png)

Each bug was processed by all 6 agents with 0 failures. Typical wall-time per bug: ~5 min.  
Stages 5 and 6 run in parallel (`Promise.allSettled`) — their `"starting"` log lines interleave.

---

## Artifacts produced per pipeline run

```
context/bugs/<ID>/
  research/
    codebase-research.md      ← Researcher output
    verified-research.md      ← Research Verifier output (L0–L4 quality score)
  implementation-plan.md      ← Planner output (Before/After code snippets)
  fix-summary.md              ← Bug Fixer output + orchestrator test results
  security-report.md          ← Security Verifier output (CRITICAL/HIGH/… findings)
  test-report.md              ← Unit Test Generator output + final vitest run
```

Agent-generated test files (from Unit Test Generator):
- `tests/jwt-verifier/claims.test.ts` — 4 tests
- `tests/jwt-verifier/verifier.test.ts` — 3 tests
- `tests/jwt-verifier/signature.test.ts` — 3 tests

---

## AI tool log

Full per-phase log: [`docs/AI-USAGE.md`](docs/AI-USAGE.md)

| Phase | Surface | Model | Strategy |
|---|---|---|---|
| 0 | Scaffold | Sonnet 4.6 | Imperative kickoff from spec |
| 1 | Skills (research-quality, FIRST) | Sonnet 4.6 | 2 skill files per defined shape |
| 2 | JWT app + 3 seeded bugs | Sonnet 4.6 | src/jwt/* + types, bugs embedded exactly as specced |
| 3 | Baseline tests + fixtures | Sonnet 4.6 | 5 tests (3 pre-fix failing) + jwt-fixtures.ts |
| 4 | Bug context files | Sonnet 4.6 | 3 × context/bugs/\<ID\>/bug-context.md |
| 5 | Loaders + validators + tests | Sonnet 4.6 | 25 unit tests across 4 files |
| 6 | Claude runner + DI seam | Sonnet 4.6 | `spawn` wrapper; DI over vi.mock |
| 7 | Stages (sequential + allSettled) | Sonnet 4.6 | gitDiffNames → changed-file context injection |
| 8 | run-pipeline entry + coverage hardening | Sonnet 4.6 | perFile ≥85%, reportOnFailure, c8 ignore |
| 9 | 6 agent .agent.md files | Sonnet 4.6 | User-reviewed before commit (ground rule §4) |
| 10 | E2E pipeline × 3 bugs | Opus 4.8 + Sonnet 4.6 (per agent) | `npm run pipeline -- --bug <ID>` × 3 |
| 11 | Code review | `/code-review ultra` (local) | 9-angle finder + verify + gap sweep; 4 bugs fixed |
| 12 | README + HOWTORUN | Opus 4.8 / Sonnet 4.6 | Opus for justification table; Sonnet for runbook |
| 13 | Screenshots | Playwright MCP | HTML render → `browser_take_screenshot` |
| 14 | AI-USAGE consolidation | Sonnet 4.6 | Editorial pass |

---

## Commit history

```
a9ad519 docs(phase-13-14): screenshots + AI-USAGE consolidation
34f6f42 docs(phase-12): add README and HOWTORUN
5bf48e0 fix(code-review): address 4 confirmed bugs from /code-review ultra
b365e0c feat(phase-10): E2E pipeline runs — all 3 bugs fixed by agents
357e775 fix(pipeline): fix stdin piping and git diff path resolution
9a06112 feat(phase-9): write 6 agent .agent.md files
ed9970b feat(phase-8): complete run-pipeline entry + coverage hardening
cf06a95 feat(phase-7): implement stages with sequential/parallel execution
1a8269c feat(phase-6): implement claude-runner subprocess wrapper with DI seam
4fcf622 test(phase-5): add unit tests for loaders, validators, messages
4d11946 feat(phase-4): add bug context files for all 3 seeded issues
4fdcc02 feat(phase-3): add baseline JWT tests and token fixtures
a115777 feat(phase-2): add sample JWT verifier CLI with 3 seeded bugs
879844f feat(phase-1): add research-quality-measurement and unit-tests-FIRST skills
1ada725 feat(phase-0): scaffold homework-4 pipeline project
```
