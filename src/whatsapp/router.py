from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from src.shared.raw_log import log_raw_webhook
from src.whatsapp.schemas import WhatsAppInbound

logger = logging.getLogger("whatsapp")

router = APIRouter(prefix="/webhooks/whatsapp", tags=["whatsapp"])


@router.post("")
async def whatsapp_webhook(request: Request) -> dict:
    """Receive an inbound WhatsApp customer message.

    Accepts the same `{ "from": "+E164", "message": "..." }` shape as the MCP
    `whatsapp_inject_inbound` tool. We log the raw payload + headers as
    evidence first, then validate, so we never lose data even on schema drift.
    """
    headers = {k: v for k, v in request.headers.items()}
    try:
        payload = await request.json()
    except Exception:
        body = await request.body()
        log_raw_webhook("whatsapp", {"_raw": body.decode("utf-8", errors="replace")}, headers)
        raise HTTPException(status_code=400, detail="invalid json")

    raw_path = log_raw_webhook("whatsapp", payload, headers)

    try:
        event = WhatsAppInbound.model_validate(payload)
    except Exception as exc:
        logger.warning("whatsapp payload failed validation: %s", exc)
        return {"ok": False, "error": "validation_failed", "captured": raw_path.name}

    logger.info("whatsapp inbound from=%s len=%d", event.sender, len(event.message))

    # TODO (task #4): enqueue claude_runner.process_turn(event)

    return {
        "ok": True,
        "captured": raw_path.name,
        "from": event.sender,
        "queued": False,  # flip to True once claude_runner is wired
    }


@router.get("/health")
async def health() -> dict:
    return {"ok": True, "channel": "whatsapp"}
