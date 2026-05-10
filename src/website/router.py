from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import re

from src.shared import mcp_client
from src.shared.turn import run_chat_turn
from src.website.orders import process_order
from src.website.schemas import ChatRequest, WebsiteOrderRequest


# Strip the verbatim "📩 Reply sent to customer:" block out of the agent
# summary; the chat widget should only render the actual customer-facing
# reply, which is the section preceding (or following — see logic) that
# block. The agent's full summary has both an internal trace and the
# verbatim reply; chat needs only the reply.
_REPLY_BLOCK_RE = re.compile(r"📩\s*Reply sent to customer:\s*\n(.*?)(?=\n[A-Z🛒💬🕐⏱📊✅📩👤📋😞⚠️🆔🔒]|\Z)", re.DOTALL)
_ESCALATE_LINE_RE = re.compile(r"^ESCALATE_TO_OWNER:[a-z_]+\s*$", re.MULTILINE)
_BRIEF_BLOCKS_RE = re.compile(r"^📋[\s\S]*?(?=\n📩|\Z)", re.MULTILINE)


def _extract_customer_reply(summary: str) -> str:
    """Return only the customer-facing reply text from the agent's summary."""
    if not summary:
        return ""
    m = _REPLY_BLOCK_RE.search(summary)
    if m:
        reply = m.group(1).strip()
        # strip leading > blockquote markers if any
        reply = re.sub(r"^>\s?", "", reply, flags=re.MULTILINE)
        return reply
    # Fallback: strip the internal-only sections, return whatever's left.
    out = _ESCALATE_LINE_RE.sub("", summary)
    out = _BRIEF_BLOCKS_RE.sub("", out)
    return out.strip()

logger = logging.getLogger("website")

router = APIRouter(prefix="/api", tags=["website"])


@router.post("/orders")
async def create_order(req: WebsiteOrderRequest) -> JSONResponse:
    status, body = await process_order(req)
    return JSONResponse(status_code=status, content=body)


@router.get("/catalog")
async def get_catalog() -> JSONResponse:
    """Combined catalog + kitchen constraints, denormalized per SKU.

    Lets the storefront render menus, lead times, and a `requires_custom_work`
    flag without making two upstream calls itself.
    """
    try:
        catalog_raw = await mcp_client.call_tool("square_list_catalog")
        constraints_raw = await mcp_client.call_tool("kitchen_get_menu_constraints")
    except mcp_client.McpError as exc:
        logger.warning("catalog fetch failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"ok": False, "error": "mcp_unavailable", "message": str(exc)},
        )

    items_in = catalog_raw.get("catalog", []) if isinstance(catalog_raw, dict) else catalog_raw
    constraints_by_pid = {c["productId"]: c for c in (constraints_raw or [])}

    items = []
    for row in items_in:
        kpid = row.get("kitchenProductId")
        c = constraints_by_pid.get(kpid, {})
        items.append({
            "variation_id": row.get("variationId"),
            "kitchen_product_id": kpid,
            "name": row.get("name"),
            "category": row.get("category"),
            "price_cents": row.get("priceCents"),
            "description": row.get("description"),
            "lead_time_minutes": c.get("leadTimeMinutes"),
            "prep_minutes": c.get("prepMinutes"),
            "daily_capacity_units": c.get("capacityUnitsPerDay"),
            "requires_custom_work": bool(c.get("requiresCustomWork", False)),
        })

    return JSONResponse(content={"ok": True, "items": items})


@router.post("/chat")
async def chat(req: ChatRequest) -> JSONResponse:
    """On-site assistant ('Saule') for the storefront chat widget."""
    history = [h.model_dump() for h in req.history]
    result = await run_chat_turn(req.message, history)

    if result.get("is_error"):
        return JSONResponse(
            status_code=502,
            content={
                "ok": False,
                "error": "chat_failed",
                "message": result.get("error") or "chat agent failed",
            },
        )

    summary = (result.get("result") or "").strip()
    reply = _extract_customer_reply(summary) or "Thanks — let me get back to you on that."

    # Detect escalation type for the response (turn.py already pushed Telegram).
    m = re.search(r"ESCALATE_TO_OWNER:([a-z_]+)", summary)
    escalated = m is not None
    escalation_type = m.group(1) if m else None

    return JSONResponse(
        content={
            "ok": True,
            "reply": reply,
            "escalated": escalated,
            "escalation_type": escalation_type,
            "num_turns": result.get("num_turns"),
            "duration_ms": result.get("duration_ms"),
        }
    )


@router.get("/health")
async def health() -> dict:
    return {"ok": True, "channel": "website"}
