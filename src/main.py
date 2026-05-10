from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.config import settings
from src.telegram_bot.runtime import start_bot, stop_bot
from src.whatsapp.router import router as whatsapp_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
# Silence libraries that log secrets in their URLs (Telegram bot tokens).
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("telegram").setLevel(logging.WARNING)
logging.getLogger("telegram.ext").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_bot()
    yield
    await stop_bot()


app = FastAPI(title="HappyCake Wrapper", version="0.2.0", lifespan=lifespan)

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
