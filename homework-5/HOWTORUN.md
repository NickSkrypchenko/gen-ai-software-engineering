# HOWTORUN — Homework 5

Cold-start runbook: install prerequisites, set up tokens, register all 4 MCP servers in
Claude Desktop, and smoke-test each one. macOS / POSIX shell (zsh).

---

## 1. Prerequisites

| Tool | Why | Verify | Install |
|---|---|---|---|
| Node.js ≥ 20 (`npx`) | 3 external MCP servers run via `npx -y …` | `node --version` | nodejs.org / `brew install node` |
| `uv` | runs the custom FastMCP server | `uv --version` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `jq` | config merge + verification | `jq --version` | `brew install jq` |
| `envsubst` (optional) | alternative substitution method | `envsubst --version` | `brew install gettext` |
| Claude Desktop | the MCP client (demo surface) | app installed | claude.ai/download |
| GitHub PAT | GitHub MCP auth | see §2.1 | github.com/settings/tokens |
| Notion integration token | Notion MCP auth | see §2.2 | notion.so/my-integrations |

---

## 2. Tokens

Store tokens in `~/.zshrc` (gitignored, user-private). **Never** commit a real token.

```bash
echo 'export GITHUB_PAT="ghp_..."'  >> ~/.zshrc
echo 'export NOTION_TOKEN="ntn_..."' >> ~/.zshrc
source ~/.zshrc
```

### 2.1 GitHub PAT — create + verify

Create a **classic** token at github.com/settings/tokens with scopes **`repo`** and
**`read:org`**. Then verify with any of these three methods:

```bash
# (a) API call — expect HTTP 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: token $GITHUB_PAT" https://api.github.com/user

# (b) gh CLI — shows the logged-in user
gh auth status

# (c) authenticated clone round-trip
git clone https://$GITHUB_PAT@github.com/NickSkrypchenko/gen-ai-software-engineering.git \
  /tmp/test-pat && rm -rf /tmp/test-pat
```

Check the granted scopes:

```bash
curl -s -I -H "Authorization: token $GITHUB_PAT" https://api.github.com/user \
  | grep -i x-oauth-scopes      # expect: read:org, repo
```

### 2.2 Notion token — create + connect + verify

1. notion.so/my-integrations → **New integration** (internal) → copy the
   **Internal Integration Token** (`ntn_…`).
2. **Connect the integration to a database** you want to query: open the page/DB →
   `•••` → **Connections** → **Connect to** → your integration. *Without this step the
   token sees nothing.*

Verify with either method:

```bash
# (a) API call — expect HTTP 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" https://api.notion.com/v1/users/me

# (b) confirm a DB is actually shared with the integration (results > 0)
curl -s -X POST -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" -H "Content-Type: application/json" \
  -d '{"page_size":5}' https://api.notion.com/v1/search | jq '.results | length'
```

---

## 3. Register the 4 servers in Claude Desktop

Claude Desktop reads its own config at:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Two gotchas this runbook handles explicitly:

1. **Desktop does not expand `${VAR}` placeholders.** The repo `mcp.json` is
   reference-only; the Desktop config needs *resolved* values.
2. **Desktop launches with a minimal GUI PATH** and a different working directory, so
   `uv`/`npx` must be given as **absolute paths**, and the custom server needs an
   **absolute** `--directory`.
3. **The config may already contain other keys** (e.g. Cowork settings). We **merge**
   `mcpServers` in rather than overwriting the whole file.

### 3.1 Recommended: jq merge (preserves existing keys, no token exposure)

This reads tokens from your environment and writes only `.mcpServers`, after backing up
the current config. Adjust `REPO` if your checkout lives elsewhere.

```bash
CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
REPO="/Users/wildix/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering"
SRV="$REPO/homework-5/custom-mcp-server"
UV="$(command -v uv)"; NPX="$(command -v npx)"

cp "$CFG" "$CFG.bak.$(date +%s)"
tmp=$(mktemp)
jq --arg ghp "$GITHUB_PAT" --arg ntn "$NOTION_TOKEN" \
   --arg repo "$REPO" --arg srv "$SRV" --arg uv "$UV" --arg npx "$NPX" \
'.mcpServers = {
  github:       {command:$npx, args:["-y","@modelcontextprotocol/server-github"],     env:{GITHUB_PERSONAL_ACCESS_TOKEN:$ghp}},
  filesystem:   {command:$npx, args:["-y","@modelcontextprotocol/server-filesystem",$repo]},
  notion:       {command:$npx, args:["-y","@notionhq/notion-mcp-server"],             env:{NOTION_TOKEN:$ntn}},
  "lorem-ipsum":{command:$uv,  args:["--directory",$srv,"run","server.py"]}
}' "$CFG" > "$tmp" && mv "$tmp" "$CFG"
```

> ⚠️ Don't paste a giant one-liner into the terminal — long lines get line-wrapped and
> can inject literal newlines *inside* JSON string values (this actually happened during
> setup: `notion` args became `['\n  -y', …]` → `No matching version found for
> undefined@-y`). Save the snippet to a file and run it (`zsh merge.sh`), or paste it as a
> multi-line block, not one wrapped line.

### 3.2 Alternative: envsubst (overwrites the whole file)

Only safe if the config has **no other keys** you care about. Note `mcp.json` uses a
relative path for the custom server, so fix that up afterward for Desktop.

```bash
envsubst < homework-5/mcp.json > "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

### 3.3 Verify the resulting config

```bash
CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
jq empty "$CFG" && echo "valid JSON"                         # parses
jq -r '.mcpServers | keys[]' "$CFG"                          # 4 server names
grep -o '${[A-Z_]*}' "$CFG" || echo "no leftover placeholders"   # must be empty
```

### 3.4 Restart and confirm

**Cmd+Q** Claude Desktop (full quit), reopen. First launch of each `npx` server lazily
downloads the package (10–30s). Then either:

- Settings → **Developer** shows 4 servers **Connected**, or
- `jq '.mcpServers | keys | length' "$CFG"` returns `4`.

### 3.5 If a server fails to connect — diagnose, then resume (never skip)

All three external servers are required; do not drop a failing one. Common causes:

| Symptom (in Desktop logs) | Likely cause | Fix |
|---|---|---|
| `No matching version found for undefined@-y` | newline injected into args on paste | re-run the merge from a file (§3.1) |
| `No such file or directory` (custom server) | relative / split path | use the absolute `--directory` |
| `command not found` / server won't spawn | `uv`/`npx` not on Desktop's PATH | use absolute command paths (§3.1) |
| GitHub 401 | PAT missing scope or unresolved `${...}` | re-check §2.1; re-run merge |
| Notion empty / 401 | integration not connected to the DB | connect integration to the DB (§2.2) |

Fix the cause, re-run §3.1, restart Desktop, re-check §3.4 — then continue.

---

## 4. Smoke test (one fresh chat per server)

| Server | Prompt | Expected |
|---|---|---|
| GitHub | `List my 5 most recent pull requests on NickSkrypchenko/gen-ai-software-engineering` | 5 PRs, "used github integration" badge |
| Filesystem | `List the files in the homework-5 directory of my repo` | directory listing |
| Notion | `Give me the last 5 bugs from my Bugs database` | 5 bug pages (titles/status) |
| Custom | `Call the read tool from the lorem-ipsum MCP server with word_count=50` | exactly 50 words of lorem ipsum |

> **Custom-server tip:** say "the read tool **from the lorem-ipsum MCP server**". A bare
> "use the read tool" collides with Claude's built-in file Reader.

---

## 5. Custom server — standalone run & test

```bash
cd homework-5/custom-mcp-server
uv sync                 # install deps from uv.lock
uv run server.py        # start (stdio transport) — Ctrl+C to stop
uv run pytest -v        # 5/5 passing

# sanity: the server object + name
uv run python -c "from server import mcp; print(type(mcp).__name__, mcp.name)"
# -> FastMCP lorem-ipsum
```
