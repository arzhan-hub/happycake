from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WhatsAppInbound(BaseModel):
    """Mirrors the MCP `whatsapp_inject_inbound` input shape.

    If the simulator ever starts forwarding inbound events to our registered
    webhook, the payload should match this contract — minimizing schema churn.
    """

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    sender: str = Field(alias="from", description="E.164 phone number")
    message: str
