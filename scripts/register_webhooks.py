#!/usr/bin/env python3
"""Register WhatsApp + Instagram webhook URLs with the hosted MCP simulator.

Reads `PUBLIC_WEBHOOK_BASE_URL` from .env (or `--base-url`), appends the
channel paths the wrapper exposes, and calls the MCP tools
`whatsapp_register_webhook` and `instagram_register_webhook` over JSON-RPC.

Run this every time the cloudflare tunnel URL changes (quick-tunnels rotate
on every `cloudflared` restart).

Usage:
  .venv/bin/python scripts/register_webhooks.py
  .venv/bin/python scripts/register_webhooks.py --base-url https://<sub>.trycloudflare.com
  .venv/bin/python scripts/register_webhooks.py --only whatsapp
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parent.parent
MCP_CONFIG_PATH = ROOT / ".mcp.json"
ENV_PATH = ROOT / ".env"


def load_env_value(key: str) -> str | None:
    if not ENV_PATH.exists():
        return None
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None


def load_mcp_config() -> dict:
    if not MCP_CONFIG_PATH.exists():
        sys.exit(f"missing {MCP_CONFIG_PATH} — copy .mcp.example.json and fill SBC_TOKEN")
    return json.loads(MCP_CONFIG_PATH.read_text())["mcpServers"]["happycake"]


def call_tool(mcp: dict, name: str, arguments: dict) -> dict:
    headers = {
        **mcp.get("headers", {}),
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    r = httpx.post(mcp["url"], headers=headers, json=body, timeout=15.0)
    r.raise_for_status()
    return r.json()


def main() -> int:
    p = argparse.ArgumentParser(description="Register webhooks with the HappyCake MCP")
    p.add_argument("--base-url", help="Tunnel base URL, e.g. https://<sub>.trycloudflare.com. "
                                       "Defaults to PUBLIC_WEBHOOK_BASE_URL from .env.")
    p.add_argument("--only", choices=["whatsapp", "instagram"], help="Register one channel only")
    args = p.parse_args()

    base = (args.base_url or os.getenv("PUBLIC_WEBHOOK_BASE_URL") or load_env_value("PUBLIC_WEBHOOK_BASE_URL") or "").rstrip("/")
    if not base or not base.startswith("https://"):
        sys.exit("no public base URL — pass --base-url or set PUBLIC_WEBHOOK_BASE_URL in .env")

    mcp = load_mcp_config()
    targets = [
        ("whatsapp", "whatsapp_register_webhook", f"{base}/webhooks/whatsapp"),
        ("instagram", "instagram_register_webhook", f"{base}/webhooks/instagram"),
    ]
    if args.only:
        targets = [t for t in targets if t[0] == args.only]

    rc = 0
    for label, tool, url in targets:
        try:
            resp = call_tool(mcp, tool, {"url": url})
        except Exception as exc:
            print(f"[{label}] ERROR calling {tool}: {exc!r}")
            rc = 1
            continue
        text = ""
        for item in resp.get("result", {}).get("content", []):
            if item.get("type") == "text":
                text = item.get("text", "")
                break
        if not text:
            print(f"[{label}] unexpected response: {json.dumps(resp)[:300]}")
            rc = 1
            continue
        print(f"[{label}] {url}\n   → {text}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
