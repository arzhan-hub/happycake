# HappyCake storefront — agent build brief

> **Audience:** the AI/coding agent (v0, Claude Code, etc.) on the storefront
> machine. Pass this entire file as your prompt. It is self-contained.
>
> **What to build:** a Next.js (App Router) storefront for *HappyCake US*
> (Sugar Land, TX). The site lets customers browse cakes, fill a cart,
> and place an order. The order endpoint is hosted on a different machine
> and reachable through a Cloudflare tunnel — your job is the UI layer.
>
> **What's already built (do NOT reimplement):**
> - The orders backend at `<API_BASE_URL>/api/orders` (creates Square orders, kitchen tickets, pushes Telegram approvals).
> - A live catalog endpoint at `<API_BASE_URL>/api/catalog`.
> - All brand rules + voice (see [`Brandbook.md`](./Brandbook.md) and the brand-voice section below).

---

## 1. Setup on your machine (the storefront device)

### 1.1 Environment variables

Create `.env.local` at the Next.js project root. **Never hardcode the tunnel URL in source files.**

```bash
# .env.local — git-ignored
NEXT_PUBLIC_API_BASE_URL=https://dating-put-addressing-jennifer.trycloudflare.com
```

> ⚠️ The tunnel URL **rotates every time the wrapper machine restarts `cloudflared`**. Make sure the only place this URL appears is `.env.local`. The owner will hand you a new URL on each session.

In code, always read it via `process.env.NEXT_PUBLIC_API_BASE_URL` (or a typed config helper). For example:

```ts
// src/lib/api.ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  (() => { throw new Error("NEXT_PUBLIC_API_BASE_URL must be set in .env.local"); })();
```

### 1.2 CORS — coordinate with the wrapper owner

The wrapper machine has a `WEBSITE_CORS_ORIGINS` env variable that allow-lists where browser requests can come from. For local dev on your storefront machine, the Origin sent by the browser will be `http://localhost:3000` (whatever `next dev` runs on). The wrapper owner must include your origin in their list:

```
# wrapper-side .env (their machine)
WEBSITE_CORS_ORIGINS=http://localhost:3000
```

If you get a CORS preflight error in the browser console, that's the fix.

### 1.3 Smoke test before writing UI code

From your machine's terminal — confirm the tunnel works **before** building components:

```bash
export API_BASE_URL="https://dating-put-addressing-jennifer.trycloudflare.com"

curl -s "$API_BASE_URL/api/health" | jq
# Expect: { "ok": true, "channel": "website" }

curl -s "$API_BASE_URL/api/catalog" | jq '.items[0]'
# Expect: a populated row with variation_id, name, price_cents, etc.
```

If either fails, ask the wrapper owner to (a) confirm the tunnel URL is current, (b) confirm the wrapper is running, (c) confirm CORS allow-list. Don't proceed until both succeed.

---

## 2. Pages & components to build

| Route | Component | Purpose |
|---|---|---|
| `/` | `MenuPage` | Hero + grid of catalog items pulled from `GET /api/catalog`. Click → product page or directly to cart. |
| `/cake/[variationId]` *(optional)* | `ProductDetail` | Detail view for a single SKU. Shows photo, description, price, lead-time hint. |
| `/cart` | `CartPage` | Cart contents with qty editors. Checkout button. |
| `/checkout` | `CheckoutForm` | Customer (name/phone/email), pickup date+time, optional notes. Submits to `POST /api/orders`. Renders one of three success states based on response. |
| `/policies`, `/about` *(optional)* | `Static` | Pickup, allergens, brand story. Nice-to-have. |

You may collapse `/cart` and `/checkout` into a single page if simpler.

### Component-level expectations

- **Menu cards** must split rendering by `requires_custom_work`:
  - `false` → "Add to cart" button, normal flow.
  - `true` → "Request this cake" button, opens a longer-form intake (notes field encouraged, target date). Submits to the same endpoint — server returns `202 pending_approval`.
- **Pickup time picker:** disable any timeslot earlier than `now() + max(lead_time_minutes for items in cart) + 5min buffer`. Pull `lead_time_minutes` from `/api/catalog`.
- **Phone field:** require E.164 format (e.g. `+12679883724`). Show a small hint or use a country-code picker. Don't accept raw 10-digit US numbers without `+1` — the backend treats it as the customer's WhatsApp identity for any owner-driven follow-up.
- **Submit button:** disabled while `loading`. Show optimistic "submitting..." state for ~2 seconds.

---

## 3. API reference

Base URL: `${NEXT_PUBLIC_API_BASE_URL}` (the Cloudflare tunnel from §1.1).

All requests/responses are JSON. Set `Content-Type: application/json` on POST.

### 3.1 `GET /api/health`

Liveness probe. Returns `{ "ok": true, "channel": "website" }`. Use during dev to verify the tunnel is reachable.

### 3.2 `GET /api/catalog`

Live catalog joined with kitchen constraints. **Use this** to render the menu — do not hardcode SKUs.

Response `200`:
```json
{
  "ok": true,
  "items": [
    {
      "variation_id": "sq_var_whole_honey_cake",
      "kitchen_product_id": "whole-honey-cake",
      "name": "Whole honey cake",
      "category": "whole-cakes",
      "price_cents": 5500,
      "description": "Classic whole honey cake for family orders.",
      "lead_time_minutes": 60,
      "prep_minutes": 25,
      "daily_capacity_units": 12,
      "requires_custom_work": false
    }
  ]
}
```

Response `503` if the upstream MCP is down — show a polite "we're having trouble loading the menu" banner.

### 3.3 `POST /api/orders`

Place an order. Request body:

```json
{
  "items": [
    { "variationId": "sq_var_whole_honey_cake", "quantity": 1 }
  ],
  "customer": {
    "name": "Maria",
    "phone": "+12679883724",
    "email": "maria@example.com"
  },
  "pickup_at": "2026-05-12T18:00:00Z",
  "notes": "Please pack with care."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `items[].variationId` | string | yes | from `/api/catalog`, field `variation_id` |
| `items[].quantity` | int 1–20 | yes | |
| `customer.name` | string 1–120 | yes | |
| `customer.phone` | E.164 string | yes | e.g. `+12679883724` |
| `customer.email` | string ≤200 | no | informational only for now |
| `pickup_at` | ISO 8601 UTC | yes | example: `2026-05-12T18:00:00Z` — convert from the user's local picker via `date.toISOString()` |
| `notes` | string ≤1000 | no | If it implies decoration ("write…", "decorate", "on top", "custom", "personalize", "message", "letters", "inscription", "name on") the order is auto-routed to owner approval |

Five possible response shapes — handle every one:

#### 3.3.1 `200 confirmed` — order placed end-to-end

```json
{
  "ok": true,
  "status": "confirmed",
  "order_id": "sq_order_1778378933107",
  "ticket_id": "kt_1778378933335",
  "estimated_ready_at": "2026-05-12T17:35:00Z",
  "pickup_at": "2026-05-12T18:00:00Z",
  "items": [
    {
      "variation_id": "sq_var_whole_honey_cake",
      "name": "Whole honey cake",
      "quantity": 1,
      "unit_price_cents": 5500,
      "line_total_cents": 5500
    }
  ],
  "total_cents": 5500,
  "message": "Got it, Maria — Whole honey cake ×1 is in the kitchen. Total $55.00. Ready by 2026-05-12T17:35:00Z. Pickup at HappyCake Sugar Land. — the HappyCake team"
}
```

**UI:** confirmation page with:
- Hero `✅ Thanks, {customer.name}` (or render `message` directly).
- Order summary: line items, total `$ {total_cents/100}`, ETA pill (format `estimated_ready_at` in user-local time).
- Order ID as a small confirmation reference.
- Optional: "Save to calendar" link with the pickup time.

#### 3.3.2 `202 pending_approval` — needs owner sign-off

```json
{
  "ok": true,
  "status": "pending_approval",
  "approval_id": "web_1778378999535",
  "message": "Got it, Maria — your request is with the team. We'll come back on WhatsApp within the hour."
}
```

Triggered by either (a) `requires_custom_work: true` items in cart, or (b) decoration-intent keywords detected in `notes`.

**UI:** "Request received" page:
- Hero `⏳ Your request is with the team`.
- Show `message` text verbatim.
- Note that follow-up will arrive on WhatsApp at the phone they entered.
- Display `approval_id` as a small reference number.
- No "track your order" link — there's no order yet.

#### 3.3.3 `409 capacity / lead-time problem` — auto-suggest

```json
{
  "ok": false,
  "error": "lead_time_too_short",
  "message": "We need at least 60 minutes to prepare this order. Earliest pickup: 2026-05-12T17:35:00Z.",
  "earliest_pickup_at": "2026-05-12T17:35:00Z"
}
```

`error` values:
- `lead_time_too_short` — pickup_at is sooner than now + max(lead_time) + 5min buffer.
- `capacity_full` — today's remaining kitchen minutes can't fit the order.

**UI:** stay on the checkout page. Show the `message` inline next to the pickup-time field. Provide a button labelled *"Use earliest available — {format(earliest_pickup_at)}"* that, when clicked, sets the pickup field to `earliest_pickup_at` and re-enables submit.

#### 3.3.4 `400 validation error`

```json
{
  "ok": false,
  "error": "unknown_variation",
  "message": "We don't have an item with id sq_var_xyz on the menu."
}
```

Other `error` values include `invalid_pickup_at`. Pydantic 422 errors may also occur if the request body shape is wrong — show a generic "something went wrong with your order, please try again" and log the full response to the console for debugging.

**UI:** show a non-fatal banner near the submit button. Keep cart state intact so the user can fix and retry.

#### 3.3.5 `503 mcp_unavailable`

```json
{
  "ok": false,
  "error": "mcp_unavailable",
  "message": "HappyCake catalog is temporarily unreachable. Please try again in a moment."
}
```

**UI:** show a retry banner. Network outage on the wrapper side — usually recovers in seconds.

---

## 4. Form details — easy-to-miss specifics

### 4.1 Pickup time → ISO 8601 UTC

The user picks a date and time in their local timezone. You must convert to UTC ISO 8601 before sending. JavaScript:

```ts
const local = new Date("2026-05-12T13:00"); // datetime-local input value
const isoUtc = local.toISOString();         // "2026-05-12T18:00:00.000Z" if user is CT
```

`Date.prototype.toISOString()` always emits UTC with a `Z` suffix — the backend accepts that.

### 4.2 Phone — E.164 only

Examples of acceptable values: `+12679883724`, `+447911123456`, `+77011234567`. Reject `2679883724` and `(267) 988-3724` (no `+` prefix and no country code). Provide a country-code dropdown defaulting to **+1 (US)**.

### 4.3 Cart → request body shape

```ts
const requestBody = {
  items: cart.items.map(line => ({
    variationId: line.variationId,        // camelCase, NOT snake_case
    quantity: line.quantity,
  })),
  customer: {
    name: form.name,
    phone: form.phone,                     // E.164
    email: form.email || undefined,
  },
  pickup_at: form.pickupDate.toISOString(),
  notes: form.notes?.trim() || undefined,
};
```

Note the mixed-case fields: `variationId` (camelCase, matches Square API convention) but `pickup_at` and the rest are snake_case. The backend tolerates both for compatibility but the example above is the canonical shape.

### 4.4 Submission flow — exact sequence

```
disable submit button → POST /api/orders
                            │
                            ▼
                  read response.status
                            │
       ┌────────────────────┼─────────────────────┬─────────────────┐
       │                    │                     │                 │
      200                  202                   409               4xx/5xx
       │                    │                     │                 │
       ▼                    ▼                     ▼                 ▼
  /confirmation        /confirmation         stay on form     show error banner
  state=confirmed      state=pending         show inline       re-enable submit
                                              suggest button
```

Always re-enable the submit button on any non-2xx response.

---

## 5. Brand voice — applies to every word in the UI

Customer-facing copy you generate (page titles, button text, success messages) must obey the brandbook. **The HappyCake wrapper enforces these in its server-rendered messages already** — but anything the storefront puts on screen must match.

- **Wordmark:** **HappyCake** — one word, two capitals. Never *Happy Cake*, *HC*, *happycake*, or *HAPPYCAKE*.
- **Cake names:** in quotes after "cake": *cake "Honey"*, *cake "Pistachio Roll"*, *cake "Tiramisu"*. Lowercase ingredient names inside descriptions.
- **Tone:** plain English, specific over generic. *"$55, 60-min lead time"* beats *"great value, ready soon"*. Lead with the action.
- **No redirect-to-channel CTA** like *"Order on the site at happycake.us..."* — the user is already on the site.
- **Sign off** as people if signing: *"— the HappyCake team"* or first name. Never *"Administration"*.
- **Emojis:** zero in price lists. Up to 3 elsewhere. Never on negative paths.
- **Length:** anything past four sentences becomes a bulleted list.
- **Two epithets max** in any product description.

For full rules, ask the wrapper owner for `Brandbook.md`.

### 5.1 Visual hints (if you're styling)

These come from the brandbook (`Brandbook.md` §4):

- **Palette:** deep navy `#0E2A3C` / `#1B4868` / `#3B7BA8` / `#BFD8E8`, cream `#FBF6E8` / `#F4ECD3` / `#E9DBB4`, accent coral `#E08066`, accent green `#6E9D74`.
- **Typography:** *Cormorant Garamond* for display/serif, *Inter* for body and UI.
- **Photo style:** generous whitespace, real product shots (no AI-generated cake photos — illustrations are OK).
- **Borders:** 0.5 px solid, dark blue at 20% opacity over cream surfaces.
- **No drop shadows** on product cards.

Asset pack metadata is at `metadata.json` on the wrapper machine — ask the owner for actual image URLs if you need them.

---

## 6. Verification checklist

Before declaring done:

- [ ] `.env.local` has `NEXT_PUBLIC_API_BASE_URL` pointing at the current tunnel.
- [ ] `curl $NEXT_PUBLIC_API_BASE_URL/api/health` returns `{ "ok": true }`.
- [ ] Menu page renders all items from `/api/catalog` (5 items in the current sandbox).
- [ ] Items with `requires_custom_work: true` use the request-form variant, not "Add to cart".
- [ ] Pickup picker disables slots violating lead time.
- [ ] Phone field accepts only E.164 (with country code prefix).
- [ ] Pickup datetime is sent as UTC ISO 8601 (`Z` suffix).
- [ ] Submit handles all five response shapes (`200`, `202`, `400`, `409`, `503`).
- [ ] On `409`, "Use earliest available" button appears and works.
- [ ] On `200`, confirmation page shows order_id, total, ETA.
- [ ] On `202`, pending page mentions WhatsApp follow-up.
- [ ] No usage of *"Happy Cake"* (two words) anywhere in source or rendered output.
- [ ] No usage of *"happycake.us"* CTAs in DM-style copy (the user is already on the site).

---

## 7. Out of scope (the wrapper handles these)

You do **not** build:
- Any Square / kitchen / Telegram integration. The wrapper does it.
- Any Claude / AI logic. The wrapper does it.
- Any `whatsapp_send` calls. The wrapper does it (after owner approval, for the `202` path).
- Any state for "approved orders" — there's no UI for follow-up; the owner contacts the customer on WhatsApp.

You only build the customer-facing storefront and the form that hits `POST /api/orders`.
