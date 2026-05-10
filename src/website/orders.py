"""Service layer for /api/orders.

Direct-path order creation (no Claude in the loop), with a notes-keyword
gate that routes decoration-intent orders through the existing approval flow.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from src.config import settings
from src.shared import approvals, mcp_client
from src.telegram_bot import notifier
from src.website.schemas import (
    WebsiteCustomer,
    WebsiteOrderConfirmedResponse,
    WebsiteOrderErrorResponse,
    WebsiteOrderItem,
    WebsiteOrderItemEcho,
    WebsiteOrderPendingApprovalResponse,
    WebsiteOrderRequest,
)

logger = logging.getLogger("website")


# Keyword check: any of these in `notes` flips a non-custom item into the
# approval flow because the customer is implicitly asking for decoration.
_DECORATION_KEYWORDS = (
    "write", "decorate", "on top", "custom", "personali",  # personalize/personalise
    "message", "letters", "inscription", "name on",
)


def _has_decoration_intent(notes: str | None) -> bool:
    if not notes:
        return False
    lo = notes.lower()
    return any(kw in lo for kw in _DECORATION_KEYWORDS)


def _parse_pickup(s: str) -> datetime:
    s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ─── data fetches ────────────────────────────────────────────────────────────


async def _catalog_index() -> dict[str, dict]:
    raw = await mcp_client.call_tool("square_list_catalog")
    items = raw.get("catalog", []) if isinstance(raw, dict) else raw
    return {row["variationId"]: row for row in items}


async def _constraints_index() -> dict[str, dict]:
    raw = await mcp_client.call_tool("kitchen_get_menu_constraints")
    if not isinstance(raw, list):
        return {}
    return {c["productId"]: c for c in raw}


async def _capacity() -> dict:
    return await mcp_client.call_tool("kitchen_get_capacity")


# ─── checks ──────────────────────────────────────────────────────────────────


def _check_capacity(items: list[WebsiteOrderItem],
                    constraints: dict[str, dict],
                    catalog: dict[str, dict],
                    capacity: dict) -> tuple[int, int]:
    """Return (total_prep_minutes, remaining_minutes). Raises ValueError on mismatch."""
    total_prep = 0
    for it in items:
        cat = catalog.get(it.variation_id)
        if cat is None:
            raise ValueError(f"unknown_variation:{it.variation_id}")
        kpid = cat.get("kitchenProductId")
        c = constraints.get(kpid, {})
        prep = int(c.get("prepMinutes", 0))
        total_prep += prep * it.quantity
    return total_prep, int(capacity.get("remainingCapacityMinutes", 0))


def _required_lead_time(items: list[WebsiteOrderItem],
                        constraints: dict[str, dict],
                        catalog: dict[str, dict]) -> int:
    """Max leadTimeMinutes across all items in the order."""
    longest = 0
    for it in items:
        cat = catalog.get(it.variation_id)
        if cat is None:
            continue
        kpid = cat.get("kitchenProductId")
        c = constraints.get(kpid, {})
        longest = max(longest, int(c.get("leadTimeMinutes", 0)))
    return longest


def _has_custom_work_item(items: list[WebsiteOrderItem],
                          constraints: dict[str, dict],
                          catalog: dict[str, dict]) -> bool:
    for it in items:
        cat = catalog.get(it.variation_id)
        if cat is None:
            continue
        kpid = cat.get("kitchenProductId")
        c = constraints.get(kpid, {})
        if c.get("requiresCustomWork"):
            return True
    return False


# ─── side effects ────────────────────────────────────────────────────────────


def _write_evidence(payload: dict, key: str) -> str:
    out_dir = settings.EVIDENCE_DIR / "website_orders"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{key}.json"
    out.write_text(json.dumps(payload, indent=2, default=str))
    return str(out)


async def _push_owner_confirmed(req: WebsiteOrderRequest, order: dict, ticket: dict, total_cents: int) -> None:
    items_lines = "\n".join(
        f"   • {item['name']} ×{item['quantity']} — ${item['priceCents']/100:.2f}"
        for item in order.get("order", {}).get("items", [])
    )
    msg = (
        "🛒 <b>New website order</b>\n"
        "\n"
        f"📞 <b>Customer:</b> {req.customer.name} · <code>{req.customer.phone}</code>\n"
        f"🛍 <b>Items:</b>\n{items_lines}\n"
        f"💰 <b>Total:</b> ${total_cents/100:.2f}\n"
        f"🕐 <b>Pickup:</b> {req.pickup_at}\n"
        f"⏱ <b>Ready by:</b> {ticket.get('estimatedReadyAt', '?')}\n"
        f"🆔 <b>Order:</b> <code>{order.get('order', {}).get('id', '?')}</code>\n"
        f"🍰 <b>Ticket:</b> <code>{ticket.get('id', '?')}</code>"
    )
    if req.notes:
        msg += f"\n📝 <b>Notes:</b> {req.notes}"
    try:
        await notifier.notify_owner(msg)
    except Exception:
        logger.warning("telegram push failed", exc_info=True)


async def _push_owner_approval_request(req: WebsiteOrderRequest, approval_id: str, reason: str) -> None:
    items_lines = "\n".join(
        f"   • <code>{it.variation_id}</code> ×{it.quantity}" for it in req.items
    )
    msg = (
        "⏳ <b>Approval needed — website order</b>\n"
        "\n"
        f"📞 <b>Customer:</b> {req.customer.name} · <code>{req.customer.phone}</code>\n"
        f"🛍 <b>Items:</b>\n{items_lines}\n"
        f"🕐 <b>Pickup:</b> {req.pickup_at}\n"
        f"❓ <b>Why:</b> {reason}"
    )
    if req.notes:
        msg += f"\n📝 <b>Notes:</b> {req.notes}"
    try:
        await notifier.notify_with_approval_buttons(msg, approval_id=approval_id)
    except Exception:
        logger.warning("approval push failed", exc_info=True)


# ─── main entrypoint ────────────────────────────────────────────────────────


async def process_order(req: WebsiteOrderRequest) -> tuple[int, dict]:
    """Returns (http_status, response_body)."""
    # Pickup time must parse
    try:
        pickup = _parse_pickup(req.pickup_at)
    except (ValueError, TypeError):
        return 400, WebsiteOrderErrorResponse(
            error="invalid_pickup_at",
            message="pickup_at must be an ISO-8601 UTC datetime, e.g. 2026-05-12T18:00:00Z",
        ).model_dump()

    # Pull all the catalog/constraint/capacity data we need
    try:
        catalog = await _catalog_index()
        constraints = await _constraints_index()
        capacity = await _capacity()
    except mcp_client.McpError as exc:
        logger.warning("mcp unavailable: %s", exc)
        return 503, WebsiteOrderErrorResponse(
            error="mcp_unavailable",
            message="HappyCake catalog is temporarily unreachable. Please try again in a moment.",
        ).model_dump()

    # Validate every variationId
    for it in req.items:
        if it.variation_id not in catalog:
            return 400, WebsiteOrderErrorResponse(
                error="unknown_variation",
                message=f"We don't have an item with id {it.variation_id} on the menu.",
            ).model_dump()

    now = datetime.now(timezone.utc)
    lead_min = _required_lead_time(req.items, constraints, catalog)
    earliest = now + timedelta(minutes=lead_min + 5)  # 5 min buffer
    if pickup < earliest:
        return 409, WebsiteOrderErrorResponse(
            error="lead_time_too_short",
            message=(
                f"We need at least {lead_min} minutes to prepare this order. "
                f"Earliest pickup: {_iso(earliest)}."
            ),
            earliest_pickup_at=_iso(earliest),
        ).model_dump()

    total_prep, remaining = _check_capacity(req.items, constraints, catalog, capacity)
    if total_prep > remaining:
        # naive "next day at 9am" suggestion — kitchen open hour
        next_day = (now + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)  # 9am CT ≈ 14:00 UTC
        return 409, WebsiteOrderErrorResponse(
            error="capacity_full",
            message=(
                f"Today's kitchen is fully booked ({remaining} min free, "
                f"{total_prep} min needed). Earliest pickup: {_iso(next_day)}."
            ),
            earliest_pickup_at=_iso(next_day),
        ).model_dump()

    # Approval branch — custom-work item OR decoration-intent in notes
    decoration_intent = _has_decoration_intent(req.notes)
    custom_work = _has_custom_work_item(req.items, constraints, catalog)
    if custom_work or decoration_intent:
        reason = "custom-work item" if custom_work else "customer notes ask for decoration / inscription"
        approval_id = f"web_{int(now.timestamp() * 1000)}"
        first_item = req.items[0]
        cat = catalog[first_item.variation_id]
        approvals.record_pending(
            approval_id=approval_id,
            phone=req.customer.phone,
            inbound_message=(
                f"Website order from {req.customer.name}: "
                f"{cat['name']} ×{first_item.quantity}; "
                f"pickup {req.pickup_at}; notes: {req.notes or '(none)'}"
            ),
            pass1_summary=f"Website order pending owner approval. Reason: {reason}.",
        )
        await _push_owner_approval_request(req, approval_id, reason)
        _write_evidence(
            {
                "channel": "website",
                "status": "pending_approval",
                "approval_id": approval_id,
                "request": req.model_dump(),
            },
            key=approval_id,
        )
        return 202, WebsiteOrderPendingApprovalResponse(
            approval_id=approval_id,
            message=(
                f"Got it, {req.customer.name} — your request is with the team. "
                "We'll come back on WhatsApp within the hour."
            ),
        ).model_dump()

    # Direct path — create order + ticket
    order_resp = await mcp_client.call_tool(
        "square_create_order",
        {
            "items": [{"variationId": it.variation_id, "quantity": it.quantity} for it in req.items],
            "source": "website",
            "customerName": req.customer.name,
            "customerNote": (req.notes or "")[:500],
        },
    )
    order = order_resp.get("order", {})
    order_id = order.get("id")
    if not order_id:
        return 502, {"ok": False, "error": "mcp_unavailable", "message": "Order creation returned an unexpected shape."}

    # Build kitchen ticket items using kitchenProductId
    ticket_items = []
    for it in req.items:
        kpid = catalog[it.variation_id].get("kitchenProductId")
        if kpid:
            ticket_items.append({"productId": kpid, "quantity": it.quantity})

    ticket_resp = await mcp_client.call_tool(
        "kitchen_create_ticket",
        {
            "orderId": order_id,
            "customerName": req.customer.name,
            "items": ticket_items,
            "requestedPickupAt": req.pickup_at,
            "notes": (req.notes or f"Website order from {req.customer.phone}")[:500],
        },
    )
    ticket = ticket_resp.get("ticket", {}) or {"id": ticket_resp.get("ticketId")}

    items_echo: list[WebsiteOrderItemEcho] = []
    for line in order.get("items", []):
        items_echo.append(WebsiteOrderItemEcho(
            variation_id=line["variationId"],
            name=line["name"],
            quantity=line["quantity"],
            unit_price_cents=int(line["priceCents"]),
            line_total_cents=int(line["priceCents"]) * int(line["quantity"]),
        ))

    total_cents = int(order.get("totalCents", sum(e.line_total_cents for e in items_echo)))
    estimated_ready_at = ticket.get("estimatedReadyAt", req.pickup_at)

    # Brand-voice on-page confirmation message (templated; rule 6+7 from sales.md)
    summary_line = ", ".join(f"{e.name} ×{e.quantity}" for e in items_echo)
    message = (
        f"Got it, {req.customer.name} — {summary_line} is in the kitchen. "
        f"Total ${total_cents/100:.2f}. Ready by {estimated_ready_at}. "
        f"Pickup at HappyCake Sugar Land. — the HappyCake team"
    )

    response = WebsiteOrderConfirmedResponse(
        order_id=order_id,
        ticket_id=ticket.get("id") or "",
        estimated_ready_at=estimated_ready_at,
        pickup_at=req.pickup_at,
        items=items_echo,
        total_cents=total_cents,
        message=message,
    ).model_dump()

    _write_evidence(
        {
            "channel": "website",
            "status": "confirmed",
            "request": req.model_dump(),
            "order": order,
            "ticket": ticket,
        },
        key=order_id,
    )

    await _push_owner_confirmed(req, order_resp, ticket, total_cents)

    return 200, response
