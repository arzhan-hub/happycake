# HappyCake — AI-Assisted Sales & Operations

Hackathon submission for [Steppe Business Club / HappyCake US](./HACKATHON_BRIEF.md).

## What this is

A locally-hosted Python wrapper that bridges the hackathon's simulated
WhatsApp / Instagram channels to Claude Code (headless) and back, using the
hosted HappyCake MCP server as the source of truth for catalog, kitchen,
orders, and customer threads.

Owner-facing UI is Telegram. Customer-facing storefront is a Next.js site
served separately (under `website/`, scaffolded later).

See:
- [`HACKATHON_BRIEF.md`](./HACKATHON_BRIEF.md) — the brief
- [`Brandbook.md`](./Brandbook.md) — voice, rules, agent operating constraints
- [`MCP_DRY_RUN.md`](./MCP_DRY_RUN.md) — recorded validation of the
  WhatsApp → Order → Kitchen ticket entity chain

## Architecture at a glance

```
       demo / evaluator                    REAL CHANNELS (future)
         driver script                     (Meta, Square — forbidden in §4)
              │                                       │
              ├──► hosted HappyCake MCP ◄─────────────┘
              │     (sim state: threads, orders, tickets, world)
              │
              └──► local FastAPI wrapper ──► claude -p (Opus 4.7) ──► MCP tools
                       │                          │                       │
                       ▼                          ▼                       ▼
                  evidence/                  thread context           replies via
                  per-turn JSON              + brand prompt           whatsapp_send
```

**How inbounds flow.** A call to `whatsapp_inject_inbound` (or `instagram_inject_dm`)
on the hosted MCP forwards a Meta-shaped envelope to whatever URL we registered
via `whatsapp_register_webhook` / `instagram_register_webhook` (header:
`x-sbc-hackathon-source: mcp-forward`). The wrapper's `/webhooks/whatsapp` and
`/webhooks/instagram` routers validate the envelope, write a copy to
`evidence/webhooks/<channel>/`, and hand off to the agent. So the demo path
needs the cloudflare tunnel up and the webhook registered with the **full path**
(see *Manual smoke test* below). `scripts/demo_inbound.py` is a thin wrapper
that just calls the inject tool — the simulator does the forwarding.

## Setup from a fresh clone

```bash
# 1. Python venv + deps
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. MCP config (production is gitignored)
cp .mcp.example.json .mcp.json
# Edit .mcp.json: replace ${SBC_TOKEN} with your team's token from Steppe BC.

# 3. Environment
cp .env.example .env
# Edit .env: at minimum set TELEGRAM_SALES_BOT_TOKEN if you want owner pushes.
# PUBLIC_WEBHOOK_BASE_URL is filled in step 4 once the tunnel is up.

# 4. Run the wrapper
.venv/bin/uvicorn src.main:app --reload --port 8080

# 5. Public tunnel (required — the simulator forwards inbounds here)
brew install cloudflared
cloudflared tunnel --url http://localhost:8080 --no-autoupdate
# Copy the printed https://*.trycloudflare.com URL into .env as PUBLIC_WEBHOOK_BASE_URL,
# then register it with the simulator (full path matters):
#   mcp__happycake__whatsapp_register_webhook  url=https://<sub>.trycloudflare.com/webhooks/whatsapp
#   mcp__happycake__instagram_register_webhook url=https://<sub>.trycloudflare.com/webhooks/instagram

# 6. Drive a fake customer turn (in another terminal)
.venv/bin/python scripts/demo_inbound.py \
  --from +12679883724 \
  --message "Hi, do you have a whole honey cake today?"
```

Visit `http://localhost:8080/` for a list of endpoints.

⚠️ Cloudflare quick-tunnel URLs rotate on every `cloudflared` restart —
re-export `PUBLIC_WEBHOOK_BASE_URL` and re-call the `*_register_webhook` tools
when you reconnect.

## Telegram owner bot

The wrapper pushes every customer turn (and approval requests) to one
Telegram chat — the "owner". One bot = one chat.

### One-time setup

1. **Create the bot** with [@BotFather](https://t.me/BotFather): `/newbot`,
   pick a name + username (e.g. `happycake_owner_bot`). BotFather replies
   with a token like `8614103577:AAEm…`.
2. **Put the token in `.env`**:
   ```bash
   TELEGRAM_SALES_BOT_TOKEN=8614103577:AAEm…
   ```
   Restart the wrapper so it reloads `.env`.
3. **Capture your chat_id** by sending `/start` to your bot in the Telegram
   app. The `cmd_start` handler (`src/telegram_bot/handlers.py:20`) writes
   it to `state/owner_chat_id.txt`.
   - Alternative: set `TELEGRAM_OWNER_CHAT_ID=<id>` in `.env` directly.
   - Find your numeric id by messaging [@userinfobot](https://t.me/userinfobot).

`load_owner_chat_id()` prefers the captured file, then falls back to the
env var. If neither is set, `notify_owner` returns silently — the agent
runs fine but Telegram pushes are skipped (`"send: no owner chat_id
captured yet, skip"` at DEBUG).

### What the bot can do

| Trigger | Effect |
|---|---|
| `/start` (first time) | Registers the chat as owner. |
| `/status` | Pulls a sandbox-state snapshot from the MCP `evaluator_get_evidence_summary` tool. |
| `/post <brief>` | Drafts an Instagram caption from the brief, schedules (or publishes) it via `instagram_schedule_post` / `instagram_publish_post`, and replies in chat with the verbatim caption. Example: `/post Mother's Day weekend — push pre-orders for the whole honey cake`. |
| Free-text message | Routed to the **owner-assistant** agent (read-only MCP tools, see `OWNER_ALLOWED_TOOLS` in `claude_runner.py`). |
| Inbound WhatsApp turn lands | Wrapper formats the customer turn + agent reply and pushes via `notify_owner`. |
| Inbound Instagram DM lands | Wrapper formats the IG turn + agent reply and pushes a *"📸 Instagram DM handled"* card. |
| WhatsApp custom-work request | Wrapper detects `APPROVAL_NEEDED`, pushes the brief with inline **✅ Approve / ❌ Reject** buttons, and runs pass-2 on tap. |
| Instagram custom-work request | Wrapper pushes the brief as an FYI (auto pass-2 reserved — owner follows up out-of-band). |
| On-site chat escalation | When the chat agent emits `ESCALATE_TO_OWNER:<type>` (custom_order / complaint / order_problem), the wrapper pushes a brief to Telegram for the owner to follow up. |

### Verify it's wired

```bash
# 1. Chat captured?
cat state/owner_chat_id.txt        # → numeric chat_id

# 2. Bot process up?
ps aux | grep uvicorn | grep -v grep

# 3. Trigger a turn and watch Telegram for the "✅ Customer turn handled" card.
```

## Manual smoke test (no demo driver)

Useful when debugging the inbound → wrapper → agent → Telegram pipeline by
hand. Assumes the wrapper is running on `localhost:8080`.

### a. Health checks

```bash
curl -s http://localhost:8080/health                    # wrapper alive?
curl -s http://localhost:8080/webhooks/whatsapp/health  # whatsapp router up?
curl -s http://localhost:8080/webhooks/instagram/health # instagram router up?
curl -s http://localhost:8080/api/health                # storefront API up?
```

### b. Verify the public tunnel

```bash
# tunnel must reach our local /webhooks/whatsapp/health
curl -s https://<your-subdomain>.trycloudflare.com/webhooks/whatsapp/health
# → {"ok":true,"channel":"whatsapp"}
```

### c. Register the webhook(s) with the simulator

The MCP forwards inbounds to **exactly the URL you register** — including
the path. Always include the channel-specific path:

```text
mcp__happycake__whatsapp_register_webhook
  url = https://<your-subdomain>.trycloudflare.com/webhooks/whatsapp

mcp__happycake__instagram_register_webhook
  url = https://<your-subdomain>.trycloudflare.com/webhooks/instagram
```

(Registering only the host returned `webhook forward failed: undefined`
because POST `/` returns 405 Method Not Allowed — see incident note in
section *"Bare-host webhook bug"*.)

### d. Inject an inbound and watch evidence land

**WhatsApp:**
```bash
# Snapshot before
ls evidence/webhooks/whatsapp/ | wc -l
ls evidence/turns/12679883724/ 2>/dev/null | wc -l

# Inject via MCP tool whatsapp_inject_inbound:
#   from    = +12679883724
#   message = "Hi! How much is a pistachio roll?"
# Expected response: "forwarded to webhook (status 200)".

# Watch the turn evidence (pass-1 takes ~20–30s):
until [ "$(ls evidence/turns/12679883724/ 2>/dev/null | wc -l)" -gt 0 ]; do sleep 2; done
LATEST=$(ls -t evidence/turns/12679883724/*.json | head -1)
python3 -c "import json; d=json.load(open('$LATEST'))['result']; \
  print('is_error:', d.get('is_error'), '· turns:', d.get('num_turns'), \
        '· dur_s:', round((d.get('duration_ms') or 0)/1000, 1)); \
  print('---'); print(d.get('result'))"
```

**Instagram DM:**
```bash
# Inject via MCP tool instagram_inject_dm:
#   from     = igtest_maria
#   threadId = ig_thread_001
#   message  = "Hi! How much is a whole honey cake?"

# Watch the IG turn evidence:
until [ -d evidence/turns/instagram/igtest_maria ] \
   && [ "$(ls evidence/turns/instagram/igtest_maria 2>/dev/null | wc -l)" -gt 0 ]; do
  sleep 2
done
LATEST=$(ls -t evidence/turns/instagram/igtest_maria/*.json | head -1)
python3 -c "import json; d=json.load(open('$LATEST'))['result']; \
  print('is_error:', d.get('is_error'), '· turns:', d.get('num_turns')); \
  print(d.get('result'))"
```

If `is_error: false` and `state/owner_chat_id.txt` is set, both channels
push their own card to Telegram — WhatsApp shows *"✅ Customer turn
handled"*, IG shows *"📸 Instagram DM handled"*.

### d2. On-site assistant (Saule) test script

Hits `POST /api/chat` with five canonical scenarios required by the
hackathon submission spec — consultation, custom order, complaint, status
lookup, general question. Asserts the right `escalation_type` (or
absence) and that replies cite catalog facts.

```bash
.venv/bin/python scripts/test_chat.py                       # all five
.venv/bin/python scripts/test_chat.py --only complaint      # one path
.venv/bin/python scripts/test_chat.py --base-url https://<tunnel>
```

Exit code is non-zero on any failure. Each scenario prints PASS/FAIL with
the agent's reply and the captured `escalated` / `escalation_type` /
`num_turns` / `duration_s` fields.

### e. Bare-host webhook bug (incident note)

Symptom: `whatsapp_inject_inbound` reports `webhook forward failed:
undefined`, no entry under `evidence/webhooks/whatsapp/`, no turn evidence.
Cause: webhook registered as the host only (`https://…trycloudflare.com`)
without `/webhooks/whatsapp`. POST to `/` returns 405. Fix: re-register with
the full path.

## Project layout

```
.
├── .mcp.example.json        # safe-to-commit template
├── .mcp.json                # gitignored — your real token lives here
├── .env.example
├── HACKATHON_BRIEF.md       # task spec
├── Brandbook.md             # voice + agent rules
├── metadata.json            # asset pack metadata
├── MCP_DRY_RUN.md           # validated entity-creation chain + webhook finding
├── requirements.txt
├── src/
│   ├── main.py              # FastAPI app
│   ├── config.py            # pydantic-settings, .env loader
│   ├── shared/
│   │   └── raw_log.py       # writes evidence/webhooks/<channel>/<ts>.json
│   └── whatsapp/
│       ├── router.py        # POST /webhooks/whatsapp
│       └── schemas.py       # WhatsAppInbound { from, message }
├── scripts/
│   └── demo_inbound.py      # dual-fanout driver: MCP + wrapper
├── agent/
│   └── system_prompts/      # sales.md, kitchen.md, marketing.md (TBD)
├── state/                   # gitignored — flat-JSON thread store
└── evidence/                # gitignored — per-turn audit log
    └── webhooks/whatsapp/   # raw inbound payload captures
```

## Demo driver — `scripts/demo_inbound.py`

Fans one inbound to both the MCP simulator and the local wrapper:

```bash
# Both sides (default)
.venv/bin/python scripts/demo_inbound.py --from +12679883724 --message "..."

# Wrapper only (skip simulator state update)
.venv/bin/python scripts/demo_inbound.py --from +12679883724 --message "..." --no-mcp

# MCP only (skip our wrapper — useful for one-off state seeding)
.venv/bin/python scripts/demo_inbound.py --from +12679883724 --message "..." --no-wrapper
```

The MCP fanout uses JSON-RPC `tools/call` against the streaming-HTTP MCP
endpoint, sending the same `{from, message}` shape that
`whatsapp_inject_inbound` accepts. The wrapper fanout uses the same shape
against `POST /webhooks/whatsapp` — chosen deliberately so that *if* the
simulator ever starts forwarding real webhooks, our schema already matches.

## Build status

**Plumbing**
- [x] MCP entity chain validated end-to-end (`MCP_DRY_RUN.md`)
- [x] FastAPI wrapper + WhatsApp + Instagram + storefront webhook routers
- [x] Cloudflare tunnel + simulator-forward path working end-to-end
- [x] Demo driver `scripts/demo_inbound.py` (calls `whatsapp_inject_inbound`)
- [x] `claude -p` subprocess runner with per-agent allowed-tools lists
      (`src/shared/claude_runner.py`)
- [x] Thread store + per-turn evidence logger (`evidence/turns/...`,
      `evidence/webhooks/...`, `evidence/website_orders/...`)

**Agents**
- [x] WhatsApp sales agent — `agent/system_prompts/sales.md` (brand rules,
      10-step tool chain incl. inventory check, capacity-aware accept/reject,
      Pass-1 + Pass-2 approval flow)
- [x] Instagram DM agent — `agent/system_prompts/instagram_dm.md`
- [x] Instagram post drafter — `agent/system_prompts/instagram_post.md`
      (owner-triggered via `/post` in Telegram)
- [x] On-site chat assistant "Saule" — `agent/system_prompts/onsite_chat.md`
      with 5-scenario test script `scripts/test_chat.py`
- [x] Owner assistant — `agent/system_prompts/owner_assistant.md`
      (free-text Q&A in Telegram)

**Surfaces**
- [x] Next.js storefront with `/api/orders` validation pipeline
      (`src/website/orders.py`: catalog/constraints/capacity, decoration-keyword
      gate, approval branch)
- [x] Telegram owner bot — turn pushes, approval buttons, `/status`, `/post`
      (`src/telegram_bot/`)
- [x] Marketing loop scaffolding — `marketing/plan.md`,
      `marketing/run-loop.mjs`, `marketing/mcp-client.mjs`

**Verification**
- [x] End-to-end happy path: inbound → forward → wrapper → claude → MCP write
      tools → reply → evidence (verified this session, e.g.
      `evidence/turns/12679883725/wamid.1778422605.a0i4u9.json`)
- [x] On-site chat test script passing all 5 scenarios
      (consultation / custom_order / complaint / status / general_question)