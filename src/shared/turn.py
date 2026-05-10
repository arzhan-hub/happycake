"""Orchestration: runs Claude turns, persists evidence, and notifies the owner.

router.py and telegram_bot/handlers.py both call into this so the side
effects (evidence + notifications + approval branching) live in one place.
"""
from __future__ import annotations

import html
import json
import logging
import re
from datetime import datetime, timezone

from src.config import settings
from src.shared import agent, approvals
from src.telegram_bot import notifier
from src.whatsapp.schemas import WhatsAppInbound

logger = logging.getLogger("turn")


# ─── markdown → Telegram-HTML conversion ────────────────────────────────────
# We send messages with parse_mode="HTML" so the agent's markdown actually
# renders. Telegram's HTML supports <b> <i> <u> <s> <code> <pre> <a>
# <blockquote> <tg-spoiler>. Everything else must be html-escaped.

_FENCE_RE = re.compile(r"```(?:[a-zA-Z0-9_-]*)\n?(.*?)```", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")
_BOLD_RE = re.compile(r"\*\*([^*\n]+)\*\*")
_ITALIC_STAR_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
_ITALIC_UNDERSCORE_RE = re.compile(r"(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])")


def to_telegram_html(text: str | None) -> str:
    """Convert agent-emitted markdown to Telegram HTML.

    1. html-escape everything (so customer messages with `<` are safe).
    2. Re-introduce HTML tags for the markdown patterns the agent uses:
       triple-backtick code blocks, single backticks, **bold**, *italic*,
       _italic_, and `>` blockquotes.
    """
    if not text:
        return ""
    out = html.escape(text, quote=False)

    out = _FENCE_RE.sub(lambda m: f"<pre>{m.group(1).rstrip()}</pre>", out)
    out = _INLINE_CODE_RE.sub(r"<code>\1</code>", out)
    out = _BOLD_RE.sub(r"<b>\1</b>", out)
    out = _ITALIC_STAR_RE.sub(r"<i>\1</i>", out)
    out = _ITALIC_UNDERSCORE_RE.sub(r"<i>\1</i>", out)

    # Group consecutive `> ` lines into a single <blockquote>...</blockquote>.
    # We escaped earlier, so ">" is "&gt;".
    lines = out.split("\n")
    rendered: list[str] = []
    bq: list[str] = []

    def flush_bq() -> None:
        if bq:
            rendered.append("<blockquote>" + "\n".join(bq) + "</blockquote>")
            bq.clear()

    for line in lines:
        if line.startswith("&gt; "):
            bq.append(line[5:])
        elif line.strip() == "&gt;":
            bq.append("")
        else:
            flush_bq()
            rendered.append(line)
    flush_bq()
    return "\n".join(rendered)


def _esc(text: str | None) -> str:
    """HTML-escape user-provided strings (phone, customer message)."""
    if not text:
        return ""
    return html.escape(text, quote=False)


# ─── message formatters ─────────────────────────────────────────────────────


def _format_meta_line(result: dict) -> str | None:
    bits = []
    if result.get("num_turns") is not None:
        bits.append(f"{result['num_turns']} turns")
    if result.get("duration_ms") is not None:
        bits.append(f"{result['duration_ms']/1000:.1f}s")
    return f"<i>({' · '.join(bits)})</i>" if bits else None


def _format_pass1_message(ib: WhatsAppInbound, result: dict) -> str:
    is_error = result.get("is_error", False)
    err = result.get("error")
    summary_html = to_telegram_html((result.get("result") or "").strip()) or "<i>(no summary)</i>"
    head = "🛑 <b>Agent error</b>" if is_error else "✅ <b>Customer turn handled</b>"
    lines = [
        head,
        "",
        f"📞 <b>From:</b> <code>{_esc(ib.sender)}</code>",
        f"💬 <b>Inbound:</b> {_esc(ib.message)}",
        "",
        "🤖 <b>Agent:</b>",
        summary_html[:3000],
    ]
    if is_error and err:
        lines.append("")
        lines.append(f"⚠️ <b>Error:</b> <code>{_esc(err)}</code>")
    meta = _format_meta_line(result)
    if meta:
        lines.append("")
        lines.append(meta)
    lines.append(f"📁 <i>evidence: turns/{_esc(ib.sender.lstrip('+'))}/{_esc(ib.message_id)}.json</i>")
    return "\n".join(lines)


def _format_approval_request(ib: WhatsAppInbound, summary: str) -> str:
    """Build the Telegram message for an approval prompt.

    The agent's summary contains:
      <preamble sentence>
      APPROVAL_NEEDED
      <Decision brief block>
      Reply sent to customer:
      ...
    We drop the preamble and render the rest as HTML.
    """
    body = summary
    marker = approvals.APPROVAL_MARKER
    if marker in body:
        body = body.split(marker, 1)[1].lstrip()
    body_html = to_telegram_html(body)
    return (
        "⏳ <b>Approval needed — custom-work request</b>\n"
        "\n"
        f"📞 <b>From:</b> <code>{_esc(ib.sender)}</code>\n"
        f"⬇️💬 <b>Inbound:</b> {_esc(ib.message)}\n"
        "\n"
        f"{body_html[:3500]}"
    )


def _format_pass2_message(approval: dict, result: dict) -> str:
    is_error = result.get("is_error", False)
    summary_html = to_telegram_html((result.get("result") or "").strip()) or "<i>(no summary)</i>"
    decision = approval.get("status", "?").upper()
    if is_error:
        head = "🛑 <b>Pass 2 error</b>"
    else:
        head = f"✅ <b>Pass 2 finished — owner decision: {_esc(decision)}</b>"
    lines = [
        head,
        "",
        f"📞 <b>Customer:</b> <code>{_esc(approval['phone'])}</code>",
        "",
        "🤖 <b>Outcome:</b>",
        summary_html[:3500],
    ]
    meta = _format_meta_line(result)
    if meta:
        lines.append("")
        lines.append(meta)
    return "\n".join(lines)


def _write_evidence(*, kind: str, key: str, payload: dict) -> str:
    out_dir = settings.EVIDENCE_DIR / kind
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{key}.json"
    out_file.write_text(json.dumps(payload, indent=2, default=str))
    return str(out_file)


# ─── orchestration ──────────────────────────────────────────────────────────


async def run_inbound_turn(ib: WhatsAppInbound) -> None:
    """Pass 1: run the sales agent for one fresh inbound."""
    started = datetime.now(timezone.utc).isoformat()
    try:
        result = await agent.process_whatsapp_inbound(ib)
    except Exception as exc:
        logger.exception("pass1 crashed for %s", ib.message_id)
        result = {"is_error": True, "error": f"crash: {exc!r}"}

    out_path = _write_evidence(
        kind=f"turns/{ib.sender.lstrip('+')}",
        key=ib.message_id,
        payload={
            "started": started,
            "finished": datetime.now(timezone.utc).isoformat(),
            "inbound": ib.model_dump(),
            "result": result,
        },
    )
    logger.info("pass1 evidence -> %s", out_path)

    summary = (result.get("result") or "").strip()

    if not result.get("is_error") and approvals.detect_marker(summary):
        approvals.record_pending(
            approval_id=ib.message_id,
            phone=ib.sender,
            inbound_message=ib.message,
            pass1_summary=summary,
        )
        try:
            await notifier.notify_with_approval_buttons(
                _format_approval_request(ib, summary),
                approval_id=ib.message_id,
            )
        except Exception:
            logger.warning("approval push failed", exc_info=True)
        return

    try:
        await notifier.notify_owner(_format_pass1_message(ib, result))
    except Exception:
        logger.warning("telegram push failed", exc_info=True)


async def run_owner_chat_turn(text: str) -> dict:
    """Owner-chat: caller (bot handler) manages the placeholder message UX.

    Returns the raw claude result so the handler can edit-in the answer.
    Persists evidence to evidence/owner_chat/<ts>.json.
    """
    started = datetime.now(timezone.utc).isoformat()
    try:
        result = await agent.process_owner_message(text)
    except Exception as exc:
        logger.exception("owner chat crashed")
        result = {"is_error": True, "error": f"crash: {exc!r}"}

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    out_path = _write_evidence(
        kind="owner_chat",
        key=ts,
        payload={
            "started": started,
            "finished": datetime.now(timezone.utc).isoformat(),
            "asked": text,
            "result": result,
        },
    )
    logger.info("owner-chat evidence -> %s", out_path)
    return result


async def run_approval_turn(approval: dict) -> None:
    """Pass 2: run agent again after the owner has decided."""
    started = datetime.now(timezone.utc).isoformat()
    try:
        result = await agent.process_approval_decision(approval)
    except Exception as exc:
        logger.exception("pass2 crashed for %s", approval["id"])
        result = {"is_error": True, "error": f"crash: {exc!r}"}

    out_path = _write_evidence(
        kind=f"approvals_pass2/{approval['phone'].lstrip('+')}",
        key=approval["id"],
        payload={
            "started": started,
            "finished": datetime.now(timezone.utc).isoformat(),
            "approval": approval,
            "result": result,
        },
    )
    logger.info("pass2 evidence -> %s", out_path)

    try:
        await notifier.notify_owner(_format_pass2_message(approval, result))
    except Exception:
        logger.warning("pass2 telegram push failed", exc_info=True)
