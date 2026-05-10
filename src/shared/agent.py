from __future__ import annotations

import logging

from src.config import settings
from src.shared.claude_runner import (
    CHAT_ALLOWED_TOOLS,
    OWNER_ALLOWED_TOOLS,
    run_claude,
)
from src.whatsapp.schemas import WhatsAppInbound

logger = logging.getLogger("agent")

_SALES_PROMPT_PATH = settings.AGENT_DIR / "system_prompts" / "sales.md"
_OWNER_PROMPT_PATH = settings.AGENT_DIR / "system_prompts" / "owner_assistant.md"
_CHAT_PROMPT_PATH = settings.AGENT_DIR / "system_prompts" / "onsite_chat.md"


def _load_sales_prompt() -> str:
    return _SALES_PROMPT_PATH.read_text(encoding="utf-8")


def _load_owner_prompt() -> str:
    return _OWNER_PROMPT_PATH.read_text(encoding="utf-8")


def _load_chat_prompt() -> str:
    return _CHAT_PROMPT_PATH.read_text(encoding="utf-8")


async def process_whatsapp_inbound(ib: WhatsAppInbound) -> dict:
    """Pass 1: handle a fresh WhatsApp inbound."""
    sales = _load_sales_prompt()
    prompt = f"""{sales}

---

Customer phone: {ib.sender}
Inbound WhatsApp message:
\"\"\"{ib.message}\"\"\"

Run the tool chain. Reply via mcp__happycake__whatsapp_send to {ib.sender}.
End your turn with one sentence summarizing what you did and what (if anything) needs human follow-up.
"""
    result = await run_claude(prompt)
    if result.get("is_error"):
        logger.error("pass1 failed for id=%s: %s", ib.message_id, result.get("error"))
    else:
        logger.info("pass1 ok id=%s turns=%s", ib.message_id, result.get("num_turns"))
    return result


_PASS2_TEMPLATE = """{sales}

---

CONTEXT — the owner just decided on a custom-work request you previously
escalated for approval.

Customer phone: {phone}
Original WhatsApp inbound from this customer:
\"\"\"{inbound}\"\"\"

Pass-1 summary (your earlier draft):
{pass1_summary}

Owner decision: **{decision}**

If decision is APPROVED:
- Run the full order chain now:
    1. mcp__happycake__square_list_catalog (find the right variationId)
    2. mcp__happycake__square_create_order (source="whatsapp")
    3. mcp__happycake__kitchen_create_ticket (link to orderId, productId from kitchenProductId, requestedPickupAt from the customer's ask or the soonest reasonable slot)
    4. compare estimatedReadyAt vs requestedPickupAt, adjust if needed
    5. mcp__happycake__whatsapp_send — confirm in HappyCake voice with order #, total, ready-by time

If decision is REJECTED:
- Do NOT create an order or kitchen ticket.
- mcp__happycake__whatsapp_send a kind, brand-voice reply explaining we can't take this one on the requested terms, and offer an alternative if it makes sense.

End your final summary with one sentence describing what you did, then on its own block:

```
📩 Reply sent to customer:
<the verbatim message body you sent via whatsapp_send — paste the text directly, no quote markers, no `>` prefixes>
```
"""


async def process_chat_message(message: str, history: list[dict] | None = None) -> dict:
    """On-site chat assistant turn ('Saule' on the storefront chat widget).

    `history` is the prior conversation as `[{role: "user"|"agent", content: str}, ...]`.
    Read-only MCP tools only. Returns the same JSON shape as the other passes.
    """
    history = history or []
    formatted_history = "\n".join(
        f"{'Customer' if h.get('role') == 'user' else 'Saule (you)'}: {h.get('content', '')}"
        for h in history
        if h.get("content")
    ) or "(no prior turns in this session)"

    prompt = f"""{_load_chat_prompt()}

---

PREVIOUS CONVERSATION HISTORY
-----------------------------
{formatted_history}

CURRENT CUSTOMER MESSAGE
------------------------
\"\"\"{message}\"\"\"

Use the read-only MCP tools as needed. Reply concisely. End with the
required `📩 Reply sent to customer:` block, and (if applicable) the
`ESCALATE_TO_OWNER:<type>` marker plus its structured brief.
"""
    result = await run_claude(
        prompt,
        allowed_tools=CHAT_ALLOWED_TOOLS,
        max_turns=10,
        timeout_seconds=120.0,
    )
    if result.get("is_error"):
        logger.error("chat turn failed: %s", result.get("error"))
    else:
        logger.info("chat turn ok turns=%s", result.get("num_turns"))
    return result


async def process_owner_message(message: str) -> dict:
    """Owner-assistant turn: free-text from the Telegram owner chat.

    Read-only MCP tools only. Returns the same JSON shape as the other
    `process_*` calls (caller reads `result.result` for the agent's text).
    """
    prompt = f"""{_load_owner_prompt()}

---

The owner just sent you this message in Telegram:
\"\"\"{message}\"\"\"

Read whatever MCP tools you need to answer factually. Reply concisely.
"""
    result = await run_claude(
        prompt,
        allowed_tools=OWNER_ALLOWED_TOOLS,
        max_turns=10,
        timeout_seconds=120.0,
    )
    if result.get("is_error"):
        logger.error("owner-chat failed: %s", result.get("error"))
    else:
        logger.info("owner-chat ok turns=%s", result.get("num_turns"))
    return result


async def process_approval_decision(approval: dict) -> dict:
    """Pass 2: execute or reject after the owner has decided."""
    sales = _load_sales_prompt()
    prompt = _PASS2_TEMPLATE.format(
        sales=sales,
        phone=approval["phone"],
        inbound=approval["inbound_message"],
        pass1_summary=approval.get("pass1_summary") or "(no summary captured)",
        decision=approval["status"].upper(),
    )
    result = await run_claude(prompt)
    if result.get("is_error"):
        logger.error("pass2 failed id=%s: %s", approval["id"], result.get("error"))
    else:
        logger.info("pass2 ok id=%s turns=%s", approval["id"], result.get("num_turns"))
    return result
