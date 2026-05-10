from __future__ import annotations

from typing import Iterator

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# Canonical internal model — what the rest of our pipeline consumes
# ─────────────────────────────────────────────────────────────────────────────


class WhatsAppInbound(BaseModel):
    """One textual inbound WhatsApp message, normalized for our pipeline."""

    sender: str  # E.164, e.g. +12679883724
    message: str
    message_id: str
    timestamp: int  # unix seconds


# ─────────────────────────────────────────────────────────────────────────────
# Meta WhatsApp Business API webhook envelope
# (the shape the hackathon MCP simulator forwards to our /webhooks/whatsapp)
# https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
# ─────────────────────────────────────────────────────────────────────────────


class MetaText(BaseModel):
    body: str


class MetaMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    sender: str = Field(alias="from")
    id: str
    timestamp: str
    type: str
    text: MetaText | None = None


class MetaMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    phone_number_id: str


class MetaValue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    messaging_product: str
    metadata: MetaMetadata
    messages: list[MetaMessage] = []


class MetaChange(BaseModel):
    model_config = ConfigDict(extra="ignore")
    field: str
    value: MetaValue


class MetaEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    changes: list[MetaChange]


class MetaWhatsAppWebhook(BaseModel):
    model_config = ConfigDict(extra="ignore")
    object: str
    entry: list[MetaEntry]

    def iter_inbounds(self) -> Iterator[WhatsAppInbound]:
        """Walk the envelope and yield canonical inbound text messages.

        Non-text messages (image, audio, location, status updates) are skipped
        for now — we can add handlers per-type as the build progresses.
        """
        for entry in self.entry:
            for change in entry.changes:
                if change.field != "messages":
                    continue
                for msg in change.value.messages:
                    if msg.type != "text" or msg.text is None:
                        continue
                    yield WhatsAppInbound(
                        sender=msg.sender,
                        message=msg.text.body,
                        message_id=msg.id,
                        timestamp=int(msg.timestamp),
                    )
