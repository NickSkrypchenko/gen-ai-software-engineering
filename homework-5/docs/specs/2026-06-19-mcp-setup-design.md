# HW5 — MCP Servers Setup & Custom FastMCP Server — Design Specification

**Project:** Homework 5 — Configure 3 external MCP servers (GitHub, Filesystem, Notion) + build 1 custom FastMCP server
**Course:** GenAI and Agentic AI for Software Engineering — Lesson 6 focus: MCP servers as tool surfaces
**Author:** Nicko (drafted with Claude in brainstorming mode, this Cowork session)
**Date:** 2026-06-19
**Status:** Approved for implementation
**Implementation driver:** Claude Code (CLI sessions, phases 1-9)

---

## 0. Purpose & scope

This document is the implementation contract for Homework 5. It defines what's built, how the 4 MCP servers are configured and demonstrated, and which phases require user intervention vs autonomous Claude Code execution.

**In scope.** Configure 3 external MCP servers in Claude Desktop — GitHub (community `@modelcontextprotocol/server-github`), Filesystem (`@modelcontextprotocol/server-filesystem` scoped to repo root), Notion (`@notionhq/notion-mcp-server`). Build 1 custom FastMCP server in `custom-mcp-server/` that exposes a resource template `lorem://words/{word_count}` and a tool `read(word_count: int = 30)`, both reading from `lorem-ipsum.md` and returning the first `word_count` words. Tests via `pytest` + FastMCP in-memory `Client`. Reference `mcp.json` (Claude Code format, placeholder env vars) committed to repo as the brief-required deliverable. Demo via 4 separate Claude Desktop chats with screenshots. AI-USAGE log following Context-Model-Prompt (CMP) framework from HW4 §8.1. README with per-server table + per-server justification prose; HOWTORUN with cold-start runbook including 3 token-verification alternatives. Phase 8 = inline self-review + explicit secret-grep, no `/codex:review` (overkill for ~80 LOC).

**Out of scope.** HTTP/SSE transport for custom server (stdio only); CI smoke against real external MCPs (requires hosted token storage); Docker container for custom server; pagination beyond 5 results in Notion query; GitHub App auth (PAT only); multi-resource custom server (single resource template by brief); runtime token rotation; `/codex:review` skill invocation.

**Non-goals.** Production-grade MCP server hardening; performance benchmarks; load testing; Windows-native HOWTORUN (POSIX shell only, document workaround in Future Work).

---

## 1. Architectural approach

**Approach.** 4 MCP servers, 1 client (Claude Desktop), all transports stdio. External 3 register via npm/`npx` lazy install on first run. Custom 1 registers via `uv run` against local `server.py`. Tokens live in shell env (`~/.zshrc`) and resolve at MCP client startup via `${VAR_NAME}` placeholders inside Desktop config. Repo-committed `mcp.json` is **reference-only** (Claude Code format) — Claude Desktop reads its own config at `~/Library/Application Support/Claude/claude_desktop_config.json`. The two stay in sync; HOWTORUN documents the copy step.

**Why Claude Desktop primary, not Claude Code.** Per user choice — Desktop is the daily-driver in Cowork mode. Reference `mcp.json` covers Claude Code-compatible format so a reviewer with Claude Code can also reproduce.

**Why community GitHub MCP, not official remote.** User choice — community version (`@modelcontextprotocol/server-github`) shows "explicit local configuration with PAT" more clearly than the OAuth-flow remote variant, making the homework demo more inspectable.

**Why Notion local, not remote.** Same logic — local `@notionhq/notion-mcp-server` with `OPENAPI_MCP_HEADERS` env var makes integration token usage explicit in config; remote hides it behind OAuth.

**Why uv (not pip).** Modern Python tooling standard; matches FastMCP's official docs; single command `uv run server.py` handles venv + deps; `uv.lock` committed for reproducibility.

**Why pytest + in-memory FastMCP Client.** FastMCP exposes a `Client(server_instance)` for tests that calls tools/resources without spawning the stdio subprocess. Fast, deterministic, no fixtures needed beyond the static lorem-ipsum.md.

---

## 2. Module map

```
homework-5/
├── README.md                          # overview + author + per-server table + per-server justification + screenshots
├── HOWTORUN.md                        # prereqs, token setup (3 verification methods), Claude Desktop config, smoke per server
├── mcp.json                           # Claude Code-format reference; placeholder env vars
├── TASKS.md                           # (already in repo from course; not modified)
├── custom-mcp-server/
│   ├── server.py                      # ~60 LOC — FastMCP("lorem-ipsum"), 1 resource template, 1 tool
│   ├── lorem-ipsum.md                 # ~500-word lorem ipsum source text
│   ├── pyproject.toml                 # [project] deps: fastmcp; [dependency-groups.dev]: pytest, pytest-asyncio
│   ├── uv.lock                        # committed for reproducibility
│   ├── README.md                      # short: "run / test" pointer to ../HOWTORUN.md
│   └── tests/
│       ├── __init__.py
│       └── test_server.py             # ~5 pytest-asyncio cases via FastMCP Client
└── docs/
    ├── AI-USAGE.md                    # CMP table per HW4 §8.1; decisions log HW5-specific
    ├── specs/
    │   ├── 2026-06-19-mcp-setup-design.md   # this file
    │   └── claude-code-kickoff-prompt.md    # paste-into-CC kickoff for phases 1-9
    └── screenshots/
        ├── github-mcp-result.png
        ├── filesystem-mcp-result.png
        ├── notion-mcp-result.png
        └── custom-mcp-read-tool-result.png
```

**Total scope:** ~60 LOC custom server + ~50 LOC tests + 4 markdown docs + 1 JSON config + 4 screenshots. Smallest homework so far.

---

## 3. Custom MCP server contract

### 3.1 `server.py` — full source target

```python
"""Custom FastMCP server: serves first N words of lorem-ipsum.md via resource + tool."""
from pathlib import Path
from fastmcp import FastMCP

mcp = FastMCP("lorem-ipsum")

LOREM_PATH = Path(__file__).parent / "lorem-ipsum.md"


def _slice_words(n: int) -> str:
    """Read source and return first n words.

    n=0 -> empty string; n > total -> all available words (clamp, no error).
    Negative n raises ValueError.
    """
    if n < 0:
        raise ValueError("word_count must be non-negative")
    if not LOREM_PATH.exists():
        raise FileNotFoundError(f"Source file missing: {LOREM_PATH}")
    words = LOREM_PATH.read_text(encoding="utf-8").split()
    return " ".join(words[:n])


@mcp.resource("lorem://words/{word_count}")
def lorem_resource(word_count: int) -> str:
    """Return the first `word_count` words from lorem-ipsum.md."""
    return _slice_words(word_count)


@mcp.tool()
def read(word_count: int = 30) -> str:
    """Return the first `word_count` words from lorem-ipsum source. Default 30."""
    return _slice_words(word_count)


if __name__ == "__main__":
    mcp.run()  # stdio transport (FastMCP default)
```

### 3.2 Data flow

```
[Claude Desktop chat]
  user prompt -> LLM decides to call `read` tool with word_count=50
  -> JSON-RPC tools/call over stdio
  -> server.py:read(50)
  -> _slice_words(50) -> reads lorem-ipsum.md -> str.split() -> [:50] -> " ".join
  -> JSON-RPC response
  -> LLM gets text -> user sees response
```

Resource path is identical but invoked via `resources/read` with URI `lorem://words/50`. FastMCP auto-parses `{word_count}` to int from the URI template.

### 3.3 Error handling

| Case | Behavior | Surface |
|---|---|---|
| `word_count < 0` | `ValueError("word_count must be non-negative")` | FastMCP converts to JSON-RPC error response |
| `word_count = 0` | Empty string `""` | Normal success |
| `word_count > total words` | Return all available (clamp) | Normal success |
| `lorem-ipsum.md` missing | `FileNotFoundError` | FastMCP converts to JSON-RPC error response |
| `word_count` not int | FastMCP type-validation via signature | Schema error before function runs |

### 3.4 `lorem-ipsum.md` content

~500 words of standard lorem ipsum (from lipsum.com or similar generator). Plain markdown, no headers — just a single paragraph or two. Whitespace-separated tokens count as "words" (matches `str.split()` semantics).

### 3.5 `pyproject.toml`

```toml
[project]
name = "lorem-ipsum-mcp"
version = "0.1.0"
description = "Custom FastMCP server returning first N words of lorem-ipsum.md"
requires-python = ">=3.11"
dependencies = ["fastmcp>=0.4.0"]

[dependency-groups]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
```

---

## 4. External MCP servers

### 4.1 GitHub MCP

- **Package:** `@modelcontextprotocol/server-github` (npm, community)
- **Transport:** stdio (`npx -y ...`)
- **Auth:** GitHub PAT in env `GITHUB_PERSONAL_ACCESS_TOKEN` (we mirror this from `GITHUB_PAT` shell var)
- **Required PAT scopes:** `repo` (PRs, issues), `read:org` (org membership for org repos)
- **Demo prompt:** "List my 5 most recent pull requests on NickSkrypchenko/gen-ai-software-engineering"
- **Expected response surface:** array of PRs with title, number, state, author

### 4.2 Filesystem MCP

- **Package:** `@modelcontextprotocol/server-filesystem` (npm, official)
- **Transport:** stdio (`npx -y ...`)
- **Auth:** none — security via path scope argument
- **Scope:** `/Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering` (repo root)
- **Demo prompt:** "List files in homework-5/ directory"
- **Expected response surface:** directory listing showing this spec, README stubs, custom-mcp-server/

### 4.3 Notion MCP

- **Package:** `@notionhq/notion-mcp-server` (npm, official by Notion)
- **Transport:** stdio (`npx -y ...`)
- **Auth:** Notion integration token via `OPENAPI_MCP_HEADERS` env var (Bearer scheme)
- **Setup:** integration created at notion.so/my-integrations, then explicitly added to the target database via Notion page-share UI ("Connect to integration")
- **Demo prompt:** "Give me the last 5 bugs from the [BUGS_DB_NAME] database" (DB name redacted in screenshots per brief)
- **Expected response surface:** 5 page IDs + titles, no sensitive content

### 4.4 Per-server justification (for README)

| Server | Why chosen | What it proves |
|---|---|---|
| GitHub (community npm) | Explicit PAT in config — homework demonstrates "MCP with credentials configured" clearer than OAuth remote | Configuration with secret env var |
| Filesystem (official npm) | Simplest MCP, no auth — baseline that the client wiring works | Path-scoped tool surface |
| Notion (official npm) | Integration-token model + must connect integration to DB = real-world friction documented | Two-step auth (token + DB permission) |
| Custom (FastMCP) | Resource template + tool both required by brief; smallest meaningful FastMCP example | Resource URIs vs tools as MCP primitives |

---

## 5. `mcp.json` reference deliverable

Claude Code-compatible format. Committed to repo. **No real secrets** — env var placeholders only.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering"
      ]
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ${NOTION_TOKEN}\", \"Notion-Version\": \"2022-06-28\"}"
      }
    },
    "lorem-ipsum": {
      "command": "uv",
      "args": [
        "--directory",
        "homework-5/custom-mcp-server",
        "run",
        "server.py"
      ]
    }
  }
}
```

**Important:** Claude Desktop's actual config (`~/Library/Application Support/Claude/claude_desktop_config.json`) contains the **resolved** values, not `${...}` placeholders — Desktop does not expand env vars. HOWTORUN MUST explain the copy-and-substitute step in detail, including:

1. **Why the substitution is needed** — Desktop reads JSON literally, sees `"${GITHUB_PAT}"` as a 13-character string, sends it as the token, GitHub returns 401.
2. **One-liner using `envsubst`** for users with `gettext` installed:
   ```bash
   envsubst < homework-5/mcp.json > ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```
3. **Manual fallback** with exact before/after for the trickiest line (Notion's nested-JSON `OPENAPI_MCP_HEADERS`):

   Before (in repo mcp.json):
   ```json
   "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ${NOTION_TOKEN}\", \"Notion-Version\": \"2022-06-28\"}"
   ```
   After (in Desktop config — substitute the literal token value, keep all escaped quotes intact):
   ```json
   "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_abc123XYZ...\", \"Notion-Version\": \"2022-06-28\"}"
   ```
4. **Post-substitute verification** — `jq '.mcpServers.notion.env' ~/Library/Application\ Support/Claude/claude_desktop_config.json` should NOT contain the string `${` anywhere.

---

## 6. Testing

### 6.1 Test file `tests/test_server.py`

```python
"""In-memory FastMCP Client tests for the lorem-ipsum server."""
import pytest
from fastmcp import Client

from server import mcp


@pytest.mark.asyncio
async def test_tool_default_returns_30_words():
    async with Client(mcp) as client:
        result = await client.call_tool("read", {})
        text = result.content[0].text
        assert len(text.split()) == 30


@pytest.mark.asyncio
async def test_tool_explicit_count_returns_n_words():
    async with Client(mcp) as client:
        result = await client.call_tool("read", {"word_count": 50})
        text = result.content[0].text
        assert len(text.split()) == 50


@pytest.mark.asyncio
async def test_tool_zero_returns_empty_string():
    async with Client(mcp) as client:
        result = await client.call_tool("read", {"word_count": 0})
        assert result.content[0].text == ""


@pytest.mark.asyncio
async def test_resource_template_returns_n_words():
    async with Client(mcp) as client:
        result = await client.read_resource("lorem://words/15")
        text = result.contents[0].text
        assert len(text.split()) == 15


@pytest.mark.asyncio
async def test_tool_negative_count_raises():
    async with Client(mcp) as client:
        with pytest.raises(Exception):
            await client.call_tool("read", {"word_count": -1})
```

### 6.2 FIRST compliance

| Letter | How |
|---|---|
| Fast | In-memory Client, single local file read per call. <50ms each. |
| Independent | Fresh `Client` context manager per test; no shared state. |
| Repeatable | Static `lorem-ipsum.md`, no `Date.now()`, no network. |
| Self-validating | `assert` per test, no print/inspect. |
| Timely | Written alongside `server.py` in same phase (Phase 2 immediately after Phase 1). |

### 6.3 What we don't test

- Real Claude Desktop subprocess (manual smoke in Phase 5)
- External MCP server behavior (we delegate to GitHub/Notion/FS implementations)
- Token validity (verified in Phase 0.3 / 0.4 by user)
- Performance (trivial workload)

---

## 7. AI workflow integration

### 7.1 Phase pipeline

| # | Phase | Driver | Inputs | Outputs | Exit criteria |
|---|---|---|---|---|---|
| 0.1 | Git setup | Claude Code | upstream `main` | `homework-5-submission` branch off fresh `main` (after `git fetch upstream && git merge upstream/main` on main) | `git log --oneline main` shows HW5 TASKS.md commit; branch exists |
| 0.2 | Scaffold | Claude Code | spec + kickoff | `homework-5/{README,HOWTORUN}.md` stubs, directory skeleton per §2, both specs committed | `tree homework-5` matches module map |
| 0.3 | GitHub PAT | **USER** ⏸ | github.com/settings/tokens | PAT with `repo` + `read:org` in `~/.zshrc` as `GITHUB_PAT` | Any of: (a) `curl -H "Authorization: token $GITHUB_PAT" https://api.github.com/user` → 200; (b) `gh auth status` shows logged in; (c) `git clone https://$GITHUB_PAT@github.com/NickSkrypchenko/gen-ai-software-engineering.git /tmp/test-pat && rm -rf /tmp/test-pat` succeeds |
| 0.4 | Notion token | **USER** ⏸ | notion.so/my-integrations | Integration token + integration connected to test database; token in `~/.zshrc` as `NOTION_TOKEN` | Any of: (a) `curl -H "Authorization: Bearer $NOTION_TOKEN" -H "Notion-Version: 2022-06-28" https://api.notion.com/v1/users/me` → 200; (b) Notion UI shows integration linked to target database |
| 0.5 | Verify clean | Claude Code | repo state | grep report | `grep -rE "ghp_\|secret_\|ntn_\|Bearer [A-Za-z0-9]+" homework-5/` → empty; `git status` clean |
| 1 | Custom server | Claude Code | spec §3 | `custom-mcp-server/{server.py, lorem-ipsum.md, pyproject.toml, uv.lock, README.md}` | `cd homework-5/custom-mcp-server && uv sync && uv run python -c "from server import mcp; print(type(mcp).__name__)"` → `FastMCP`. Phase 1 also confirms manually that the MCP server name attribute (whatever FastMCP exposes it as — `mcp.name`, `mcp._name`, etc.) returns `lorem-ipsum`; pick the attribute that exists in the installed FastMCP version and document in `server.py` docstring. |
| 2 | Tests | Claude Code | spec §6 | `custom-mcp-server/tests/test_server.py`, `__init__.py` | `cd homework-5/custom-mcp-server && uv run pytest -v` → 5/5 passing |
| 3 | mcp.json | Claude Code | spec §5 | `homework-5/mcp.json` with placeholder env vars | `cat homework-5/mcp.json \| python -m json.tool` parses; `grep -E "ghp_\|secret_\|ntn_" homework-5/mcp.json` → empty |
| 4 | Install + register ext MCPs | **USER** ⏸ | mcp.json template | Resolved entries in `~/Library/Application Support/Claude/claude_desktop_config.json` (3 ext + 1 custom) | Either of: (a) Claude Desktop → Settings → Developer shows 4 servers "Connected"; (b) `jq '.mcpServers \| keys \| length' ~/Library/Application\ Support/Claude/claude_desktop_config.json` returns 4 |
| 4.X | Auth fix (fallback) | USER + Claude Code | error log | — | STOP, diagnose (scope/rate-limit/URL), fix, resume Phase 4 — **do not skip** |
| 5 | Smoke + screenshots | **USER** ⏸ | working setup | 4 PNGs in `docs/screenshots/` | Each screenshot shows: (1) user prompt in chat, (2) MCP tool/resource call surfaced (Desktop "Used X" badge or expanded tool result), (3) non-empty response from MCP (for word_count > 0 case), (4) no error state visible |
| 6 | AI-USAGE | Claude Code | this chat + Claude Code session log | `docs/AI-USAGE.md` with CMP table | Table covers all phases 0.1–9 (USER phases marked `n/a / manual`); decisions log HW5-specific |
| 7 | README + HOWTORUN | Claude Code | final repo state | both .md complete | README: overview, per-server table, per-server justification, author "Nick Skrypchenko", screenshot links. HOWTORUN MUST include: (a) prereqs (uv, npm, tokens) with 3 verification methods for GitHub PAT + 2 for Notion + exact `curl` examples with headers correctly formatted; (b) **env-var substitution section per §5** (envsubst one-liner + manual fallback + post-substitute `jq` verification + Notion headers before/after); (c) Phase 4 fallback "what if auth fails — diagnose then resume, never skip"; (d) per-server smoke command. |
| 8 | Self-review | Claude Code | branch diff vs main | mental review + grep report | (1) `grep -rE "ghp_\|secret_\|ntn_\|Bearer [A-Za-z0-9]+" homework-5/` → empty; (2) `mcp.json` env vars in `${PLACEHOLDER}` form only; (3) acceptance checklist (§10) walk-through; (4) no TODO/TBD in committed docs |
| 9 | PR | Claude Code | all commits | PR opened | PR against https://github.com/NickSkrypchenko/gen-ai-software-engineering (fork's `main`, **not** upstream `Alexey-Popov/...`); `Alexey-Popov` requested reviewer; labels `homework-5` + `ready-for-review`; body uses §8.2 template |

### 7.2 Phase ordering rules

- **0.1 blocks everything** — wrong branch = wasted work
- **0.3 + 0.4 parallel** — independent token creations
- **0.5 blocks 1** — never code on dirty tree
- **1 blocks 2** — tests import server.py
- **2 + 3 block 4** — pointless to register a broken server
- **3 blocks 4** — Phase 4 uses mcp.json as the substitution source
- **4 blocks 5** — no smoke without connection
- **5 blocks 6** — AI-USAGE references demo outcomes
- **5 + 6 block 7** — README needs both screenshots and CMP table
- **7 blocks 8** — review reads final docs
- **8 blocks 9** — no PR with known findings

### 7.3 Approval gates (Claude Code stops and asks)

- **Before Phase 0.3 / 0.4** — Claude Code: "I need your GitHub PAT and Notion token. Here's the step-by-step from HOWTORUN. Let me know when both are in your shell env."
- **Before Phase 4** — Claude Code: "mcp.json is ready. Here's exactly what to copy into your Desktop config (with placeholder substitutions applied). Restart Desktop. Tell me when all 4 servers show Connected."
- **Before Phase 5** — Claude Code: "Open 4 new chats in Claude Desktop. Here are the 4 prompts. Take a screenshot of each after MCP responds. Save them to docs/screenshots/ with the exact filenames in README."
- **Before Phase 9** — Claude Code: "Everything done. Open the PR? (Confirm before pushing.)"

### 7.4 CMP table for HW5 (will live at top of AI-USAGE.md)

| Phase | Surface | Context loaded | Model | Prompt strategy | Outcome |
|---|---|---|---|---|---|
| Brainstorm | Cowork (this chat) | TASKS.md, HW4 spec | claude-sonnet-4-7 | Q-by-Q via brainstorming skill | approved → spec written |
| 0.1–0.5 | Claude Code | spec + kickoff | claude-sonnet-4-6 | Phase-by-phase imperative | scaffolded, tokens in env |
| 1 | Claude Code | spec §3 | claude-sonnet-4-6 | "implement per spec, no improv" | server.py + lorem-ipsum.md |
| 2 | Claude Code | spec §6 | claude-sonnet-4-6 | "5 pytest cases, in-memory Client" | 5/5 green |
| 3 | Claude Code | spec §5 | claude-sonnet-4-6 | "placeholder env vars, no real tokens" | mcp.json |
| 4 | USER | Desktop config | n/a | manual (intentional — config edit + auth flows are user-private) | 4 servers connected |
| 5 | USER | working setup | n/a | manual (intentional — visual screenshots) | 4 screenshots |
| 6 | Claude Code | this chat + Claude Code session log | claude-sonnet-4-6 | "consolidate CMP per phase" | AI-USAGE.md |
| 7 | Claude Code | final repo | claude-sonnet-4-6 | "README per template, HOWTORUN cold-start" | both docs |
| 8 | Claude Code | branch diff | claude-sonnet-4-6 | self-review checklist | review notes inline |
| 9 | Claude Code | all commits | claude-sonnet-4-6 | PR body per template | PR opened |

### 7.5 Decisions log (HW5-specific, will live in AI-USAGE.md)

- Client: Claude Desktop primary; `mcp.json` in repo as Claude Code-format reference (brief requires the artifact)
- Notion (not Jira) — Cowork already has Notion MCP available; less auth friction
- GitHub MCP: community `@modelcontextprotocol/server-github` — explicit PAT visible in config
- Notion MCP: `@notionhq/notion-mcp-server` (local npm) — integration token model is the homework-honest path
- Filesystem MCP: scope = repo root (specific path, not `~/Desktop` broad)
- Custom server: uv + FastMCP, resource template `lorem://words/{word_count}` + tool `read(word_count=30)`
- Tests: pytest + FastMCP in-memory `Client`, 5 cases (default/explicit/zero/resource/negative)
- Phase 4 fallback: STOP / diagnose / fix / resume — **never skip** (brief requires all 3 ext servers configured)
- Phase 8: inline self-review + secret-grep, **not** `/codex:review` (~80 LOC is too small to justify ceremony)
- Tokens in `~/.zshrc` env; `mcp.json` references `${GITHUB_PAT}` / `${NOTION_TOKEN}` placeholders

---

## 8. Deliverables & repo conventions

### 8.1 Branch & PR

- **Branch:** `homework-5-submission` off fresh `main` (after upstream merge)
- **PR target:** https://github.com/NickSkrypchenko/gen-ai-software-engineering (fork's `main`) — **NOT** upstream `Alexey-Popov/...`
- **Reviewer:** `Alexey-Popov` requested
- **Labels:** `homework-5`, `ready-for-review`
- **Commits:** Conventional Commits. Phase boundaries from §7.1 = natural commit boundaries.

### 8.2 PR body template

```markdown
## Summary
HW5 — configured 3 external MCP servers (GitHub, Filesystem, Notion) + built a custom FastMCP server in `custom-mcp-server/`. All 4 demonstrated in Claude Desktop with screenshots. Custom server has 5/5 passing pytest cases via FastMCP in-memory Client.

## AI tools used (CMP summary)
| Phase | Tool | Model | Outcome |
|---|---|---|---|
| Brainstorm | Cowork (Claude Desktop) | Sonnet 4.7 | spec approved |
| Phases 0–9 | Claude Code CLI | Sonnet 4.6 | accepted |
| Phases 4–5 | USER (manual) | n/a | 4 servers connected + 4 screenshots |

## MCP servers configured
| # | Server | Auth | Demo prompt | Screenshot |
|---|---|---|---|---|
| 1 | GitHub (community npm) | PAT (repo, read:org) | "List my 5 most recent PRs" | docs/screenshots/github-mcp-result.png |
| 2 | Filesystem (official npm) | none (path scope) | "List files in homework-5/" | docs/screenshots/filesystem-mcp-result.png |
| 3 | Notion (official npm) | Integration token | "Last 5 bugs from <DB>" (redacted) | docs/screenshots/notion-mcp-result.png |
| 4 | Custom (FastMCP) | none | "Use read tool with word_count=50" | docs/screenshots/custom-mcp-read-tool-result.png |

## How to verify
1. `git checkout homework-5-submission && cd homework-5`
2. Follow `HOWTORUN.md` — token setup → Desktop config → 4 smoke prompts
3. `cd custom-mcp-server && uv sync && uv run pytest -v` → 5/5

## Challenges
<2–4 honest bullets after Phase 5>

## Screenshots
<inline embed all 4 PNGs>
```

### 8.3 Environment

`~/.zshrc` (gitignored, user-private):
```bash
export GITHUB_PAT="ghp_..."
export NOTION_TOKEN="ntn_..."
```

No `.env` file in repo. No tokens in any committed file.

---

## 9. Future work / out of scope

- HTTP/SSE transport for custom server (stdio is enough for desktop client)
- CI smoke against real external MCPs (needs hosted token storage; risky for free-tier accounts)
- Docker container for custom server
- Multi-resource custom server (one resource template per brief)
- Notion query pagination beyond 5
- GitHub App auth (PAT is enough for homework)
- Cross-platform HOWTORUN (POSIX shell only; document Windows-WSL workaround as one bullet)
- Automated screenshot capture via Playwright MCP (manual is faster for 4 shots)

---

## 10. Acceptance checklist

Implementation is complete when **all** are true:

- [ ] `homework-5-submission` branch created off fresh `main` (post-upstream-merge)
- [ ] `homework-5/custom-mcp-server/server.py` imports cleanly: `uv run python -c "from server import mcp; print(type(mcp).__name__)"` → `FastMCP`
- [ ] `uv run pytest -v` in `custom-mcp-server/` → 5/5 passing
- [ ] `homework-5/mcp.json` is valid JSON; **no** real tokens (`grep -rE "ghp_\|secret_\|ntn_\|Bearer [A-Za-z0-9]+" homework-5/` empty)
- [ ] All 4 MCP servers visible in Claude Desktop — either: (a) Settings → Developer shows 4 "Connected", **or** (b) `jq '.mcpServers | keys | length' ~/Library/Application\ Support/Claude/claude_desktop_config.json` returns 4
- [ ] `docs/screenshots/` has 4 PNGs (one per server); each shows user prompt + MCP tool/resource call + non-empty response (no error state)
- [ ] `homework-5/README.md` includes: overview, per-server table, per-server justification prose, author "Nick Skrypchenko", screenshot links
- [ ] `homework-5/HOWTORUN.md` includes: prereqs (uv, npm, tokens with 3 verification methods for PAT + 2 for Notion + exact `curl` example with headers), env-var substitution section per §5 (envsubst one-liner + manual fallback + Notion headers before/after example + post-substitute `jq` verification), step-by-step Desktop config setup, smoke command per server, Phase 4 fallback "what if auth fails — diagnose then resume, never skip"
- [ ] `homework-5/docs/AI-USAGE.md` contains CMP table for HW5 + decisions log (HW5-specific, not HW4 copypasta)
- [ ] PR opened against fork's `main` (NickSkrypchenko/gen-ai-software-engineering), `Alexey-Popov` reviewer, labels `homework-5` + `ready-for-review`, body uses §8.2 template
