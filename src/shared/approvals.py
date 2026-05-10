from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from src.config import settings


APPROVALS_DIR = settings.STATE_DIR / "approvals"
APPROVALS_DIR.mkdir(parents=True, exist_ok=True)

APPROVAL_MARKER = "APPROVAL_NEEDED"  # the literal substring we look for in agent summaries


def _path(approval_id: str) -> Path:
    safe = approval_id.replace("/", "_").replace(":", "_")
    return APPROVALS_DIR / f"{safe}.json"


def record_pending(*, approval_id: str, phone: str, inbound_message: str, pass1_summary: str) -> dict:
    state = {
        "id": approval_id,
        "phone": phone,
        "inbound_message": inbound_message,
        "pass1_summary": pass1_summary,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "decided_at": None,
    }
    _path(approval_id).write_text(json.dumps(state, indent=2))
    return state


def update_status(approval_id: str, status: str) -> dict | None:
    p = _path(approval_id)
    if not p.exists():
        return None
    state = json.loads(p.read_text())
    state["status"] = status
    state["decided_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(state, indent=2))
    return state


def get(approval_id: str) -> dict | None:
    p = _path(approval_id)
    if not p.exists():
        return None
    return json.loads(p.read_text())


def detect_marker(text: str | None) -> bool:
    if not text:
        return False
    return APPROVAL_MARKER in text
