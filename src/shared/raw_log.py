from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from src.config import settings


def log_raw_webhook(channel: str, payload: dict, headers: dict | None = None) -> Path:
    """Append-only log of every raw webhook payload, for shape discovery + audit."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    out_dir = settings.EVIDENCE_DIR / "webhooks" / channel
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{ts}.json"
    out_file.write_text(
        json.dumps(
            {
                "ts": ts,
                "channel": channel,
                "headers": headers or {},
                "payload": payload,
            },
            indent=2,
            default=str,
        )
    )
    return out_file
