from __future__ import annotations

from src.config import settings


_OWNER_CHAT_FILE = settings.STATE_DIR / "owner_chat_id.txt"


def save_owner_chat_id(chat_id: int) -> None:
    _OWNER_CHAT_FILE.write_text(str(chat_id))


def load_owner_chat_id() -> int | None:
    """Return the persisted owner chat_id, or fall back to env, or None."""
    if _OWNER_CHAT_FILE.exists():
        raw = _OWNER_CHAT_FILE.read_text().strip()
        if raw:
            try:
                return int(raw)
            except ValueError:
                pass
    if settings.TELEGRAM_OWNER_CHAT_ID:
        try:
            return int(settings.TELEGRAM_OWNER_CHAT_ID)
        except ValueError:
            return None
    return None
