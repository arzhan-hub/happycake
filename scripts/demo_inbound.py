#!/usr/bin/env python3
"""Drive a simulated customer turn for demos / evaluator runs.

Calls the hosted MCP `whatsapp_inject_inbound`. The simulator forwards the
event to whatever URL was registered via `whatsapp_register_webhook`
(Meta WhatsApp Business API envelope shape), and our wrapper handles it at
`/webhooks/whatsapp`.

Usage:
  python scripts/demo_inbound.py --from +12679883724 \
    --message "Hi, do you have a whole honey cake today?"

Notes:
  - The cloudflare tunnel must be up and registered with the simulator
    (see README §"Setup from a fresh clone") for the forwarded webhook
    to land on our wrapper.
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


def load_mcp_config() -> dict:
    if not MCP_CONFIG_PATH.exists():
        sys.exit(f"missing {MCP_CONFIG_PATH} — copy .mcp.example.json and fill SBC_TOKEN")
    return json.loads(MCP_CONFIG_PATH.read_text())["mcpServers"]["happycake"]


async def post_mcp_inject(client: httpx.AsyncClient, mcp: dict, phone: str, message: str) -> httpx.Response:
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
    args = p.parse_args()

    mcp = load_mcp_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        result = await post_mcp_inject(client, mcp, args.phone, args.message)

    body = result.text
    try:
        body = json.dumps(json.loads(body), indent=2)
    except Exception:
        pass
    print(f"{result.status_code} {result.request.url}\n{body[:600]}")
    return 0 if 200 <= result.status_code < 300 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
