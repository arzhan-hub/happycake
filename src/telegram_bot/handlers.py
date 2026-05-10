from __future__ import annotations

import asyncio
import json
import logging

import httpx
from telegram import Update
from telegram.error import TelegramError
from telegram.ext import ContextTypes

from src.config import settings
from src.shared import approvals
from src.shared.turn import (
    run_approval_turn,
    run_instagram_post_turn,
    run_owner_chat_turn,
    to_telegram_html,
)
from src.telegram_bot.owner import load_owner_chat_id, save_owner_chat_id

logger = logging.getLogger("telegram_bot")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    user = update.effective_user
    save_owner_chat_id(chat_id)
    name = user.first_name if user else "friend"
    await update.message.reply_text(
        f"Hi {name} — registered chat {chat_id} as the HappyCake owner.\n\n"
        "I'll forward every customer turn here. Use /status for a quick snapshot.\n\n"
        "— the HappyCake team"
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if chat_id != load_owner_chat_id():
        await update.message.reply_text("Not authorized.")
        return

    summary = await _fetch_evidence_summary()
    if summary is None:
        await update.message.reply_text("Couldn't reach the MCP — check SBC_TOKEN.")
        return

    counts = summary.get("counts", {})
    lines = [
        "*HappyCake — current sandbox state*",
        f"• whatsapp inbound: {counts.get('whatsappInbound', 0)}",
        f"• whatsapp outbound: {counts.get('whatsappOutbound', 0)}  _(simulator counter, see MCP_DRY_RUN.md)_",
        f"• square orders: {counts.get('squareOrders', 0)}",
        f"• kitchen tickets: {counts.get('kitchenTickets', 0)}",
        f"• marketing campaigns: {counts.get('marketingCampaigns', 0)}",
        f"• gbusiness reviews: {counts.get('gbusinessReviews', 0)}",
        f"• audit calls: {counts.get('auditCalls', 0)}",
    ]
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_post(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """`/post <brief>` — owner-triggered IG post drafter & scheduler.

    The agent has access to catalog/constraints/margin (read) and
    instagram_schedule_post / instagram_publish_post (write). It will
    schedule by default; if the brief explicitly says "publish now" the
    agent calls publish.
    """
    chat_id = update.effective_chat.id
    if chat_id != load_owner_chat_id():
        await update.message.reply_text("Not authorized.")
        return

    brief = " ".join(context.args or []).strip()
    if not brief:
        await update.message.reply_text(
            "Usage: <code>/post &lt;brief&gt;</code>\n\n"
            "Example: <code>/post Mother's Day weekend — push pre-orders for the whole honey cake</code>",
            parse_mode="HTML",
        )
        return

    placeholder = await update.message.reply_text("📸 Drafting IG post…")
    try:
        result = await run_instagram_post_turn(brief)
    except Exception as exc:
        await placeholder.edit_text(f"⚠️ Crashed: {exc!r}")
        return

    if result.get("is_error"):
        await placeholder.edit_text(
            f"⚠️ Couldn't draft — {result.get('error', 'unknown error')}"
        )
        return

    body = (result.get("result") or "").strip() or "(no draft)"
    body_html = to_telegram_html(body)

    meta_bits = []
    if result.get("num_turns") is not None:
        meta_bits.append(f"{result['num_turns']} turns")
    if result.get("duration_ms") is not None:
        meta_bits.append(f"{result['duration_ms']/1000:.1f}s")
    meta = f"\n\n<i>({' · '.join(meta_bits)})</i>" if meta_bits else ""

    final = (body_html + meta)[:4000]
    try:
        await placeholder.edit_text(final, parse_mode="HTML")
    except TelegramError:
        try:
            await placeholder.edit_text(
                body + ("\n\n" + " · ".join(meta_bits) if meta_bits else "")
            )
        except TelegramError as exc:
            logger.warning("/post reply failed: %s", exc)


async def owner_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Free-text from the owner chat → claude -p (owner assistant) → answer.

    Implements brief §5: 'Telegram bots invoke `claude -p` ... and stream the
    answer back into Telegram.' We send a 'Thinking…' placeholder, run the
    agent, then edit the placeholder with the final answer.
    """
    chat_id = update.effective_chat.id
    if chat_id != load_owner_chat_id():
        return  # silent — only the owner gets agent answers

    msg = (update.message.text or "").strip()
    if not msg:
        return

    placeholder = await update.message.reply_text("🤔 Thinking…")
    try:
        result = await run_owner_chat_turn(msg)
    except Exception as exc:
        await placeholder.edit_text(f"⚠️ Crashed: {exc!r}")
        return

    if result.get("is_error"):
        await placeholder.edit_text(
            f"⚠️ Couldn't answer — {result.get('error', 'unknown error')}"
        )
        return

    answer = (result.get("result") or "").strip() or "(no answer)"
    answer_html = to_telegram_html(answer)

    meta_bits = []
    if result.get("num_turns") is not None:
        meta_bits.append(f"{result['num_turns']} turns")
    if result.get("duration_ms") is not None:
        meta_bits.append(f"{result['duration_ms']/1000:.1f}s")
    meta = f"\n\n<i>({' · '.join(meta_bits)})</i>" if meta_bits else ""

    final = (answer_html + meta)[:4000]  # Telegram message limit ~4096
    try:
        await placeholder.edit_text(final, parse_mode="HTML")
    except TelegramError:
        try:
            await placeholder.edit_text(answer + ("\n\n" + " · ".join(meta_bits) if meta_bits else ""))
        except TelegramError as exc:
            logger.warning("owner-chat reply failed: %s", exc)


async def approval_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for [Approve] / [Reject] inline button taps."""
    query = update.callback_query
    chat_id = update.effective_chat.id
    if chat_id != load_owner_chat_id():
        await query.answer("Not authorized.", show_alert=True)
        return

    data = (query.data or "").split(":")
    if len(data) != 3 or data[0] != "apv":
        await query.answer("Invalid action.", show_alert=True)
        return
    _, approval_id, decision_short = data
    decision = "approved" if decision_short == "a" else "rejected"

    state = approvals.get(approval_id)
    if state is None:
        await query.answer("Approval not found.", show_alert=True)
        return
    if state.get("status") != "pending":
        await query.answer(f"Already {state['status']}.", show_alert=True)
        return

    state = approvals.update_status(approval_id, decision)
    await query.answer(f"Marked {decision}. Pass 2 starting.")

    new_text = (query.message.text or "") + f"\n\nDecision: {decision}"
    try:
        await query.edit_message_text(new_text)
    except TelegramError:
        pass

    asyncio.create_task(run_approval_turn(state))


async def _fetch_evidence_summary() -> dict | None:
    mcp_path = settings.MCP_CONFIG_PATH
    if not mcp_path.exists():
        return None
    cfg = json.loads(mcp_path.read_text())["mcpServers"]["happycake"]
    headers = {
        **cfg.get("headers", {}),
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "evaluator_get_evidence_summary", "arguments": {}},
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(cfg["url"], headers=headers, json=body)
        if r.status_code != 200:
            return None
        result = r.json().get("result", {})
        for item in result.get("content", []):
            if item.get("type") == "text":
                try:
                    return json.loads(item["text"])
                except json.JSONDecodeError:
                    continue
        return None
    except Exception as exc:
        logger.warning("evidence summary fetch failed: %s", exc)
        return None
