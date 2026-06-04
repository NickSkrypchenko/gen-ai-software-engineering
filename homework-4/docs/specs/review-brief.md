# Code Review Brief — Homework 4 (`homework-4-submission` branch)

> Input to `/codex:review` (Phase 11). Reviewer: Claude Code.

## Scope

Review the `homework-4-submission` branch diff vs `main`. Focus exclusively on the
items below. Out of scope: agent prompt quality (subjective), Claude Code subprocess
internal behavior, real LLM output testing, formal pen-test.

## Review checklist

### 1. Subprocess wrapper safety — `scripts/pipeline/claude-runner.ts`

- Does `spawnClaude` properly pass `userMessage` via stdin (`input` option) rather than
  as a shell arg (avoiding arg-length truncation at ~128 KB)?
- Does the 5-minute timeout fire correctly (`timeout: SUBPROCESS_TIMEOUT_MS`)?
- Is ENOENT distinguished from other errors with a clear install hint?
- Is the `spawn` injectable seam documented enough for future contributors?

### 2. Parallel stages isolation — `scripts/pipeline/stages.ts`

- Stages 5-6 (Security + TestGen) use `Promise.allSettled`, not `Promise.all`?
- Does a TestGen failure leave test-report.md partially written or absent?
- Does the orchestrator correctly aggregate `failures[]` from both stages?
- Does `runTests()` catch exceptions from `execFileSync` (Vitest non-zero exit)?

### 3. Frontmatter validation strictness — `scripts/pipeline/agent-loader.ts`

- Zod rejects all malformed inputs: bad model string, missing required fields,
  non-kebab-case name, unknown tool name?
- Does the `tools` enum (`TOOLS`) match the tool names that `--allowedTools` accepts?
- Is the error message from Zod rejection readable (file + field path + message)?

### 4. System dependency check — `scripts/pipeline/validators.ts`

- Does `checkSystemDependencies()` detect missing `claude` CLI before stage 1 runs?
- Does it exit with code 2 and print a clear install URL?
- Are all 3 deps checked: `claude`, `git`, `npx`?

### 5. Agent prompts hygiene — `agents/*.agent.md`

- Each prompt explicitly references the skills it uses (for reader clarity)?
- `model_justification` is specific (not generic boilerplate)?
- `tools` list is minimum-necessary (no `Bash` granted to read-only agents)?
- All 6 frontmatter files load without Zod errors (`npm run pipeline -- --bug nonexistent`
  exits 2 with "Bug not found", not a Zod error)?

### 6. JWT verifier seeded bugs — `src/jwt/`

- 3 bugs are exploitable exactly as described in `context/bugs/XXX/bug-context.md`?
- Decoder return shape (`rawHeader`/`rawPayload`/`header`/`payload`) works end-to-end
  for the happy-path signing flow?
- `alg=none` exploit works before pipeline (CLI returns `valid:true`)?

### 7. Baseline test independence — `tests/jwt-verifier.test.ts`

- `vi.useFakeTimers()` paired with `vi.useRealTimers()` in `afterEach`?
- Test 4 (exp boundary) uses `vi.setSystemTime` correctly?
- Bug 003 test uses source-inspection pattern (`readFileSync` + `toMatch(/timingSafeEqual/)`)
  and doesn't depend on runtime behavior (correct, since timing attacks aren't unit-testable)?

## Output format

Write findings to `docs/reviews/codex-review-<date>.md` with tags:
- `[BLOCKING]` — must fix before PR is opened
- `[SUGGESTED]` — quality improvement, not required
- `[INFO]` — observation, no action needed
