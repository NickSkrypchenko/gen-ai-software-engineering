# AI-USAGE — Homework 5

This log follows the **Context-Model-Prompt (CMP)** framework (from HW4 §8.1): every
AI-driven phase records the context loaded, the model, the prompt strategy, and the
outcome. USER-driven phases (token creation, Desktop config, screenshots) are marked
`manual`.

## CMP summary table

| Phase | Surface | Context loaded | Model | Prompt strategy | Outcome |
|---|---|---|---|---|---|
| Brainstorm | Cowork (Claude Desktop) | TASKS.md, HW4 spec | Sonnet (Cowork) | Q-by-Q brainstorming | spec approved → design + kickoff written |
| 0.1 Git setup | Claude Code | spec + kickoff | Opus 4.8 | phase-by-phase imperative | fresh main, `homework-5-submission` branch |
| 0.2 Scaffold | Claude Code | spec §2 | Opus 4.8 | "skeleton + stubs per module map" | dirs + README/HOWTORUN stubs + specs committed |
| 0.5 Verify clean | Claude Code | repo state | Opus 4.8 | secret grep | clean (refined grep added) |
| 0.3 GitHub PAT | USER | github.com/settings/tokens | manual | — | PAT (`repo`,`read:org`) in env, verified 200 |
| 0.4 Notion token | USER | notion.so/my-integrations | manual | — | integration `hw5-mcp` + DB connected, verified 200 |
| 1 Custom server | Claude Code | spec §3 | Opus 4.8 | "implement per spec, no improv" | server.py + 500-word lorem-ipsum.md, mcp.name verified |
| 2 Tests | Claude Code | spec §6 | Opus 4.8 | "5 pytest cases, in-memory Client" | 5/5 green (1 API adaptation) |
| 3 mcp.json | Claude Code | spec §5 | Opus 4.8 | "placeholder env vars, no real tokens" | mcp.json, later switched Notion to NOTION_TOKEN |
| 4 Register MCPs | USER + Claude Code | mcp.json | Opus 4.8 (script) | "merge into Desktop config, abs paths" | 4 servers Connected (after paste-mangling fix) |
| 5 Smoke + screenshots | USER | working setup | manual | 4 demo prompts | 4 screenshots, all MCP calls successful |
| 6 AI-USAGE | Claude Code | this session | Opus 4.8 | "consolidate CMP per phase" | this file |
| 7 README + HOWTORUN | Claude Code | final repo | Opus 4.8 | "README per template, HOWTORUN cold-start" | both docs |
| 8 Self-review | Claude Code | branch diff | Opus 4.8 | self-review checklist + secret grep | review notes |
| 9 PR | Claude Code | all commits | Opus 4.8 | PR body per template | PR opened |

**Note on model:** the design spec/kickoff anticipated `claude-sonnet-4-6` for the Claude
Code phases. In practice the implementation session ran on **Opus 4.8** (model switched at
the user's request before Phase 0.1). This table records the model actually used.

## Decisions log (HW5-specific)

- **Client:** Claude Desktop is the primary MCP client; repo `mcp.json` is a Claude
  Code-format reference deliverable (per brief). Desktop reads its own config at
  `~/Library/Application Support/Claude/claude_desktop_config.json`.
- **GitHub MCP:** community `@modelcontextprotocol/server-github` (PAT explicit in config)
  over the OAuth remote — makes credential configuration inspectable for the homework.
- **Notion MCP:** `@notionhq/notion-mcp-server` (local npm). **Deviation from spec §5:**
  v2.4.0 supports a simple `NOTION_TOKEN` env var (Option 1, recommended) instead of the
  nested-JSON `OPENAPI_MCP_HEADERS`. Switched to `NOTION_TOKEN` — this removes the
  JSON-escaping step the spec flagged as Phase 4's riskiest. `mcp.json` updated to match.
- **Filesystem MCP:** scoped to repo root (specific path, not a broad `~/Desktop`).
- **Custom server:** uv + FastMCP, resource template `lorem://words/{word_count}` + tool
  `read(word_count=30)`, sharing one `_slice_words` helper (clamp on overflow,
  `ValueError` on negative).
- **FastMCP version:** installed **3.4.2** (spec assumed `>=0.4.0`). `mcp.name` attribute
  exists and returns `lorem-ipsum`, so no adaptation needed in `server.py`.
- **Test adaptation:** in fastmcp 3.4.2, `client.read_resource()` returns the contents
  list directly (`result[0].text`); spec §6.1 assumed an older `.contents` wrapper.
  Adapted the resource test and documented inline.
- **Tokens:** live in `~/.zshrc` (gitignored, user-private). `mcp.json` references
  `${GITHUB_PAT}` / `${NOTION_TOKEN}` placeholders only. Secret grep before every commit.
- **Phase 8:** inline self-review + secret-grep, **not** `/codex:review` (~80 LOC is too
  small to justify the ceremony — spec §0 decision).
- **Spec docs:** design spec + kickoff committed to `docs/specs/`; 3 personal planning
  docs kept local-only via `.git/info/exclude` (user choice).

## Issues encountered & resolutions

1. **Phase 4 paste mangling.** The first attempt pasted a long one-liner directly into
   the shell; the terminal line-wrapped it and injected literal newlines *inside* JSON
   string values (`notion` args became `['\n  -y', ...]` → `No matching version found for
   undefined@-y`; the `lorem-ipsum` path split mid-string → `No such file or directory`).
   **Fix:** wrote a short `/tmp/hw5-merge.sh` that builds the config with `jq --arg`
   (paths and tokens passed as args, never embedded), invoked with one short command.
   Added a sanity check that greps the resulting JSON for stray newlines.
2. **Desktop GUI PATH.** Claude Desktop launches with a minimal PATH and a different
   working directory, so `uv`/`npx` and the custom server's relative path failed.
   **Fix:** absolute command paths (`/usr/local/bin/npx`, `/Users/wildix/.local/bin/uv`)
   and an absolute `--directory` for the custom server.
3. **Config merge, not overwrite.** The existing Desktop config held Cowork settings
   (`coworkUserFilesPath`, `preferences`) and no `mcpServers`. The merge script sets only
   `.mcpServers`, preserving the rest, and backs up the original first.
4. **Notion tool name collision.** "Use the read tool" was first interpreted as the
   built-in Read (file reader). **Fix:** the demo prompt names the server explicitly —
   "Call the read tool from the lorem-ipsum MCP server with word_count=50".
5. **Empty Bugs DB.** The connected Notion DB had only a bare `Name` column and no rows.
   Populated it (via the same integration token) with a `Bugs` schema (Status, Priority,
   Description) and 5 realistic bug entries; archived the leftover empty row.
6. **`status` is read-only in zsh.** The bug-seeding loop used a `status` local, which zsh
   reserves. Renamed to `st`.
