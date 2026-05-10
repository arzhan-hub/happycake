from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.shared import mcp_client
from src.website.orders import process_order
from src.website.schemas import WebsiteOrderRequest

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


@router.get("/health")
async def health() -> dict:
    return {"ok": True, "channel": "website"}
