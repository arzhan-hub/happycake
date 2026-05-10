from __future__ import annotations

import logging

from src.config import settings
from src.shared.claude_runner import run_claude
from src.whatsapp.schemas import WhatsAppInbound

logger = logging.getLogger("agent")

_SALES_PROMPT_PATH = settings.AGENT_DIR / "system_prompts" / "sales.md"


def _load_sales_prompt() -> str:
    return _SALES_PROMPT_PATH.read_text(encoding="utf-8")


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
