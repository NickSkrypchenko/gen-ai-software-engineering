"""Custom FastMCP server: serves first N words of lorem-ipsum.md via resource + tool.

Server name is "lorem-ipsum" (see FastMCP(...) below). The installed FastMCP
version exposes the name via the `mcp.name` attribute.
"""
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
