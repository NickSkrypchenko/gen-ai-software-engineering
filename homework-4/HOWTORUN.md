# HOWTORUN — homework-4 cold-start runbook

6-agent autonomous bug-fixing pipeline. A single command drives six Claude Code
subprocesses (researcher, research-verifier, planner, bug-fixer, security-verifier,
unit-test-generator) sequentially and writes structured artifacts for each bug.

---

## Prerequisites

| Requirement | Check | Install |
|---|---|---|
| Node.js >= 22 | `node --version` | https://nodejs.org |
| npm >= 10 | `npm --version` | bundled with Node |
| Claude Code CLI | `claude --version` | see below |
| git | `git --version` | https://git-scm.com |

**No Anthropic API key is needed.** The pipeline invokes `claude -p` as a
subprocess, which uses your Claude Code subscription (same account you use in
the editor). No `ANTHROPIC_API_KEY` environment variable is read at any point.

### Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude auth login          # opens browser for one-time OAuth
claude --version           # should print a version string
```

---

## Environment setup

Copy the example file and adjust if needed:

```bash
cd homework-4
cp .env.example .env
```

The defaults (`JWT_SECRET=test-secret-for-cli-demo-only`, `LOG_LEVEL=info`) are
sufficient for all three bugs. You do not need a database or external service.

---

## Installation

```bash
cd homework-4
npm install
```

---

## Run a single bug

Three bug IDs are available:

| ID | Description |
|---|---|
| `001-alg-none-bypass` | JWT verifier accepts unsigned `alg=none` tokens |
| `002-expiration-off-by-one` | Expiration boundary uses `<=` instead of `<` |
| `003-timing-attack-signature` | Signature comparison is not timing-safe |

```bash
npm run pipeline -- --bug 001-alg-none-bypass
npm run pipeline -- --bug 002-expiration-off-by-one
npm run pipeline -- --bug 003-timing-attack-signature
```

Short form with `-b`:

```bash
npm run pipeline -- -b 001-alg-none-bypass
```

---

## Run all three bugs in sequence

```bash
npm run pipeline:all
```

This runs the three bugs one after another and stops on the first pipeline
failure (`|| exit 1`). Each bug's artifacts are independent.

---

## Run the test suite

```bash
npm test            # vitest run --coverage (all tests)
npm run test:unit   # tests/ directory only, no coverage gate
npm run test:watch  # interactive watch mode
```

### Intentionally failing baseline tests

Three test files contain tests that fail against the buggy source and pass
only after the pipeline applies its fixes:

| Test file | Bug it covers | What it asserts |
|---|---|---|
| `tests/jwt-verifier/verifier.test.ts` | 001 | `alg=none` token rejected with `"unsupported algorithm: none"` |
| `tests/jwt-verifier/claims.test.ts` | 002 | Token with `exp == now` is rejected (strict `<` boundary) |
| `tests/jwt-verifier/signature.test.ts` | 003 | Same-length wrong signature rejected via `timingSafeEqual` |

Before any pipeline run, `npm test` reports three failing tests. After all
three bugs are fixed, the full suite passes.

---

## Expected log output

The pipeline emits newline-delimited pino JSON. With `LOG_LEVEL=info` a
typical run looks like (durations are approximate):

```
{"level":30,"msg":"starting","agent":"researcher","model":"claude-sonnet-4-6"}
{"level":30,"msg":"done","agent":"researcher","durationMs":18420}
{"level":30,"msg":"starting","agent":"research-verifier","model":"claude-sonnet-4-6"}
{"level":30,"msg":"done","agent":"research-verifier","durationMs":14810}
{"level":30,"msg":"starting","agent":"planner","model":"claude-sonnet-4-6"}
{"level":30,"msg":"done","agent":"planner","durationMs":22300}
{"level":30,"msg":"starting","agent":"bug-fixer","model":"claude-sonnet-4-6"}
{"level":30,"msg":"done","agent":"bug-fixer","durationMs":31050}
{"level":30,"msg":"starting","agent":"security-verifier","model":"claude-sonnet-4-6"}
{"level":30,"msg":"starting","agent":"unit-test-generator","model":"claude-sonnet-4-6"}
{"level":30,"msg":"done","agent":"security-verifier","durationMs":17200}
{"level":30,"msg":"done","agent":"unit-test-generator","durationMs":19900}
{"level":30,"msg":"Pipeline complete","summary":{"bugId":"001-alg-none-bypass","stagesRun":6,"failures":[]}}
```

Stages 1-4 run sequentially. Stages 5 (security-verifier) and 6
(unit-test-generator) start in parallel, so their `starting` lines may
interleave. The whole pipeline for one bug typically finishes in 2-4 minutes.

---

## Artifacts written per run

After a successful run, `context/bugs/<ID>/` contains:

```
context/bugs/<ID>/
  bug-context.md                  # input — you provide this before the run
  research/
    codebase-research.md          # Stage 1 output (researcher)
    verified-research.md          # Stage 2 output (research-verifier)
  implementation-plan.md          # Stage 3 output (planner)
  fix-summary.md                  # Stage 4 output (bug-fixer)
                                  #   + orchestrator-appended test results
  security-report.md              # Stage 5 output (security-verifier)
  test-report.md                  # Stage 6 output (unit-test-generator)
                                  #   + orchestrator-appended final test run
```

All files are plain Markdown. Re-running a bug overwrites existing artifacts.

---

## Troubleshooting

**`claude: command not found`**
The Claude Code CLI is not installed or not on `PATH`.
Install it: `npm install -g @anthropic-ai/claude-code`, then verify with
`claude --version`. If the binary exists but is not on `PATH`, add the npm
global bin directory to your shell's `PATH` (run `npm bin -g` to find it).

**`Pipeline failed: Bug not found: context/bugs/<ID>/bug-context.md`**
The bug ID passed to `--bug` does not match any directory under `context/bugs/`.
Valid IDs: `001-alg-none-bypass`, `002-expiration-off-by-one`,
`003-timing-attack-signature`. Check for typos and make sure you are running
from inside the `homework-4/` directory.

**`Agent X failed: Command failed: claude -p`**
A transient Claude API error. Re-run the same command; the pipeline is
stateless and idempotent. Each stage reads its input fresh from disk, so a
retry starts cleanly.

**Rate-limit / overloaded errors**
The pipeline has no built-in back-off. If you see `overloaded_error` or HTTP
529 in the stderr log, wait 30-60 seconds and re-run. Running `pipeline:all`
back-to-back can trigger rate limits; run one bug at a time if that happens.

**`Agent X exceeded 300s timeout`**
Each `claude -p` subprocess is killed after 5 minutes. This is rare but can
happen under high API load. Re-run the pipeline for that bug.

**`missing system dependency: npx`**
`npx` must be on `PATH` (it ships with Node.js >= 16). Reinstall Node.js or
add `$(npm bin)` to your `PATH`.

---

## Adding a new bug

1. Create a directory under `context/bugs/` using the naming convention
   `<NNN>-<short-slug>`, for example `004-missing-issuer-check`.

2. Write `context/bugs/004-missing-issuer-check/bug-context.md` using the
   same structure as the existing files:

   ```markdown
   # Bug 004 — <title>

   ## Symptom
   ...

   ## Reproduction
   ...

   ## Suspected severity
   ...

   ## Hint
   ...

   ## Expected behavior
   ...
   ```

3. Run the pipeline:

   ```bash
   npm run pipeline -- --bug 004-missing-issuer-check
   ```

The pipeline discovers bug IDs only by the presence of
`context/bugs/<ID>/bug-context.md`; no registration or configuration file
needs to be updated.
