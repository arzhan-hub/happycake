"""Minimal async MCP client for the hosted HappyCake JSON-RPC HTTP server.

Used by the website service, the Telegram /status handler, and the demo
driver. Reads the URL + auth header from .mcp.json (same file `claude` uses).
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from src.config import settings

logger = logging.getLogger("mcp_client")


class McpError(RuntimeError):
    pass


def _config() -> dict:
    if not settings.MCP_CONFIG_PATH.exists():
        raise McpError(f"missing {settings.MCP_CONFIG_PATH}")
    return json.loads(settings.MCP_CONFIG_PATH.read_text())["mcpServers"]["happycake"]


async def call_tool(name: str, arguments: dict | None = None, *, timeout: float = 15.0) -> Any:
    """Invoke an MCP tool by name; return the parsed JSON content (or text).

    The MCP server packages results as `{"content": [{"type": "text", "text": "<json>"}]}`.
    We unwrap and JSON-parse the text. If JSON parsing fails (e.g. plain ack
    string), the raw text is returned.
    """
    cfg = _config()
    headers = {
        **cfg.get("headers", {}),
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments or {}},
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(cfg["url"], headers=headers, json=body)
    if r.status_code != 200:
        raise McpError(f"http {r.status_code}: {r.text[:300]}")

    payload = r.json()
    if "error" in payload:
        raise McpError(f"mcp error: {payload['error']}")

    result = payload.get("result", {})
    for item in result.get("content", []) or []:
        if item.get("type") == "text":
            text = item.get("text", "")
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
    return result
