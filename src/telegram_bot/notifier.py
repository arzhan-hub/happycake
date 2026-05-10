from __future__ import annotations

import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError

from src.telegram_bot.app_state import get_app
from src.telegram_bot.owner import load_owner_chat_id

logger = logging.getLogger("telegram_bot")


async def _send(text: str, reply_markup=None) -> bool:
    """Send an HTML-formatted message to the owner.

    Callers (turn.py) are responsible for converting agent markdown to
    Telegram HTML and html-escaping any dynamic content. We send with
    parse_mode="HTML" so <b>, <i>, <code>, <pre>, <blockquote> render.
    """
    app = get_app()
    if app is None:
        logger.debug("send: bot not running, skip")
        return False
    chat_id = load_owner_chat_id()
    if chat_id is None:
        logger.debug("send: no owner chat_id captured yet, skip")
        return False
    try:
        await app.bot.send_message(
            chat_id=chat_id, text=text, parse_mode="HTML", reply_markup=reply_markup
        )
        return True
    except TelegramError as exc:
        logger.warning("send failed (HTML): %s", exc)
        # Fallback: strip tags and resend as plain text so the owner still gets the message.
        plain = _strip_html_tags(text)
        try:
            await app.bot.send_message(chat_id=chat_id, text=plain, reply_markup=reply_markup)
            return True
        except TelegramError as exc2:
            logger.warning("send failed (plain fallback): %s", exc2)
            return False


def _strip_html_tags(text: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", text)


async def notify_owner(text: str) -> bool:
    return await _send(text)


async def notify_with_approval_buttons(text: str, approval_id: str) -> bool:
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"apv:{approval_id}:a"),
            InlineKeyboardButton("❌ Reject", callback_data=f"apv:{approval_id}:r"),
        ]
    ])
    return await _send(text, reply_markup=keyboard)
