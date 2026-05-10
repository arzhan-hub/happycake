#!/usr/bin/env python3
"""Drive a simulated customer turn for demos / evaluator runs.

Calls the hosted MCP `whatsapp_inject_inbound`. The simulator then forwards
the event to our registered webhook (Meta WhatsApp Business API envelope
shape), which our wrapper handles via /webhooks/whatsapp.

Usage:
  python scripts/demo_inbound.py --from +12679883724 --message "Hi, do you have a whole honey cake today?"
  python scripts/demo_inbound.py --from +12679883724 --message "..." --also-webhook    # also POST direct to local wrapper (debug)

Notes:
  - The cloudflare tunnel must be running and registered with the simulator
    (see README) for the forwarded webhook to land on our wrapper.
  - The wrapper itself is at http://localhost:8080 by default. Override with
    --wrapper-url.
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
DEFAULT_WRAPPER_URL = "http://localhost:8080/webhooks/whatsapp"


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


async def post_wrapper_direct(client: httpx.AsyncClient, url: str, phone: str, message: str) -> httpx.Response:
    """Debug-only: bypass the simulator and post a synthetic Meta envelope to
    the wrapper. Useful when developing offline or comparing behaviors."""
    envelope = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "demo-direct",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "demo"},
                            "contacts": [{"wa_id": phone}],
                            "messages": [
                                {
                                    "from": phone,
                                    "id": f"wamid.demo.{int(asyncio.get_event_loop().time() * 1000)}",
                                    "timestamp": str(int(asyncio.get_event_loop().time())),
                                    "type": "text",
                                    "text": {"body": message},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }
    return await client.post(url, json=envelope)


async def main() -> int:
    p = argparse.ArgumentParser(description="Drive a simulated WhatsApp inbound")
    p.add_argument("--from", dest="phone", required=True, help="E.164 phone, e.g. +12679883724")
    p.add_argument("--message", required=True)
    p.add_argument("--wrapper-url", default=DEFAULT_WRAPPER_URL)
    p.add_argument("--also-webhook", action="store_true",
                   help="Debug: also POST a synthetic Meta envelope directly to the wrapper")
    p.add_argument("--no-mcp", action="store_true",
                   help="Debug: skip MCP injection (only useful with --also-webhook)")
    args = p.parse_args()

    mcp = load_mcp_config()
    coros: list[tuple[str, "asyncio.Future"]] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        if not args.no_mcp:
            coros.append(("mcp", post_mcp_inject(client, mcp, args.phone, args.message)))
        if args.also_webhook:
            coros.append(("wrapper", post_wrapper_direct(client, args.wrapper_url, args.phone, args.message)))

        if not coros:
            sys.exit("nothing to do — pass at least one of (default MCP) or --also-webhook")

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
