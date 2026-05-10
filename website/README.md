# HappyCake — storefront

Next.js (App Router) storefront for [HappyCake US](../HACKATHON_BRIEF.md).
Customer-facing site: catalog, product detail, order form, on-site chat
assistant ("Saule"). Renders the brand voice, photos from the asset pack,
and machine-readable product feeds for agent consumers.

The storefront does **not** run AI itself. All Claude / MCP / Telegram
logic lives in the **HappyCake wrapper** (a FastAPI service in `../src`).
Server-side API routes here proxy to the wrapper.

## Setup

```bash
cp .env.local.example .env.local
# Edit .env.local and set WRAPPER_BASE_URL to your wrapper's tunnel URL
# (the one cloudflared prints on the wrapper machine).

npm install
npm run dev
# → http://localhost:3000
```

`WRAPPER_BASE_URL` is server-side only — used by `/api/order` and
`/api/agent` to call the wrapper. **Do not expose it to the browser.**

## Routes

### Pages

| Path | Purpose |
|---|---|
| `/` | Hero + featured items |
| `/menu` | Full catalog grid |
| `/menu/[slug]` | Product detail |
| `/order` | Order form (calls `/api/order`) |
| `/visit`, `/policies`, `/about`, `/marketing` | Static brand/info pages |

### API routes — what they do

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | **Static** product feed for agent consumers (machine-readable JSON, brief §3). Source: `src/lib/catalog.ts`. Cached. |
| GET | `/llms.txt` | **Static** site description for LLM crawlers. |
| POST | `/api/order` | **Proxy** → `${WRAPPER_BASE_URL}/api/orders`. Maps `slug` → `variationId` from local catalog. |
| POST | `/api/agent` | **Proxy** → `${WRAPPER_BASE_URL}/api/chat`. Calls Saule on the wrapper. |

The two proxies are thin: validate request, map fields, forward, return.
No AI is run inside this Next.js app.

## What runs on the wrapper machine, not here

- Order creation (`square_create_order`, `kitchen_create_ticket`)
- The on-site chat agent (Saule) and her brand voice rules
- Custom-work approval flow + Telegram owner buttons
- Complaint / order-problem escalations to Telegram
- Per-turn evidence files

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) and [`../website_prompt.md`](../website_prompt.md).

## Brand-voice rules (in case you generate copy)

- Wordmark: **HappyCake** (one word, two capitals).
- Cake names in quotes after "cake": *cake "Honey"*.
- English only, ≤ 3 emoji per message, plain English.
- No "Order on the site at happycake.us" CTA — the user is already on the site.
- Sign as people: *"— the HappyCake team"* or first name.

Full rules: [`../Brandbook.md`](../Brandbook.md).
