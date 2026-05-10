# HappyCake — Architecture

This document explains how the system is wired: what each process does, how
requests flow, how Claude is orchestrated, what state lives where, and how
the owner stays in the loop.

For the task brief see [`HACKATHON_BRIEF.md`](./HACKATHON_BRIEF.md). For
brand voice and AI-agent operating rules see [`Brandbook.md`](./Brandbook.md).
For the validated WhatsApp → Order → Kitchen Ticket chain see
[`MCP_DRY_RUN.md`](./MCP_DRY_RUN.md). For the storefront contract, see
[`website_prompt.md`](./website_prompt.md).

---

## 1. System overview

```
┌──────────────────┐                                        ┌──────────────────┐
│  WhatsApp        │                                        │  Telegram        │
│  customer        │                                        │  owner           │
└────────┬─────────┘                                        └────────▲─────────┘
         │  inbound DM                                               │  push + buttons
         ▼                                                           │
┌────────────────────┐  Meta Cloud API webhook envelope              │
│ Hosted MCP         │ ───►  Cloudflare tunnel  ───►   ┌─────────────┴───────────┐
│ (HappyCake sim)    │                                  │  HappyCake Wrapper      │
│ • catalog          │ ◄─── JSON-RPC tools/call ─────── │  FastAPI (Python 3.9)   │
│ • kitchen          │                                  │                         │
│ • orders           │                                  │  ┌──────────────────┐   │
│ • whatsapp threads │                                  │  │ src/whatsapp/    │   │
│ • world events     │                                  │  │   POST /webhooks │   │
│ • evaluator        │                                  │  ├──────────────────┤   │
└────────────────────┘                                  │  │ src/website/     │   │
         ▲                                              │  │   POST /api/orders│  │
         │                                              │  │   GET  /api/...   │  │
         │                                              │  ├──────────────────┤   │
         │                                              │  │ src/telegram_bot │   │
         │                                              │  │   long-poll bot  │   │
         │                                              │  ├──────────────────┤   │
         │                                              │  │ src/shared/turn  │   │
         │                                              │  │   orchestration  │   │
         │                                              │  ├──────────────────┤   │
         │                                              │  │ subprocess:      │   │
         │                                              └──┤  claude -p ...   │───┘
                                                            │  (Opus 4.7)      │
                                                            └──────────────────┘
                                                                    ▲
                                                                    │
                                                            ┌───────┴────────┐
                                                            │  Storefront    │
                                                            │  Next.js (other│
                                                            │  device)       │
                                                            │  fetch /api/.. │
                                                            └────────────────┘
```

The wrapper is one Python process (uvicorn). All channels (WhatsApp webhooks,
storefront orders, Telegram owner ops) terminate here. Claude is invoked
out-of-process via the `claude` CLI in headless mode (`claude -p ...`),
which itself talks to the hosted MCP simulator over HTTPS.

---

## 2. Components

### 2.1 Hosted MCP simulator

Hosted at `https://www.steppebusinessclub.com/api/mcp` (HTTP JSON-RPC, auth
via `X-Team-Token`). Provides:

| Domain | Tools |
|---|---|
| Square POS | `square_list_catalog`, `square_get_inventory`, `square_create_order`, `square_recent_orders`, `square_update_order_status`, `square_recent_sales_csv`, `square_get_pos_summary` |
| Kitchen | `kitchen_get_capacity`, `kitchen_get_menu_constraints`, `kitchen_create_ticket`, `kitchen_accept_ticket`, `kitchen_reject_ticket`, `kitchen_mark_ready`, `kitchen_list_tickets`, `kitchen_get_production_summary` |
| WhatsApp | `whatsapp_register_webhook`, `whatsapp_inject_inbound`, `whatsapp_send`, `whatsapp_list_threads` |
| Instagram | `instagram_register_webhook`, `instagram_inject_dm`, `instagram_list_dm_threads`, `instagram_send_dm`, `instagram_reply_to_comment`, `instagram_publish_post`, `instagram_schedule_post`, `instagram_approve_post` |
| Google Business | `gb_list_reviews`, `gb_simulate_post`, `gb_simulate_reply`, `gb_get_metrics`, `gb_list_simulated_actions` |
| Marketing | `marketing_create_campaign`, `marketing_adjust_campaign`, `marketing_get_budget`, `marketing_get_campaign_metrics`, `marketing_get_margin_by_product`, `marketing_get_sales_history`, `marketing_generate_leads`, `marketing_route_lead`, `marketing_launch_simulated_campaign`, `marketing_report_to_owner` |
| World | `world_get_scenarios`, `world_start_scenario`, `world_advance_time`, `world_next_event`, `world_get_timeline`, `world_get_scenario_summary`, `world_inject_event` |
| Evaluator | `evaluator_get_evidence_summary`, `evaluator_score_*` |

Treated as the **source of truth** per brief §6. Counter for `auditCalls` in
`evaluator_get_evidence_summary` is our integration witness.

### 2.2 Wrapper — FastAPI process

One uvicorn process, default port `8080`. Three concerns:

1. **HTTP entrypoints** — webhook receiver for the simulator, REST API for the storefront.
2. **Telegram long-poll bot** — `@happyDaarBot`, started during FastAPI lifespan, runs alongside the API.
3. **Subprocess orchestration** — spawns `claude -p` for AI turns and persists the result.

Critical files:

| File | Role |
|---|---|
| `src/main.py` | FastAPI app; CORS middleware; lifespan starts/stops the Telegram bot |
| `src/config.py` | pydantic-settings; reads `.env`; defines paths for state/, evidence/, agent/ |
| `src/whatsapp/router.py` | `POST /webhooks/whatsapp` — accepts the Meta Cloud API envelope |
| `src/whatsapp/schemas.py` | Pydantic models for the Meta envelope + canonical `WhatsAppInbound` |
| `src/instagram/router.py` | `POST /webhooks/instagram` — accepts the Messenger Platform envelope |
| `src/instagram/schemas.py` | Pydantic models for the IG envelope + canonical `InstagramInbound` |
| `src/website/router.py` | `POST /api/orders`, `GET /api/catalog`, `POST /api/chat`, `GET /api/health` |
| `src/website/schemas.py` | Order request/response schemas |
| `src/website/orders.py` | Catalog/constraints/capacity validation, decoration-keyword gate, write-ops |
| `src/shared/mcp_client.py` | Minimal async JSON-RPC `call_tool(name, args)` against the hosted MCP |
| `src/shared/claude_runner.py` | `run_claude(prompt)` — async subprocess `claude -p ... --output-format json` |
| `src/shared/agent.py` | Loads `agent/system_prompts/{sales,instagram_dm,onsite_chat,owner_assistant}.md`, builds Pass 1 / Pass 2 / chat / IG prompts |
| `src/shared/turn.py` | High-level orchestration: `run_inbound_turn` (WhatsApp), `run_instagram_inbound_turn` (IG), `run_chat_turn` (Saule), `run_owner_chat_turn`, `run_approval_turn` (Pass 2). Branches into approval / escalation flows. |
| `src/shared/approvals.py` | Flat-JSON state for pending owner approvals |
| `src/shared/raw_log.py` | Persists every webhook payload + headers to `evidence/webhooks/` |
| `src/telegram_bot/runtime.py` | `python-telegram-bot` Application; long-polling lifecycle |
| `src/telegram_bot/handlers.py` | `/start`, `/status`, approval `CallbackQueryHandler` |
| `src/telegram_bot/notifier.py` | Outgoing helpers; HTML-formatted, fallback to plain text |
| `src/telegram_bot/owner.py` | Owner chat-id storage (`state/owner_chat_id.txt`) |
| `src/telegram_bot/app_state.py` | Singleton holder for the running bot Application (breaks import cycle) |

### 2.3 Storefront — Next.js (separate device)

Built and run on a different machine. Talks to the wrapper through a
Cloudflare quick-tunnel (`*.trycloudflare.com`). Implementation guidance is
in [`website_prompt.md`](./website_prompt.md). It is **out of process and
out of repo** for this submission — only the wrapper knows about it.

### 2.4 Claude Code CLI — headless `-p`

Per brief §4, the only LLM runtime allowed. We use the user's Claude Max
subscription via `claude -p "<prompt>" --output-format json --max-turns 12 --allowedTools "..."`.
The CLI auto-discovers `.mcp.json` in the project root, so MCP tools are
available to the agent without extra flags.

### 2.5 Cloudflare tunnel — `cloudflared`

Free, no-account quick tunnel. Reuse one for both the WhatsApp webhook and
the storefront API. Note: URL rotates per `cloudflared` restart, so the
storefront must be re-pointed via env var on each session.

---

## 3. Routing

### 3.1 Inbound — WhatsApp customer

```
customer DMs simulated WhatsApp number
  ↓ (sandbox-driven)
mcp.whatsapp_inject_inbound(...)         ← may also be called by us / evaluator
  ↓ (server-side fan-out)
POST <tunnel>/webhooks/whatsapp          ← Meta Cloud API webhook envelope
  ↓
src/whatsapp/router.whatsapp_webhook
  • log_raw_webhook → evidence/webhooks/whatsapp/<ts>.json
  • MetaWhatsAppWebhook.model_validate
  • iter_inbounds yields canonical WhatsAppInbound
  • background_task: run_inbound_turn(ib)
  • return 200
```

`run_inbound_turn` in `src/shared/turn.py` then:

```
process_whatsapp_inbound(ib)             ← Pass 1, see §4
  ↓
write evidence/turns/<phone>/<wamid>.json
  ↓
if "APPROVAL_NEEDED" in summary:
  approvals.record_pending(...)          → state/approvals/<wamid>.json
  notifier.notify_with_approval_buttons  → Telegram bot push w/ inline keyboard
else:
  notifier.notify_owner(formatted msg)   → Telegram bot push
```

### 3.2 Inbound — Instagram DM

```
follower DMs simulated IG account
  ↓ (sandbox-driven)
mcp.instagram_inject_dm(...)
  ↓ (server-side fan-out)
POST <tunnel>/webhooks/instagram         ← Messenger Platform envelope
  ↓
src/instagram/router.instagram_webhook
  • log_raw_webhook → evidence/webhooks/instagram/<ts>.json
  • MetaInstagramWebhook.model_validate
  • iter_inbounds yields canonical InstagramInbound
  • background_task: run_instagram_inbound_turn(ib)
```

`run_instagram_inbound_turn` reuses the same orchestration shape as
WhatsApp — runs `process_instagram_inbound` against
`agent/system_prompts/instagram_dm.md`, persists evidence to
`evidence/turns/instagram/<sender>/<mid>.json`, and pushes the agent
summary to Telegram. Custom-work asks emit `APPROVAL_NEEDED` and the
owner sees a brief in chat (FYI; IG pass-2 auto-execution is reserved
work — pass-2 currently only runs for WhatsApp approvals).

The IG agent uses a separate allowed-tools list (`INSTAGRAM_ALLOWED_TOOLS`
in `claude_runner.py`) — same kitchen/Square write tools as WhatsApp,
but `instagram_send_dm` instead of `whatsapp_send`.

### 3.3 Inbound — storefront order

```
storefront → POST <tunnel>/api/orders
  ↓
src/website/router.create_order
  ↓
src/website/orders.process_order:
  1. Validate Pydantic schema
  2. Pull catalog + constraints + capacity in parallel from MCP
  3. Validate variationIds, pickup_at, lead time, capacity
  4. Detect approval branch:
     • any item.requires_custom_work == True       → approval
     • notes contains decoration-intent keywords   → approval
       (write|decorate|on top|custom|personali|message|letters|inscription|name on)
  5a. APPROVAL → record + Telegram push w/ buttons → return 202
  5b. DIRECT  → square_create_order(source="website") → kitchen_create_ticket → Telegram push → return 200
  6. Persist evidence/website_orders/<order_id>.json
```

### 3.4 Inbound — owner Telegram action

```
owner taps [Approve] or [Reject] on a pending request
  ↓
Telegram delivers update via long-poll
  ↓
src/telegram_bot/handlers.approval_callback
  • verify chat_id == load_owner_chat_id() (gate non-owner taps)
  • parse callback_data "apv:<id>:<a|r>"
  • approvals.update_status(id, "approved"|"rejected")
  • query.answer + edit_message_text (mark in chat)
  • asyncio.create_task(run_approval_turn(state))
  ↓
run_approval_turn:
  • process_approval_decision(approval)  ← Pass 2 (see §4)
  • write evidence/approvals_pass2/<phone>/<id>.json
  • notifier.notify_owner(pass2 outcome message)
```

---

## 4. Agent design

### 4.1 Two-pass model

Each customer interaction may produce one or two `claude -p` calls.

**Pass 1** — fired on every inbound. Reads `agent/system_prompts/sales.md`,
appends customer context, runs the chain (catalog → inventory → constraints
→ capacity → order or hold → accept/reject → reply → end-of-summary marker).
Pass 1 may:

- Reply directly via `whatsapp_send` and create order + ticket (non-custom).
- Reply with a holding message via `whatsapp_send` and emit `APPROVAL_NEEDED`
  in its summary (custom-work item).

**Pass 2** — fired only after the owner taps Approve/Reject in Telegram.
Re-runs `claude -p` with a Pass 2 prompt template that includes:
- The full sales prompt
- The original inbound + Pass 1 summary
- The owner's decision (`APPROVED` or `REJECTED`)

Pass 2 either creates the order + ticket + final WhatsApp confirmation
(approved) or sends a polite WhatsApp decline (rejected).

### 4.2 Prompt strategy

Single source of truth: `agent/system_prompts/sales.md`. Loaded fresh on
every turn. Rules covered:

- 8 hard brand rules (wordmark, cake-name quotes, English, emoji ≤ 3, no
  fabrication, sign as people, no DM redirect-to-channel, lead with action).
- The 10-step tool chain — including a `square_get_inventory` step right
  after `square_list_catalog` so the agent distinguishes cabinet stock
  (same-day pull) from bake capacity (net-new prep) and never promises
  inventory it doesn't have.
- The approval gate format (`APPROVAL_NEEDED` + structured Decision brief
  with consistent time units).
- Soft rules (specifics over adjectives, lists past 4 sentences, etc.).
- The required "📩 Reply sent to customer:" footer with the verbatim message
  body the agent sent — gives the owner an audit trail in Telegram.

### 4.3 Tool authorization

`claude -p` runs with an explicit `--allowedTools` list (see
`src/shared/claude_runner.ALLOWED_TOOLS`). Only HappyCake MCP tools are
allowed; no shell/file access. Adding a new tool requires updating the
list.

### 4.4 Output format

`--output-format json` — one final JSON object containing `result` (the
agent's summary), `is_error`, `num_turns`, `duration_ms`, `permission_denials`,
token usage, etc. The wrapper logs all of this verbatim into the per-turn
evidence file.

### 4.5 Channel-marker conventions

Pass 1 emits these tokens, parsed by `src/shared/turn.py` and
`src/shared/approvals.detect_marker`:

- `APPROVAL_NEEDED` — followed by a structured Decision brief (item, ask,
  pickup, lead time, capacity, feasibility) and the verbatim reply.
- `📩 Reply sent to customer:` — followed by the verbatim message body.

Both are surfaced verbatim in Telegram via a small markdown→Telegram-HTML
converter (`_to_html` in `src/shared/turn.py`).

---

## 5. State and evidence

### 5.1 State (mutable, gitignored)

| Path | Contents |
|---|---|
| `state/owner_chat_id.txt` | The Telegram chat_id captured by `/start` |
| `state/approvals/<id>.json` | Pending / decided approvals (channel, phone, inbound, decision, timestamps) |
| `state/threads/` | (reserved — flat-JSON thread store; not yet exercised) |

### 5.2 Evidence (append-only audit log, gitignored)

Per brief §9, the evaluator scores us on real state changes plus our
audit trail. We persist every observable event:

| Path | Contents |
|---|---|
| `evidence/webhooks/whatsapp/<ts>.json` | Raw inbound webhook payload + headers |
| `evidence/turns/<phone>/<wamid>.json` | Pass 1 evidence: started/finished, inbound, full claude JSON result (incl. tool calls, denials, cost) |
| `evidence/approvals_pass2/<phone>/<id>.json` | Pass 2 evidence: started/finished, approval state, full claude JSON result |
| `evidence/website_orders/<order_id>.json` | Direct-path order evidence: request, order, ticket |

In addition, the simulator's own `mcp_audit_log` (read via
`evaluator_get_evidence_summary`) provides cross-team visibility — every
MCP tool call is logged on their side too.

---

## 6. Owner-bot mapping

Per brief §4 *"one bot per agent if the system has multiple agents"*. We
ship one bot today.

| Bot | Username | Role | Process | Token env |
|---|---|---|---|---|
| Sales | `@happyDaarBot` | All customer-channel pushes (WhatsApp + website), approval prompts, `/start`, `/status`. | embedded in wrapper (long-poll lifespan task) | `TELEGRAM_SALES_BOT_TOKEN` |

Reserved for future expansion (currently unused, no blocking dependency):

| Bot (planned) | Username (TBD) | Role | Token env |
|---|---|---|---|
| Kitchen | `@happyKitchenBot` | Ticket events: queued / accepted / ready, capacity warnings | `TELEGRAM_KITCHEN_BOT_TOKEN` |
| Marketing | `@happyMarketingBot` | Daily $500 budget recommendation, campaign status | `TELEGRAM_MARKETING_BOT_TOKEN` |

The single-bot setup is intentional — a 24-hour build is better served by
*one well-tuned bot* than three half-finished ones. The brief explicitly
allows up to one bot per agent; nothing requires more than one.

### 6.1 Owner identity

The bot listens to all messages but only acts on commands from the chat
recorded by `/start`. Persisted to `state/owner_chat_id.txt`. Other Telegram
users get *"Not authorized."*

---

## 7. Runtime + deployment

### 7.1 Required env vars

```bash
# .env (gitignored) — see .env.example for full list
SBC_TOKEN=sbc_team_...                    # MCP auth, also referenced in .mcp.json
TELEGRAM_SALES_BOT_TOKEN=<from BotFather> # required for the bot to come up
WEBSITE_CORS_ORIGINS=http://localhost:3000  # comma-separated, * accepted
PUBLIC_WEBHOOK_BASE_URL=https://<...>.trycloudflare.com  # informational only, shown on /
CLAUDE_BIN=claude                         # default; override if non-standard install
```

### 7.2 Processes

```
┌─────────────────────────────────────────┐
│ Wrapper (uvicorn)         port 8080     │
│   ├── FastAPI HTTP server               │
│   ├── Telegram long-poll task (in-proc) │
│   └── claude -p subprocess (per turn)   │
└─────────────────────────────────────────┘
        │
        │ (incoming public traffic)
        ▼
┌─────────────────────────────────────────┐
│ cloudflared tunnel (separate process)   │
│   tunnels :8080 → public HTTPS URL      │
└─────────────────────────────────────────┘
```

`claude` is invoked per turn (not long-running). Each invocation talks to
the MCP using the project-root `.mcp.json` config.

### 7.3 Boot sequence

```bash
# Terminal A — wrapper
cd "/path/to/happy-cake"
.venv/bin/uvicorn src.main:app --port 8080 --reload

# Terminal B — tunnel
cloudflared tunnel --url http://localhost:8080 --no-autoupdate
# copy the printed https URL

# One-time per tunnel start: register the WhatsApp webhook with the simulator
# (call MCP tool whatsapp_register_webhook with that URL — wrapper owner does this)

# Owner side (one-time per bot install):
# Open @happyDaarBot in Telegram → send /start → chat_id captured to state/

# Storefront side (other device):
# set NEXT_PUBLIC_API_BASE_URL to the tunnel URL → next dev
```

### 7.4 Demo trigger

```bash
.venv/bin/python scripts/demo_inbound.py \
  --from +12679883724 \
  --message "Hi! Need a custom birthday cake for Lily — Saturday afternoon."
```

The script calls `whatsapp_inject_inbound` via JSON-RPC; the simulator
forwards the Meta envelope to our webhook; the wrapper runs Pass 1; Telegram
gets an approval prompt.

---

## 8. Design choices worth calling out

### 8.1 Two passes, not one streaming agent

We split the customer turn into Pass 1 (think + maybe hold) and Pass 2
(execute after approval). This keeps `claude -p` calls **stateless** — the
wrapper passes everything Pass 2 needs in the prompt. No
session-resume gymnastics, no Claude memory of approval state. Each turn
is independently auditable.

### 8.2 Direct path on the website, agent path on WhatsApp

A storefront customer expects a sub-second response from a checkout button.
Running Claude (~30 s/turn) on the order endpoint would feel broken. So:

| Channel | Path | Why |
|---|---|---|
| WhatsApp | Agent | Conversational; brand voice + reasoning over fuzzy text matter |
| Website (regular SKU) | Direct (deterministic) | Form data is structured; latency must be < 1 s |
| Website (custom item / decoration intent) | Approval flow | Owner judgment required; latency budget shifts to Telegram round-trip |

### 8.3 Agent self-emits the audit trail

The agent ends every turn with a `📩 Reply sent to customer:` block
containing the verbatim outbound message. This avoids `--output-format
stream-json` complexity and gives the owner exact wording to audit in
Telegram. The brandbook tone-check is the agent's responsibility before
that block is written.

### 8.4 Markdown → Telegram-HTML conversion

Telegram renders `<b>`, `<i>`, `<code>`, `<pre>`, `<blockquote>` if you
send `parse_mode="HTML"`. We html-escape user content first, then
re-introduce HTML tags for the markdown patterns the agent emits
(triple-backtick fences, single backticks, `**bold**`, `*italic*`,
`> blockquote`). See `_to_html` in `src/shared/turn.py`.

### 8.5 Webhook is dormant insurance

Early in the build the simulator did not fan out `whatsapp_inject_inbound`
events to registered webhooks. A fix landed mid-build (verified via
`x-sbc-hackathon-source: mcp-forward` header in captured payloads). We
left the webhook as the primary path; if it ever stops forwarding again,
we can fall back to polling `whatsapp_list_threads` without rewriting any
business logic.

### 8.6 No real Meta / Square credentials

Per brief §4, forbidden. The simulator's `whatsappOutbound` counter
doesn't increment on `whatsapp_send` until Meta credentials are wired
server-side; the **`mcp_audit_log` counter does** — which is what the
evaluator scores. We surface every outbound message in:

1. The agent's per-turn evidence file (`📩 Reply sent to customer:` block).
2. The owner's Telegram push (so a human sees what was said).
3. The MCP audit log (which the evaluator inspects via
   `evaluator_get_evidence_summary`).

---

## 9. Failure modes + recovery

| Failure | Symptom | Mitigation |
|---|---|---|
| Cloudflare tunnel down | webhook never hits us; storefront 502s | restart `cloudflared`, re-register webhook URL with simulator |
| Claude permission-denied on MCP tools | turn finishes with `is_error: true`, `permission_denials` populated | `--allowedTools` list out of date; add the tool name |
| Bot token revoked / leaked | bot fails to come up at startup | rotate via BotFather `/revoke` + `/token`; update `.env`; restart wrapper |
| `state/owner_chat_id.txt` lost | owner pushes are skipped | owner re-sends `/start` — handler re-records the chat_id |
| Capacity-violating ticket | kitchen ticket created with `estimatedReadyAt > requestedPickupAt` | agent compares the two fields and adjusts the customer's reply; wrapper-side `/api/orders` rejects with 409 + auto-suggest before write |
| Markdown breaks Telegram parser | message comes through as raw HTML / parse error | `_send` falls back to a plain-text retry with HTML tags stripped |

---

## 10. Out of scope for this submission

- Real Meta WhatsApp / Instagram / Square integration.
- Customer email follow-up (we have the email field but don't send anything).
- Persistent thread-store DB (flat JSON is enough for the hackathon scenarios).
- Marketing $500/mo plan **execution** (the brief deliverable is the *plan*,
  not running the campaigns — see `marketing_plan.md` if/when generated).
- Multi-bot Telegram (kitchen + marketing bots are reserved-not-built).

---

## Appendix A — Repo tree

```
.
├── .env.example
├── .mcp.example.json            # safe-to-commit MCP config template
├── .mcp.json                    # gitignored — your real SBC_TOKEN here
├── ARCHITECTURE.md              # this file
├── Brandbook.md                 # voice + agent operating rules
├── HACKATHON_BRIEF.md           # task brief (input)
├── MCP_DRY_RUN.md               # validated WA → order → ticket chain
├── README.md                    # setup from a fresh clone
├── metadata.json                # asset pack metadata
├── website_prompt.md            # storefront agent build brief
├── requirements.txt
├── agent/
│   └── system_prompts/
│       └── sales.md             # the brand-rules + tool-chain prompt
├── scripts/
│   └── demo_inbound.py          # drive a fake WhatsApp turn
└── src/
    ├── main.py                  # FastAPI app + CORS + lifespan
    ├── config.py                # pydantic-settings, .env loader
    ├── shared/
    │   ├── agent.py             # Pass 1 + Pass 2 prompt builders
    │   ├── approvals.py         # state/approvals/ JSON I/O + marker constant
    │   ├── claude_runner.py     # async subprocess `claude -p`
    │   ├── mcp_client.py        # async JSON-RPC tools/call helper
    │   ├── raw_log.py           # evidence/webhooks/<ch>/<ts>.json writer
    │   └── turn.py              # orchestration (Pass 1, Pass 2, evidence, push)
    ├── telegram_bot/
    │   ├── app_state.py         # Application singleton (breaks import cycle)
    │   ├── handlers.py          # /start, /status, approval callback
    │   ├── notifier.py          # outbound helpers (HTML mode + fallback)
    │   ├── owner.py             # owner chat_id storage
    │   └── runtime.py           # Application lifecycle + handler registration
    ├── website/
    │   ├── orders.py            # /api/orders service layer
    │   ├── router.py            # /api/orders, /api/catalog, /api/health
    │   └── schemas.py           # Pydantic models for the website API
    └── whatsapp/
        ├── router.py            # POST /webhooks/whatsapp
        └── schemas.py           # Meta Cloud envelope + canonical inbound
```

---

## Appendix B — Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Service identity + endpoint list |
| GET | `/health` | Wrapper liveness |
| POST | `/webhooks/whatsapp` | Meta-shape inbound from the MCP simulator |
| GET | `/webhooks/whatsapp/health` | Channel liveness |
| GET | `/api/health` | Storefront API liveness |
| GET | `/api/catalog` | Catalog joined with kitchen constraints |
| POST | `/api/orders` | Storefront order intake (200/202/409/400/503) |

---

## Appendix C — Telegram bot commands

| Command / event | Source | Behavior |
|---|---|---|
| `/start` | owner | Saves chat_id to `state/owner_chat_id.txt` |
| `/status` | owner (gated by chat_id) | Calls `evaluator_get_evidence_summary` and renders counts |
| (auto) | wrapper push | `🛒 New website order` direct-path summary |
| (auto) | wrapper push | `⏳ Approval needed` with [✅ Approve] [❌ Reject] |
| (auto) | wrapper push | `✅ Customer turn handled` after each WhatsApp Pass 1 |
| (auto) | wrapper push | `✅ Pass 2 finished — owner decision: …` after each approval decision |
| Inline button | owner tap | Records decision, fires Pass 2 in background |
