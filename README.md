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

**Why dual-fanout?** The hosted simulator accepts a registered webhook URL but
does not currently forward `whatsapp_inject_inbound` events to it (verified
during discovery — see `MCP_DRY_RUN.md`). For demos and evaluator runs we use
`scripts/demo_inbound.py` to drive both the simulator (so its state is
correct) and our wrapper (so the agent processes the message) in parallel.
The webhook endpoint stays in place for any future real-channel wiring.

## Setup from a fresh clone

```bash
# 1. Python venv + deps
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. MCP config (production is gitignored)
cp .mcp.example.json .mcp.json
# Edit .mcp.json: replace ${SBC_TOKEN} with your team's token from Steppe BC.

# 3. Environment (optional for the wrapper-only path)
cp .env.example .env
# Edit .env if you plan to use Telegram bots / a public tunnel.

# 4. Run the wrapper
.venv/bin/uvicorn src.main:app --reload --port 8080

# 5. Drive a fake customer turn (in another terminal)
.venv/bin/python scripts/demo_inbound.py \
  --from +12679883724 \
  --message "Hi, do you have a whole honey cake today?"
```

Visit `http://localhost:8080/` for a list of endpoints.

### Optional: public tunnel

Only needed if/when the simulator starts forwarding real webhooks, or to demo
the public endpoint to the evaluator. Cloudflare quick-tunnels are easiest
(no account required):

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8080 --no-autoupdate
# Copy the printed https://*.trycloudflare.com URL.
# Register it with the simulator:
#   (call MCP tool whatsapp_register_webhook with that URL)
```

⚠️ Quick-tunnel URLs change on every restart — re-register if you stop and
start `cloudflared`.

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

- [x] MCP entity chain validated end-to-end (`MCP_DRY_RUN.md`)
- [x] FastAPI skeleton + raw webhook discovery endpoint
- [x] Cloudflare tunnel verified + webhook semantics discovered
- [x] Dual-fanout demo driver (`scripts/demo_inbound.py`)
- [ ] `claude -p` subprocess runner (`src/shared/claude_runner.py`)
- [ ] Thread store + evidence logger
- [ ] Sales agent system prompt (brand voice + tool chain + approval rules)
- [ ] End-to-end happy path test (inbound → claude → reply → evidence)
- [ ] Telegram bots (sales / kitchen / marketing)
- [ ] Next.js storefront on `happycake.us`
- [ ] Marketing $500 / month budget plan generator



https://happens-sip-cabin-carroll.trycloudflare.com