from __future__ import annotations

from typing import Iterator

from pydantic import BaseModel, ConfigDict, Field


class InstagramInbound(BaseModel):
    """One textual inbound Instagram DM, normalized for our pipeline."""

    sender: str  # IG user id (opaque string from Meta), not E.164
    message: str
    message_id: str
    timestamp: int  # unix seconds


class IGMessageBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mid: str | None = None
    text: str | None = None


class IGUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str


class IGMessagingEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sender: IGUser
    recipient: IGUser | None = None
    timestamp: int | None = None
    message: IGMessageBody | None = None


class IGEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    time: int | None = None
    messaging: list[IGMessagingEvent] = Field(default_factory=list)


class MetaInstagramWebhook(BaseModel):
    """Standard Instagram Messenger Platform webhook envelope.

    https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook
    """

    model_config = ConfigDict(extra="ignore")
    object: str
    entry: list[IGEntry]

    def iter_inbounds(self) -> Iterator[InstagramInbound]:
        for entry in self.entry:
            for ev in entry.messaging:
                if ev.message is None or not ev.message.text:
                    continue
                if not ev.message.mid:
                    continue
                # Meta IG timestamps are milliseconds; normalize to seconds.
                ts_raw = ev.timestamp or entry.time or 0
                ts_seconds = ts_raw // 1000 if ts_raw > 10**12 else ts_raw
                yield InstagramInbound(
                    sender=ev.sender.id,
                    message=ev.message.text,
                    message_id=ev.message.mid,
                    timestamp=int(ts_seconds),
                )
