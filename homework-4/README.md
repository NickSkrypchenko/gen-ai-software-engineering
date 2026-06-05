# Homework 4 — 6-Agent Autonomous Bug-Fixing Pipeline

A single-command, multi-agent pipeline that takes a seeded bug report and drives it
through research, verification, planning, fixing, security review, and test generation
to completion — fully autonomously. Each stage is a distinct agent defined in
`agents/*.agent.md` (model, tools, skills, and prompt in one file). The orchestrator
does **not** call the Anthropic SDK directly; instead it spawns the **Claude Code CLI
in non-interactive print mode (`claude -p`)** as the agent runtime, one subprocess per
stage. Claude Code owns the tool-use loop, retries, and the built-in `Read`/`Grep`/`Edit`/`Write`
tools, while the orchestrator only builds prompts, passes file-based context between
agents via XML-tagged messages, and writes each stage's output artifact. Because the
runtime is the developer's existing Claude Code subscription, the pipeline needs **no
`ANTHROPIC_API_KEY` and costs $0 per run**. The agent chain is:
Researcher → Research Verifier → Planner → Bug Fixer → (Security Verifier ‖ Unit Test Generator).

The artifact under analysis is a minimal HS256 JWT verifier CLI (`src/`) with three
seeded issues (1 logic bug + 2 security vulnerabilities) used to demonstrate
observable before/after behavior.

---

## Architecture

```
                        npm run pipeline -- --bug <ID>
                                     │
                                     ▼
          ┌──────────────────────────────────────────────────┐
          │  Orchestrator (scripts/run-pipeline.ts → stages)  │
          │  - loads + Zod-validates 6 agents & 2 skills      │
          │  - checks `claude` CLI + git on PATH (exit 2)     │
          │  - spawns `claude -p` per stage, writes artifacts │
          └──────────────────────────────────────────────────┘
                                     │
                            sequential (stop on error)
                                     │
   ┌──────────────┐   ┌─────────────────────┐   ┌───────────┐   ┌───────────┐
   │ 1 Researcher │──▶│ 2 Research Verifier  │──▶│ 3 Planner │──▶│ 4 Bug     │
   │ Sonnet 4.6   │   │ Opus 4.8 (skill:     │   │ Sonnet4.6 │   │   Fixer   │
   │ Read, Grep   │   │ research-quality)    │   │ Read,Grep │   │ Sonnet4.6 │
   │              │   │ Read, Grep           │   │           │   │ +Edit/Wr. │
   └──────────────┘   └─────────────────────┘   └───────────┘   └─────┬─────┘
   codebase-          verified-research.md       implementation-       │
   research.md                                   plan.md          fix-summary.md
                                                                       │
                                  orchestrator runs `vitest` (deterministic),
                                  appends Test Results to fix-summary.md
                                                                       │
                                          ┌────────────────────────────┴───────────────┐
                                          │      Promise.allSettled (parallel,          │
                                          │      partial-failure isolation)             │
                                          ▼                                             ▼
                              ┌────────────────────────┐               ┌──────────────────────────────┐
                              │ 5 Security Verifier     │               │ 6 Unit Test Generator        │
                              │ Opus 4.8                │               │ Sonnet 4.6 (skill:           │
                              │ Read, Grep              │               │ unit-tests-FIRST)            │
                              │                         │               │ Read, Grep, Write            │
                              └────────────────────────┘               └──────────────────────────────┘
                              security-report.md                       test-report.md
                                                                       (+ orchestrator re-runs tests,
                                                                        appends Final Test Run)
```

Agents communicate only through files in `context/bugs/<ID>/`. Each stage receives the
prior stage's output, wrapped in XML-style tags (`<bug-context>`, `<verified-research>`,
`<changed-file name="...">`) in the user message streamed to `claude -p` over stdin.

---

## Per-agent model justification

Models are assigned per agent in YAML frontmatter (`model:` field, Zod-validated against
the `claude-opus-4-8 | claude-sonnet-4-6` enum at startup) and passed to Claude Code via
the `--model` flag on each `claude -p` invocation. The two **verification** stages — where
a missed error is far more costly than a slow response — run on **Opus 4.8**; the routine
read/grep/edit stages run on **Sonnet 4.6**.

| Agent | Model | Justification |
|---|---|---|
| Researcher | Sonnet 4.6 | Mechanical exploration: grep `src/`, read candidate files, report `file:line` references and snippets. The reasoning load is low and its output is fact-checked downstream by the Research Verifier, so a fast, capable model is the right cost/latency trade-off. |
| Research Verifier | **Opus 4.8** | High-precision fact-checking: every `file:line` reference and verbatim snippet from the researcher must be matched character-by-character against source and scored L0–L4 via the `research-quality-measurement` skill. A false "verified" silently corrupts every later stage, so the pipeline pays for Opus-grade precision exactly where errors propagate furthest. |
| Planner | Sonnet 4.6 | Structured transformation of already-verified research into an ordered before→after change plan. Inputs are trusted and the task is well-bounded, so Sonnet handles it reliably without Opus cost. |
| Bug Fixer | Sonnet 4.6 | Mechanical application of the plan's before→after edits using the `Edit`/`Write` tools. The change region and intent are fully specified by the planner; this is execution, not open-ended reasoning, so Sonnet is sufficient. |
| Security Verifier | **Opus 4.8** | Adversarial security review of the changed code (injection, hardcoded secrets, insecure comparisons, missing validation). False negatives in a security gate are the worst possible failure — a missed vulnerability ships — so this stage gets the strongest reasoning model to maximize recall on subtle issues. |
| Unit Test Generator | Sonnet 4.6 | Pattern-driven generation of FIRST-compliant Vitest tests scoped to the changed code, guided by the `unit-tests-FIRST` skill and existing test patterns. The skill supplies the quality rubric, making this constrained, example-led work that Sonnet executes well. |

**Opus showcase:** Opus 4.8 is reserved for the two stages whose output is a *judgment*
the rest of the pipeline trusts blindly (research verification, security sign-off). Every
other stage either produces easily-checked structured output or is itself checked
downstream, so Sonnet 4.6 delivers the same end result at lower latency and cost.

---

## Project structure

```
homework-4/
├── agents/                      6 agent definitions (.agent.md: frontmatter + prompt)
│   ├── researcher.agent.md              Sonnet 4.6 — Read, Grep
│   ├── research-verifier.agent.md       Opus 4.8   — skill: research-quality-measurement
│   ├── planner.agent.md                 Sonnet 4.6
│   ├── bug-fixer.agent.md               Sonnet 4.6 — Edit, Write
│   ├── security-verifier.agent.md       Opus 4.8
│   └── unit-test-generator.agent.md     Sonnet 4.6 — Write — skill: unit-tests-FIRST
│
├── skills/                      Domain rubrics injected into agent system prompts
│   ├── research-quality-measurement.md  L0–L4 research quality levels
│   └── unit-tests-FIRST.md              F-I-R-S-T unit-test principles
│
├── scripts/
│   ├── run-pipeline.ts          CLI entry — argv parse + startup validation
│   └── pipeline/
│       ├── agent-loader.ts      parse + Zod-validate agents/*.agent.md
│       ├── skill-loader.ts      load + structure-check skills/*.md
│       ├── validators.ts        cross-ref skills, check `claude`/git on PATH
│       ├── claude-runner.ts     spawn `claude -p` subprocess per stage
│       ├── stages.ts            sequential 1–4, allSettled 5–6, runs tests
│       ├── messages.ts          XML-tagged user-message builder
│       ├── logger.ts            pino logger
│       └── types.ts             shared types
│
├── src/                         Sample HS256 JWT verifier CLI (artifact under analysis)
│   └── jwt/                      verifier / decoder / signature / claims (3 seeded bugs)
│
├── tests/
│   ├── jwt-verifier.test.ts     5 baseline tests (3 failing pre-fix)
│   ├── jwt-verifier/            tests written by Unit Test Generator at run time
│   └── pipeline/                ~30 orchestrator unit tests (subprocess mocked)
│
├── context/bugs/<ID>/           per-bug seed + all generated artifacts
│   ├── bug-context.md           seeded input (committed)
│   ├── research/                codebase-research.md, verified-research.md
│   ├── implementation-plan.md   fix-summary.md, security-report.md, test-report.md
│
└── docs/                        spec, AI-USAGE, codex reviews, screenshots
```

Skills here are **domain rubric documents** injected into agent system prompts as
`<skill name="...">` blocks — they are not Claude Code plug-in skills from `~/.claude/skills/`,
despite the shared terminology.

---

## Quick start

```bash
npm install
cp .env.example .env          # no ANTHROPIC_API_KEY needed
npm test                      # orchestrator + baseline tests (offline, subprocess mocked)
npm run pipeline -- --bug 001-alg-none-bypass
```

Running the real pipeline requires the Claude Code CLI installed and authenticated
(`which claude` + `claude /login` once). For full prerequisites, platform notes, the
exploit demo, and the before/after walkthrough, see **[HOWTORUN.md](./HOWTORUN.md)**.

Exit codes: `0` all six stages clean · `1` an agent stage failed · `2` pre-flight failure
(usage error, missing bug folder, missing `claude`/git, invalid frontmatter or skill ref).
