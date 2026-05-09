from __future__ import annotations

import logging

from fastapi import FastAPI

from src.config import settings
from src.whatsapp.router import router as whatsapp_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


app = FastAPI(title="HappyCake Wrapper", version="0.1.0")

app.include_router(whatsapp_router)


@app.get("/")
async def root() -> dict:
    return {
        "service": "happycake-wrapper",
        "version": app.version,
        "public_url": settings.PUBLIC_WEBHOOK_BASE_URL or None,
        "endpoints": [
            "POST /webhooks/whatsapp",
            "GET  /webhooks/whatsapp/health",
        ],
    }


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
