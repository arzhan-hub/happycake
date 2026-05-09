from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    SBC_TOKEN: str = ""
    PUBLIC_WEBHOOK_BASE_URL: str = ""

    TELEGRAM_SALES_BOT_TOKEN: str = ""
    TELEGRAM_KITCHEN_BOT_TOKEN: str = ""
    TELEGRAM_MARKETING_BOT_TOKEN: str = ""
    TELEGRAM_OWNER_CHAT_ID: str = ""

    CLAUDE_BIN: str = "claude"

    PROJECT_ROOT: Path = PROJECT_ROOT
    STATE_DIR: Path = PROJECT_ROOT / "state"
    EVIDENCE_DIR: Path = PROJECT_ROOT / "evidence"
    AGENT_DIR: Path = PROJECT_ROOT / "agent"
    BRANDBOOK_PATH: Path = PROJECT_ROOT / "Brandbook.md"
    MCP_CONFIG_PATH: Path = PROJECT_ROOT / ".mcp.json"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# Ensure runtime directories exist
for d in (settings.STATE_DIR, settings.EVIDENCE_DIR, settings.STATE_DIR / "threads"):
    d.mkdir(parents=True, exist_ok=True)
