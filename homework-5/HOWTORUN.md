# HOWTORUN — Homework 5

> 🚧 Stub — populated in Phase 7. See [design spec §5](docs/specs/2026-06-19-mcp-setup-design.md).

## Prerequisites

- Node.js ≥ 20 (npx) — external MCP servers
- uv — custom FastMCP server
- jq, envsubst (`brew install jq gettext`) — config substitution + verification
- GitHub PAT, Notion integration token

## Sections (to fill in Phase 7)

1. Token setup + verification (3 methods for GitHub PAT, 2 for Notion)
2. Env-var substitution into Claude Desktop config (envsubst + manual fallback)
3. Per-server smoke commands
4. Phase 4 auth-failure fallback (diagnose, then resume — never skip)
5. Custom server: install, run, test
