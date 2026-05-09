# MCP Dry Run — WhatsApp → Order → Kitchen Ticket

**Date:** 2026-05-09
**Goal:** Validate the entity-creation chain that any agent (Claude headless or otherwise) must follow when a customer messages HappyCake on WhatsApp.

**Test customer:** `+12679883724` (Maria), single whole honey cake, pickup ~5pm CT.

---

## Why this dry run matters

The brief (§6) says the sandbox/MCP is the **source of truth**. The evaluator (§9) scores us on real state changes — orders created, tickets queued, audit calls logged.

Before scaffolding the wrapper or the website, we need to know exactly:

1. What JSON shapes the MCP tools require.
2. How `Square orderId` and `Kitchen ticketId` are linked.
3. Where the catalog's `variationId` (Square) ↔ `kitchenProductId` (Kitchen) bridge lives.
4. What the evaluator counters look like before/after.
5. What surprises the simulator throws (e.g. capacity tight-window flags, whitelist requirements).

---

## Read-only baseline (before any writes)

### Catalog (`square_list_catalog`)

| variationId | kitchenProductId | Name | Price | Custom work? |
|---|---|---|---|---|
| `sq_var_honey_cake_slice` | `honey-cake-slice` | Honey cake slice | $8.50 | no |
| `sq_var_whole_honey_cake` | `whole-honey-cake` | Whole honey cake | $55.00 | no |
| `sq_var_pistachio_roll` | `pistachio-roll` | Pistachio roll | $9.50 | no |
| `sq_var_custom_birthday_cake` | `custom-birthday-cake` | Custom birthday cake | $95.00 | **yes** |
| `sq_var_office_dessert_box` | `office-dessert-box` | Office dessert box | $120.00 | **yes** |

**Bridge invariant:** Square uses `variationId`; Kitchen uses `productId`. Every catalog row carries both. The agent must hold the mapping when handing off Square → Kitchen.

### Kitchen capacity (`kitchen_get_capacity`)

```json
{
  "dailyCapacityMinutes": 420,
  "defaultLeadTimeMinutes": 45,
  "activePrepMinutes": 0,
  "remainingCapacityMinutes": 420,
  "queuedTickets": 0,
  "acceptedTickets": 0
}
```

### Menu constraints (`kitchen_get_menu_constraints`)

| productId | prepMin | leadTimeMin | dailyCap | requiresCustomWork |
|---|---|---|---|---|
| honey-cake-slice | 3 | 5 | 80 | false |
| whole-honey-cake | 25 | 60 | 12 | false |
| pistachio-roll | 8 | 20 | 30 | false |
| custom-birthday-cake | 90 | 1440 (24h) | 4 | **true** |
| office-dessert-box | 45 | 180 (3h) | 8 | **true** |

`requiresCustomWork: true` is the agent's signal to gate on **owner approval** (Telegram) before any write op.

### World scenarios (`world_get_scenarios`)

- `launch-day-revenue-engine` — 480 min, 1h sim = 10 real min
- `weekend-capacity-crunch` — 360 min, 1h sim = 8 real min ← currently running

### Evaluator counters before run

```json
{ "squareOrders": 0, "kitchenTickets": 0, "whatsappInbound": 0, "whatsappOutbound": 0, "auditCalls": 11 }
```

---

## The chain — step by step

### Step 1 — Inject simulated inbound message

**Tool:** `whatsapp_inject_inbound`
**Purpose:** Test driver only — does NOT actually message anyone. This is how we (and the evaluator) inject fake customer traffic.

**Input:**
```json
{
  "from": "+12679883724",
  "message": "Hi, do you have a whole honey cake ready for pickup today around 5pm? Customer name is Maria."
}
```

**Output:**
```
Injected inbound message from +12679883724. The agent should respond via whatsapp_send.
```

**What this tells us:** the simulator hints the next-step tool. The agent is expected to follow the contract.

---

### Step 2 — Create Square order

**Tool:** `square_create_order`
**Purpose:** Persist the order in the simulated POS. Returns an `orderId` we'll use for kitchen handoff.

**Input:**
```json
{
  "items": [{ "variationId": "sq_var_whole_honey_cake", "quantity": 1 }],
  "source": "whatsapp",
  "customerName": "Maria",
  "customerNote": "WhatsApp inquiry: pickup today around 5pm. Confirmed by agent."
}
```

**Output:**
```json
{
  "mode": "simulated",
  "order": {
    "id": "sq_order_1778361127994",
    "source": "whatsapp",
    "customerName": "Maria",
    "items": [{
      "variationId": "sq_var_whole_honey_cake",
      "quantity": 1,
      "name": "Whole honey cake",
      "priceCents": 5500,
      "kitchenProductId": "whole-honey-cake"
    }],
    "totalCents": 5500,
    "status": "open",
    "kitchenHandoffRecommended": true,
    "createdAt": "2026-05-09T21:12:07.994Z"
  },
  "kitchenTool": "kitchen_create_ticket"
}
```

**Key observations:**
- The order response **echoes `kitchenProductId`** for each line item — the agent doesn't have to re-query the catalog to do the handoff.
- `kitchenHandoffRecommended: true` and `kitchenTool: "kitchen_create_ticket"` are explicit next-step hints.
- Source attribution (`whatsapp`) is preserved — important for evaluator + analytics.

---

### Step 3 — Create kitchen ticket

**Tool:** `kitchen_create_ticket`
**Purpose:** Production handoff. Links the order to the kitchen queue with prep estimate.

**Input:**
```json
{
  "orderId": "sq_order_1778361127994",
  "customerName": "Maria",
  "items": [{ "productId": "whole-honey-cake", "quantity": 1 }],
  "requestedPickupAt": "2026-05-09T22:00:00.000Z",
  "notes": "WhatsApp order from +12679883724. Pickup ~5pm CT."
}
```

**Output:**
```json
{
  "ticketId": "kt_1778361158490",
  "status": "queued",
  "ticket": {
    "id": "kt_1778361158490",
    "orderId": "sq_order_1778361127994",
    "customerName": "Maria",
    "items": [{ "productId": "whole-honey-cake", "quantity": 1 }],
    "requestedPickupAt": "2026-05-09T22:00:00.000Z",
    "status": "queued",
    "estimatedPrepMinutes": 25,
    "estimatedReadyAt": "2026-05-09T22:12:38.490Z",
    "notes": "WhatsApp order from +12679883724. Pickup ~5pm CT.",
    "createdAt": "2026-05-09T21:12:38.490Z"
  }
}
```

**⚠️ Capacity-vs-pickup gotcha:**
- `requestedPickupAt`: 22:00:00 UTC
- `estimatedReadyAt`:   22:12:38 UTC

The simulator **accepted** the ticket but the math says the cake won't be ready until ~12 minutes after the requested pickup. Two takeaways:

1. The agent **must compare `estimatedReadyAt` to `requestedPickupAt`** post-creation and adjust the customer message accordingly.
2. The simulator does not auto-reject tight windows — it leaves it to the agent. Good for flexibility, bad if the agent ignores it.

---

### Step 4 — Send WhatsApp confirmation

**Tool:** `whatsapp_send`
**Purpose:** Reply to the customer in HappyCake voice (brand rules apply: English, ≤3 emoji, signed, soft CTA close).

**Input:**
```json
{
  "to": "+12679883724",
  "message": "Hi Maria — yes, the whole honey cake is on. We'll have it ready by 5:15 PM (it needs about 25 minutes of prep). Total is $55. Order #1127994 is in the kitchen now.\n\nOrder on the site at happycake.us or send a message on WhatsApp.\n\n— the HappyCake team"
}
```

**Output:**
```
[simulated] Message recorded for +12679883724. 251 chars. Real WhatsApp delivery activates once Meta credentials are wired.
```

**Brand check on the reply:**
- ✅ English only
- ✅ Lead with the action ("yes, the whole honey cake is on")
- ✅ Specifics over adjectives (5:15 PM, 25 min, $55, order #)
- ✅ Standard close
- ✅ Signed as people ("the HappyCake team")
- ✅ 0 emoji
- ✅ Adjusted pickup time to match `estimatedReadyAt` instead of blindly accepting `requestedPickupAt`

---

### Step 5 — Verify state

**`whatsapp_list_threads`** — inbound shows the injected message, outbound is empty (see anomaly below).

```json
{
  "inbound": [{
    "ts": "2026-05-09T21:11:38.272Z",
    "from": "+12679883724",
    "message": "Hi, do you have a whole honey cake ready for pickup today around 5pm? Customer name is Maria.",
    "direction": "inbound"
  }],
  "outbound": [],
  "simulated": true
}
```

**`kitchen_list_tickets`** — our ticket is queued.

```json
[{
  "id": "kt_1778361158490",
  "orderId": "sq_order_1778361127994",
  "customerName": "Maria",
  "items": [{ "productId": "whole-honey-cake", "quantity": 1 }],
  "status": "queued",
  "estimatedPrepMinutes": 25,
  "requestedPickupAt": "2026-05-09T22:00:00.000Z",
  "estimatedReadyAt": "2026-05-09T22:12:38.490Z",
  "notes": "WhatsApp order from +12679883724. Pickup ~5pm CT.",
  "createdAt": "2026-05-09T21:12:38.490Z"
}]
```

**`evaluator_get_evidence_summary`** — counters after the run:

```json
{
  "squareOrders": 1,        // +1
  "kitchenTickets": 1,       // +1
  "whatsappInbound": 1,      // +1
  "whatsappOutbound": 0,     // ⚠️ expected +1
  "auditCalls": 18           // +7 reads/writes since baseline
}
```

---

## Anomalies / things to investigate

1. **`whatsappOutbound` did not increment** even though `whatsapp_send` returned a successful "Message recorded" response. Possibilities:
   - The counter only increments when Meta credentials are wired (see send response: "Real WhatsApp delivery activates once Meta credentials are wired").
   - There's a separate counter for simulated outbound that we haven't found.
   - Bug in the simulator.
   Action: try `whatsapp_register_webhook` later and re-test, or accept that outbound count is a live-mode-only metric.

2. **Brandbook ↔ catalog product mismatch.** Brandbook references *cake "Napoleon"*, *cake "Milk Maiden"*, *cake "Tiramisu"*. Catalog has only honey/pistachio/custom-birthday/office-box. Per brief §6 (sandbox is source of truth), the website + agent must speak the catalog. Brandbook product names are illustrative.

3. **Tight-window detection is the agent's job.** `kitchen_create_ticket` will accept impossible windows; the agent has to compare `estimatedReadyAt` vs `requestedPickupAt` and renegotiate.

4. **`world_get_scenario_summary`** showed `weekend-capacity-crunch` already running (likely from a prior session or auto-init). Affects how we drive demos — we may want a clean reset before evaluator run.

---

## What this means for the wrapper

The wrapper (FastAPI/Express, etc.) needs to:

1. Receive a webhook (or poll `whatsapp_list_threads`) for new inbound messages.
2. Build a turn-context payload: thread history + new message + brand prompt.
3. Call `claude -p` with `--mcp-config` pointing at the happycake MCP server.
4. Let Claude reason and execute the chain (catalog → constraints → capacity → order → ticket → send).
5. **Enforce two pre-write gates** outside Claude (defense in depth):
   - Capacity check: compute `prepMinutes ≤ remainingCapacityMinutes` before letting `kitchen_create_ticket` fire.
   - Custom-work gate: if any line item has `requiresCustomWork: true`, require Telegram owner approval before `square_create_order`.
6. Persist the turn (inbound, prompt, MCP calls, outbound) to `evidence/<thread_id>/<turn>.json` for audit.
7. Push owner-facing summary to Telegram bot.

Each `claude -p` call is **stateless** — wrapper owns thread history and passes it in. This keeps tokens bounded and makes turns replayable for the evaluator.

---

## Replay script

Re-run this exact dry-run from a clean state (assuming MCP server is healthy and `SBC_TOKEN` env is set):

```bash
# 1. Inject inbound
claude -p "Use whatsapp_inject_inbound from=+12679883724 message='Hi, do you have a whole honey cake ready for pickup today around 5pm? Customer name is Maria.'"

# 2-4. Let Claude run the full chain (read catalog → constraints → capacity → create order → create ticket → reply)
claude -p "Customer +12679883724 (Maria) wants a whole honey cake for 5pm pickup today. Use square_list_catalog, kitchen_get_menu_constraints, kitchen_get_capacity, square_create_order, kitchen_create_ticket, whatsapp_send. Reply in HappyCake voice. Adjust pickup time if estimatedReadyAt > requestedPickupAt."

# 5. Verify
claude -p "Show whatsapp_list_threads, kitchen_list_tickets, evaluator_get_evidence_summary."
```

---

## Confirmed entities from this run

| Type | ID | Status |
|---|---|---|
| Square order | `sq_order_1778361127994` | open |
| Kitchen ticket | `kt_1778361158490` | queued |
| WhatsApp inbound | `+12679883724` @ `2026-05-09T21:11:38.272Z` | logged |
| WhatsApp outbound | `+12679883724` @ ~`21:13Z` | recorded (counter not incremented — see anomaly #1) |

End of dry run.
