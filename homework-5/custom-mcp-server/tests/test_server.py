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
        # fastmcp 3.4.2: read_resource returns the contents list directly
        # (spec §6.1 assumed a .contents wrapper from an older API).
        text = result[0].text
        assert len(text.split()) == 15


@pytest.mark.asyncio
async def test_tool_negative_count_raises():
    async with Client(mcp) as client:
        with pytest.raises(Exception):
            await client.call_tool("read", {"word_count": -1})
