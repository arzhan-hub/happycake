#!/usr/bin/env python3
"""Drive a simulated customer turn for demos / evaluator runs.

Fans the same inbound to:
  1. The hosted MCP `whatsapp_inject_inbound` (so simulator state reflects it
     and the evaluator sees the inbound in `whatsapp_list_threads`).
  2. The local wrapper's `/webhooks/whatsapp` endpoint (so our pipeline
     processes it and produces a reply).

Why both: see MCP_DRY_RUN.md — the simulator does not currently fan out
registered webhooks for `inject_inbound` events, so we drive both sides
ourselves.

Usage:
  python scripts/demo_inbound.py --from +12679883724 --message "Hi, do you have a whole honey cake today?"
  python scripts/demo_inbound.py --from +12679883724 --message "..." --no-mcp        # only hit local wrapper
  python scripts/demo_inbound.py --from +12679883724 --message "..." --no-wrapper    # only hit MCP
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parent.parent
MCP_CONFIG_PATH = ROOT / ".mcp.json"
DEFAULT_WRAPPER_URL = "http://localhost:8000/webhooks/whatsapp"


def load_mcp_config() -> dict:
    if not MCP_CONFIG_PATH.exists():
        sys.exit(f"missing {MCP_CONFIG_PATH} — copy .mcp.example.json and fill SBC_TOKEN")
    return json.loads(MCP_CONFIG_PATH.read_text())["mcpServers"]["happycake"]


async def post_wrapper(client: httpx.AsyncClient, url: str, phone: str, message: str) -> httpx.Response:
    return await client.post(url, json={"from": phone, "message": message})


async def post_mcp_inject(client: httpx.AsyncClient, mcp: dict, phone: str, message: str) -> httpx.Response:
    """JSON-RPC 2.0 tools/call against the streaming-HTTP MCP server."""
    headers = {
        **mcp.get("headers", {}),
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "whatsapp_inject_inbound",
            "arguments": {"from": phone, "message": message},
        },
    }
    return await client.post(mcp["url"], headers=headers, json=body)


async def main() -> int:
    p = argparse.ArgumentParser(description="Drive a simulated WhatsApp inbound")
    p.add_argument("--from", dest="phone", required=True, help="E.164 phone, e.g. +12679883724")
    p.add_argument("--message", required=True)
    p.add_argument("--wrapper-url", default=DEFAULT_WRAPPER_URL)
    p.add_argument("--no-mcp", action="store_true")
    p.add_argument("--no-wrapper", action="store_true")
    args = p.parse_args()

    mcp = load_mcp_config()

    async with httpx.AsyncClient(timeout=15.0) as client:
        coros = []
        if not args.no_mcp:
            coros.append(("mcp", post_mcp_inject(client, mcp, args.phone, args.message)))
        if not args.no_wrapper:
            coros.append(("wrapper", post_wrapper(client, args.wrapper_url, args.phone, args.message)))

        results = await asyncio.gather(*[c for _, c in coros], return_exceptions=True)

    rc = 0
    for (label, _), result in zip(coros, results):
        if isinstance(result, Exception):
            print(f"[{label}] ERROR: {result!r}")
            rc = 1
            continue
        body = result.text
        try:
            body = json.dumps(json.loads(body), indent=2)
        except Exception:
            pass
        print(f"[{label}] {result.status_code} {result.request.url}\n{body[:600]}")
    return rc


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
