# Custom MCP Server — lorem-ipsum

A minimal [FastMCP](https://github.com/jlowin/fastmcp) server that serves the first
`word_count` words of `lorem-ipsum.md` via a resource template and a `read` tool.

## Run

```bash
uv sync
uv run server.py
```

## Test

```bash
uv run pytest -v
```

See the repo-level [HOWTORUN.md](../HOWTORUN.md) for full setup and MCP client wiring.
