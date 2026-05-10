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


# Read-only tools the owner-assistant (Telegram bot chat) is allowed to call.
# Writes are intentionally excluded — the owner can ask questions but not
# accidentally trigger orders or messages from a chat session.
OWNER_ALLOWED_TOOLS = [
    "mcp__happycake__square_list_catalog",
    "mcp__happycake__square_get_inventory",
    "mcp__happycake__square_recent_orders",
    "mcp__happycake__square_recent_sales_csv",
    "mcp__happycake__square_get_pos_summary",
    "mcp__happycake__kitchen_get_capacity",
    "mcp__happycake__kitchen_get_menu_constraints",
    "mcp__happycake__kitchen_list_tickets",
    "mcp__happycake__kitchen_get_production_summary",
    "mcp__happycake__whatsapp_list_threads",
    "mcp__happycake__instagram_list_dm_threads",
    "mcp__happycake__gb_list_reviews",
    "mcp__happycake__gb_get_metrics",
    "mcp__happycake__gb_list_simulated_actions",
    "mcp__happycake__marketing_get_budget",
    "mcp__happycake__marketing_get_campaign_metrics",
    "mcp__happycake__marketing_get_margin_by_product",
    "mcp__happycake__marketing_get_sales_history",
    "mcp__happycake__world_get_scenarios",
    "mcp__happycake__world_get_scenario_summary",
    "mcp__happycake__world_get_timeline",
    "mcp__happycake__evaluator_get_evidence_summary",
]


# Read-only MCP tools the on-site chat assistant (Saule on the storefront)
# is allowed to call. No write tools — chat does not create orders or send
# WhatsApp messages. Order placement happens via the order form (which goes
# through /api/orders); escalations happen via the ESCALATE_TO_OWNER marker.
CHAT_ALLOWED_TOOLS = [
    "mcp__happycake__square_list_catalog",
    "mcp__happycake__square_get_inventory",
    "mcp__happycake__square_recent_orders",
    "mcp__happycake__square_get_pos_summary",
    "mcp__happycake__kitchen_get_capacity",
    "mcp__happycake__kitchen_get_menu_constraints",
    "mcp__happycake__kitchen_list_tickets",
    "mcp__happycake__kitchen_get_production_summary",
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
