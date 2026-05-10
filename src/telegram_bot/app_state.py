"""Singleton storage for the running telegram Application.

Lives in its own module to break import cycles between runtime.py (which
builds the Application + imports handlers) and notifier.py (called from
turn.py, which is imported by handlers).
"""
from __future__ import annotations

from typing import Optional

from telegram.ext import Application


_app: Optional[Application] = None


def set_app(app: Optional[Application]) -> None:
    global _app
    _app = app


def get_app() -> Optional[Application]:
    return _app
