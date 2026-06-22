# Claude Code — Kickoff Prompt (Homework 5)

Paste the block below into a Claude Code session opened with the repo root at `~/Desktop/SET/ai-assisted-dev-homework/gen-ai-software-engineering`. Branch will be created during Phase 0.1.

---

## Prerequisites (do once, before pasting the prompt)

These are environment-level setup steps Claude Code can't do for you (require system install or authentication):

1. **Claude Code installed and authenticated** — verify via `which claude` (returns a path) and `claude /status` (shows logged-in user). If not installed: https://docs.anthropic.com/claude-code. If not authenticated: `claude /login`.

2. **Node.js (npm + npx) ≥ 20** — required for the 3 external MCP servers (`npx -y ...` invocations). Verify via `node --version`.

3. **uv installed** — required for the custom FastMCP server. Verify via `uv --version`. Install: `curl -LsSf https://astral.sh/uv/install.sh | sh`.

4. **GitHub PAT and Notion integration token** — Phase 0.3 + 0.4 explicitly call you out as the driver. Claude Code will pause and ask. Token creation flows take ~5 min each. Have a browser tab on github.com/settings/tokens and notion.so/my-integrations ready.

5. **Claude Desktop installed** — Phase 4 + 5 require Desktop. App is the demo surface; Claude Code is the build driver.

6. **`jq` and `envsubst` recommended** (not blocking) — `brew install jq gettext` on macOS. Used in HOWTORUN's substitution one-liner and acceptance checks.

---

## Prompt to paste

You are implementing **Homework 5 — MCP Servers Setup & Custom FastMCP Server** as the implementation driver for this repo. The full design spec is at:

```
homework-5/docs/specs/2026-06-19-mcp-setup-design.md
```

**Step 0 — read the spec end-to-end before doing anything else.** It is authoritative. If anything in the spec contradicts these instructions, the spec wins. If anything is genuinely ambiguous, ask me before guessing.

### Ground rules

1. **Working directory:** `homework-5/`. All implementation lives there. Do not modify files outside that directory except (a) `git`-level operations on branches/main, and (b) `~/Library/Application Support/Claude/claude_desktop_config.json` — and ONLY at Phase 4 as an instruction I follow manually, never by you running shell commands against my Desktop config file.

2. **Branch:** create `homework-5-submission` off fresh `main` in Phase 0.1 (after `git fetch upstream && git checkout main && git merge upstream/main && git push origin main`). All Phase 0.2+ commits land on `homework-5-submission`.

3. **One phase at a time.** Execute the phase pipeline in spec §7.1 (Phases 0.1 → 9) in order, respecting §7.2 ordering rules. After each phase: commit with Conventional Commits scoped to the phase (`feat(phase-1):`, `docs(phase-7):`, `test(phase-2):`, etc.) and summarize what you did and what's next in one short message before starting the next phase.

4. **Stop and ask me before:**
   - **Phase 0.3** (GitHub PAT) — I create the token in browser, save to `~/.zshrc` as `GITHUB_PAT`, source the file, then come back. You verify with one of the 3 methods in spec §7.1.
   - **Phase 0.4** (Notion token) — same flow with `NOTION_TOKEN`.
   - **Phase 4** (install + register MCPs in Claude Desktop) — you generate the substituted JSON for me to paste, give me the exact copy-paste steps with the envsubst one-liner. I edit Desktop config, restart Desktop, verify via Settings → Developer OR `jq '.mcpServers | keys | length'` returns 4. Tell me when to proceed.
   - **Phase 5** (smoke + screenshots) — give me the 4 prompts to paste into 4 fresh Desktop chats with exact filename for each screenshot. I take the screenshots, save them, tell you when done.
   - **Phase 9** (PR) — confirm everything is green, then I confirm the PR push.

5. **`docs/AI-USAGE.md` is a living document.** Append a section after every AI-driven phase (0.1, 0.2, 0.5, 1, 2, 3, 6, 7, 8). Phases 0.3, 0.4, 4, 5 get one-liner "USER-driven" entries with timestamp. Phase 9 = PR open.

6. **Use the Context-Model-Prompt (CMP) framework explicitly.** Each entry in `docs/AI-USAGE.md` records:
   - **Context loaded** (which files, which spec sections, which prior outputs)
   - **Model** (`claude-sonnet-4-6` default for all Claude Code phases; brainstorm was Cowork Sonnet 4.7)
   - **Prompt** (verbatim — even if you authored it in-flight)
   - **Outcome** (accepted | edited | rejected) + one-paragraph rationale
   The CMP summary table from spec §7.4 should be reproduced at the top of `AI-USAGE.md`.

7. **Token hygiene is non-negotiable.**
   - **Never** write a real PAT, Notion token, or Bearer string into any committed file.
   - `mcp.json` in repo MUST use `${GITHUB_PAT}` / `${NOTION_TOKEN}` placeholders ONLY.
   - Before EVERY commit run `grep -rE "ghp_|secret_|ntn_|Bearer [A-Za-z0-9]+" homework-5/` — if non-empty, refuse to commit until cleaned.
   - At Phase 8 self-review this grep is mandatory.

8. **Quality gates (non-negotiable):**
   - `uv run pytest -v` in `homework-5/custom-mcp-server/` → 5/5 passing
   - `python -m json.tool < homework-5/mcp.json` parses cleanly
   - All 4 servers connected in Claude Desktop (verified via Settings UI or `jq` count = 4)
   - 4 screenshots present in `docs/screenshots/` with required content per spec §7.1 Phase 5 exit criteria
   - All required deliverables present per spec §10 acceptance checklist

9. **Don't invent scope.** If something isn't in the spec, it isn't in v1. The spec explicitly lists out-of-scope items (HTTP/SSE transport, CI smoke against real MCPs, Docker, multi-resource server, GitHub App auth) and Future Work — don't try to "improve" them.

10. **Phase 4 fallback is mandatory.** If GitHub or Notion auth fails after I paste the substituted config, **STOP and diagnose** (token scope? URL? rate limit?), fix, resume Phase 4. **Do NOT skip a failed server** — brief requires all 3 external configured.

### Tooling per phase

| Phase | Tool | Fallback |
|---|---|---|
| 0.1 | git, your shell access | If `git merge upstream/main` conflicts: stop, surface the diff, ask me |
| 0.5 | bash grep, git status | — |
| 1 | uv, Python via Read/Write/Edit | If FastMCP API differs from spec §3.1 (e.g., `.name` attribute doesn't exist): adapt to the installed version, document the difference in `server.py` docstring and AI-USAGE |
| 2 | uv, pytest | If `pytest-asyncio` async fixture pattern differs in installed version: adapt and document |
| 3 | Write | — |
| 6, 7 | Read, Write | — |
| 8 | bash grep, mental review | — |
| 9 | git, `gh` CLI | If `gh` not installed: prepare the PR body file and tell me to push manually |

You do NOT invoke `/codex:review` for HW5 (spec §0 decision — overkill for ~80 LOC). Phase 8 is inline self-review.

### Custom MCP server — critical correctness notes

1. **Spec §3.1 is the implementation contract for `server.py`.** Match the structure: `_slice_words` helper, `lorem_resource` for resource template, `read` for tool, `mcp.run()` in `__main__`. Adapt only if the installed FastMCP version's API truly differs.

2. **`lorem-ipsum.md` is plain paragraph text** — no markdown headers, lists, or code blocks. `str.split()` counts each whitespace-separated token as a word; headers would inflate count. ~500 words.

3. **Resource template `lorem://words/{word_count}`** — FastMCP auto-parses `{word_count}` to int from the URI. Verify with the resource test.

4. **Test imports** — tests use `from server import mcp` (flat layout), enabled by `pythonpath = ["."]` in `[tool.pytest.ini_options]`. Don't refactor to src-layout.

### `mcp.json` — env var substitution

Spec §5 is the authoritative source for `mcp.json`. **Important:** Claude Desktop does NOT expand `${VAR}` placeholders. The repo file is reference-only; HOWTORUN (Phase 7) must include the full substitution section per spec §5 (envsubst one-liner + manual fallback + before/after for Notion headers + post-substitute `jq` verification).

### Pre-flight environment (special: applies before Phase 1)

- `node --version` ≥ 20 (npx)
- `uv --version` (any recent)
- `git remote -v` shows both `origin` (your fork) and `upstream` (Alexey-Popov/...)
- If any missing: stop and ask me.

### How to start

1. Read `homework-5/docs/specs/2026-06-19-mcp-setup-design.md` end-to-end. Pay special attention to:
   - **§3.1** — custom server code (this is the implementation contract)
   - **§5** — `mcp.json` shape + the substitution rationale + HOWTORUN requirements
   - **§6.1** — exact test cases
   - **§7.1** — phase pipeline + exit criteria
   - **§7.3** — approval gates
   - **§10** — acceptance checklist
2. Skim `homework-5/TASKS.md` (course brief) for context.
3. Reply with a short (≤10 bullet) restatement of what you understood, plus any genuine ambiguities you want me to resolve **before Phase 0.1**. In particular flag:
   - Whether `git remote -v` shows `upstream` configured (needed for Phase 0.1)
   - Whether `uv`, `node`, `jq`, `envsubst` are installed
   - Any FastMCP API uncertainty (e.g., resource template parameter parsing)
4. Once I confirm, execute Phase 0.1 (git setup) → Phase 0.2 (scaffold) → Phase 0.5 (verify clean) in sequence. Then **stop before Phase 0.3** and ask me to create the GitHub PAT.
5. Continue per spec §7.3 approval gates.

### Definition of done

The acceptance checklist in spec §10 is the canonical "done" definition. Highlights:
- `homework-5-submission` branch, off fresh main
- `server.py` + 5/5 pytest green
- `mcp.json` valid + zero real tokens (grep clean)
- 4 servers Connected in Claude Desktop
- 4 screenshots in `docs/screenshots/` matching Phase 5 criteria
- README + HOWTORUN + AI-USAGE all complete per spec §7.1 row 6 + 7 exit criteria
- PR opened against fork's `main` (NickSkrypchenko/gen-ai-software-engineering — **NOT** upstream), `Alexey-Popov` reviewer, labels `homework-5` + `ready-for-review`
- **No `ghp_*`, `ntn_*`, `secret_*`, or `Bearer <real-token>` strings anywhere in `homework-5/`**

Good luck. Start with Step 1.

---

## Notes for Nicko (not part of the prompt)

- **Total wall-time estimate:** 1.5–2.5 hours.
  - Phases 0.1, 0.2, 0.5: ~10 min (Claude Code, fully autonomous)
  - Phase 0.3 GitHub PAT: ~5 min (you)
  - Phase 0.4 Notion token: ~10 min (you — integration creation + DB sharing)
  - Phases 1, 2, 3: ~15-20 min (Claude Code)
  - Phase 4 install/auth: ~10-30 min (you, with fallback risk)
  - Phase 5 screenshots: ~15 min (you)
  - Phases 6, 7, 8, 9: ~25-40 min (Claude Code)

- **Differences from HW4 kickoff:**
  - No deployment, no LLM-driven E2E phase (Phase 10 of HW4 was the expensive one — HW5 has no equivalent)
  - More USER-driven phases (0.3, 0.4, 4, 5) because token creation and Desktop config edit are human-private
  - No `/codex:review` (~80 LOC doesn't justify ceremony)
  - Smaller phase count (10 phases vs 16) reflecting actual scope

- **Riskiest phase: Phase 4.** Notion's `OPENAPI_MCP_HEADERS` nested-JSON escaping is the most likely place to introduce a typo. The HOWTORUN substitution section (spec §5) is specifically designed to prevent this.

- **If you want this fully autonomous**, drop ground rule #4 entries for Phases 4 and 5 — but you'll need to grant Claude Code permission to edit Desktop config, and you still need to take screenshots manually (it can't drive your screen). Not recommended.

- **If less autonomous**, change ground rule #4 to "ask before every phase boundary." Likely overkill for this scope.

- **Approve flow with Claude Code at the start:** when CC replies with restatement bullets + ambiguities, address them, then say "approved, start Phase 0.1." From there it runs phase-by-phase autonomously, only pausing at the 5 gates in ground rule #4.
