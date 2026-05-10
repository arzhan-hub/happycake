from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WebsiteOrderItem(BaseModel):
    """One line item from the storefront cart."""

    model_config = ConfigDict(populate_by_name=True)

    variation_id: str = Field(alias="variationId", description="Square catalog variationId")
    quantity: int = Field(ge=1, le=20)


class WebsiteCustomer(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=20, description="E.164 preferred, e.g. +12679883724")
    email: str | None = Field(default=None, max_length=200)


class WebsiteOrderRequest(BaseModel):
    items: list[WebsiteOrderItem] = Field(min_length=1, max_length=10)
    customer: WebsiteCustomer
    pickup_at: str = Field(description="ISO 8601 UTC, e.g. 2026-05-12T18:00:00Z")
    notes: str | None = Field(default=None, max_length=1000)


class WebsiteOrderItemEcho(BaseModel):
    variation_id: str
    name: str
    quantity: int
    unit_price_cents: int
    line_total_cents: int


class WebsiteOrderConfirmedResponse(BaseModel):
    ok: Literal[True] = True
    status: Literal["confirmed"] = "confirmed"
    order_id: str
    ticket_id: str
    estimated_ready_at: str
    pickup_at: str
    items: list[WebsiteOrderItemEcho]
    total_cents: int
    message: str


class WebsiteOrderPendingApprovalResponse(BaseModel):
    ok: Literal[True] = True
    status: Literal["pending_approval"] = "pending_approval"
    approval_id: str
    message: str


class WebsiteOrderErrorResponse(BaseModel):
    ok: Literal[False] = False
    error: Literal[
        "lead_time_too_short",
        "capacity_full",
        "unknown_variation",
        "invalid_pickup_at",
        "mcp_unavailable",
    ]
    message: str
    earliest_pickup_at: str | None = None
