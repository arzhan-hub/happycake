from __future__ import annotations

import logging
from typing import Optional

from telegram.ext import Application, CallbackQueryHandler, CommandHandler

from src.config import settings
from src.telegram_bot.app_state import get_app, set_app
from src.telegram_bot.handlers import approval_callback, cmd_start, cmd_status

logger = logging.getLogger("telegram_bot")


async def start_bot() -> Optional[Application]:
    token = settings.TELEGRAM_SALES_BOT_TOKEN.strip()
    if not token:
        logger.info("TELEGRAM_SALES_BOT_TOKEN not set — telegram bot disabled")
        return None

    application = Application.builder().token(token).build()
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("status", cmd_status))
    application.add_handler(CallbackQueryHandler(approval_callback, pattern=r"^apv:"))

    await application.initialize()
    await application.start()
    await application.updater.start_polling(drop_pending_updates=True)

    set_app(application)
    me = await application.bot.get_me()
    logger.info("telegram bot live as @%s", me.username)
    return application


async def stop_bot() -> None:
    app = get_app()
    if app is None:
        return
    try:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
    except Exception as exc:
        logger.warning("error stopping bot: %s", exc)
    finally:
        set_app(None)
