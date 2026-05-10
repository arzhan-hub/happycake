from __future__ import annotations

import asyncio
import json
import logging
import os

from src.config import settings

logger = logging.getLogger("claude_runner")


# MCP tools the sales agent is allowed to call without per-turn approval.
# Read-only first, then writes. New write-tools must be added here explicitly.
ALLOWED_TOOLS = [
    "mcp__happycake__square_list_catalog",
    "mcp__happycake__square_get_inventory",
    "mcp__happycake__square_create_order",
    "mcp__happycake__kitchen_get_capacity",
    "mcp__happycake__kitchen_get_menu_constraints",
    "mcp__happycake__kitchen_create_ticket",
    "mcp__happycake__kitchen_list_tickets",
    "mcp__happycake__whatsapp_send",
    "mcp__happycake__whatsapp_list_threads",
]


async def run_claude(
    prompt: str,
    max_turns: int = 12,
    timeout_seconds: float = 180.0,
    allowed_tools: list[str] | None = None,
) -> dict:
    """Spawn `claude -p <prompt>` and return parsed JSON result.

    Returns the full JSON object claude prints (includes `result`, `is_error`,
    `num_turns`, etc.). Caller reads `data["result"]` for the assistant text.
    """
    tools = allowed_tools if allowed_tools is not None else ALLOWED_TOOLS
    cmd = [
        settings.CLAUDE_BIN,
        "-p", prompt,
        "--output-format", "json",
        "--max-turns", str(max_turns),
        "--allowedTools", " ".join(tools),
    ]

    logger.info("claude -p (max_turns=%d, prompt_chars=%d)", max_turns, len(prompt))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(settings.PROJECT_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy(),
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {"is_error": True, "result": "", "error": "timeout"}

    if proc.returncode != 0:
        return {
            "is_error": True,
            "result": "",
            "error": f"exit {proc.returncode}",
            "stderr": stderr.decode("utf-8", errors="replace")[:2000],
        }

    try:
        return json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError as e:
        return {
            "is_error": True,
            "result": "",
            "error": f"json parse failed: {e}",
            "stdout": stdout.decode("utf-8", errors="replace")[:2000],
        }
