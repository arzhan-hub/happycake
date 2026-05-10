from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from src.shared.raw_log import log_raw_webhook
from src.shared.turn import run_inbound_turn
from src.whatsapp.schemas import MetaWhatsAppWebhook

logger = logging.getLogger("whatsapp")

router = APIRouter(prefix="/webhooks/whatsapp", tags=["whatsapp"])


@router.post("")
async def whatsapp_webhook(request: Request, background: BackgroundTasks) -> dict:
    """Receive an inbound WhatsApp customer message (Meta Cloud API envelope)."""
    headers = {k: v for k, v in request.headers.items()}
    try:
        payload = await request.json()
    except Exception:
        body = await request.body()
        log_raw_webhook("whatsapp", {"_raw": body.decode("utf-8", errors="replace")}, headers)
        raise HTTPException(status_code=400, detail="invalid json")

    raw_path = log_raw_webhook("whatsapp", payload, headers)

    try:
        envelope = MetaWhatsAppWebhook.model_validate(payload)
    except Exception as exc:
        logger.warning("envelope failed validation: %s", exc)
        return {"ok": False, "error": "envelope_invalid", "captured": raw_path.name}

    inbounds = list(envelope.iter_inbounds())
    for ib in inbounds:
        logger.info("inbound id=%s from=%s len=%d", ib.message_id, ib.sender, len(ib.message))
        background.add_task(run_inbound_turn, ib)

    return {
        "ok": True,
        "captured": raw_path.name,
        "messages_parsed": len(inbounds),
        "queued": len(inbounds),
    }


@router.get("/health")
async def health() -> dict:
    return {"ok": True, "channel": "whatsapp"}
