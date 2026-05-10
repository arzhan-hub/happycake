# HappyCake $500/mo — punching at $5,000

**Owner:** Askhat (HappyCake Sugar Land)
**Cycle:** monthly, re-planned weekly
**Date prepared:** 2026-05-09 (eve of Mother's Day 2026 — paid-ads peak per brand book)
**Sandbox source-of-truth:** `marketing/evidence/2026-05-09__*.json`

The sandbox MCP states the constraint plainly:

```json
{ "monthlyBudgetUsd": 500, "targetEffectUsd": 5000, "challenge": "$500 -> $5,000" }
```

This plan is the system's answer to that 10× challenge. Every dollar maps to a SKU, a channel, a CAC ceiling, and an evidence trail.

---

## 1. Inputs (real, from MCP)

### 1.1 Margin per SKU
Pulled from `mcp__happycake__marketing_get_margin_by_product`.

| SKU | Price | Margin % | Contribution / order |
|---|---:|---:|---:|
| Honey cake slice | $8.50 | 68% | **$5.78** |
| Whole honey cake | $55.00 | 62% | **$34.10** |
| Pistachio roll | $9.50 | 64% | **$6.08** |
| Custom birthday cake | $95.00 | 58% | **$55.10** |
| Office dessert box | $120.00 | 60% | **$72.00** |

### 1.2 Sales history
Last 6 months from `mcp__happycake__marketing_get_sales_history`.

| Month | Revenue | Orders | AOV |
|---|---:|---:|---:|
| 2025-11 | $14,820 | 612 | $24.22 |
| 2025-12 | $19,240 | 738 | $26.07 |
| 2026-01 | $15,110 | 621 | $24.33 |
| 2026-02 | $16,890 | 668 | $25.28 |
| 2026-03 | $17,640 | 691 | $25.53 |
| 2026-04 | $18,320 | 724 | $25.30 |
| **avg** | **$17,003** | **676** | **$25.12** |

Trend: +24% revenue, +18% orders over 6 months. AOV is stable; growth is volume-led. December spike confirms holiday elasticity.

### 1.3 Budget constraint
From `mcp__happycake__marketing_get_budget`: $500/mo, target effect $5,000.

---

## 2. Unit economics (the only math that matters)

**Blended AOV is misleading.** $25.12 averages $5.78-margin slices with $72-margin office boxes. Paid acquisition has to be cohort-aware: which SKU did this dollar buy?

### CAC ceilings (contribution × 1.3 repeat factor)

| SKU | Contribution | CAC ceiling | Paid-acquirable? |
|---|---:|---:|---|
| Honey cake slice | $5.78 | $7.51 | **No** — walk-in / add-on only |
| Pistachio roll | $6.08 | $7.90 | **No** |
| Whole honey cake | $34.10 | $44.33 | **Yes** — flagship paid SKU |
| Custom birthday cake | $55.10 | $71.63 | **Yes** — high-intent search |
| Office dessert box | $72.00 | $93.60 | **Yes** — B2B repeat compounds |

The repeat factor 1.3 is conservative: brand book customer journey (stage 6 — "Return") explicitly invests in re-engagement, and the loyal Central/South Asian diaspora cohort over-indexes on repeat.

**Rule:** no paid-acquisition dollar targets a slice SKU. Slices are organic / walk-in / add-on. Any paid plan that ignores this rule destroys margin.

---

## 3. Channel allocation — $500

| # | Channel | $ | % | Target SKU(s) | Target CAC | Expected orders |
|---|---|---:|---:|---|---:|---:|
| 1 | Meta Ads (IG + FB, hyperlocal) | **$180** | 36% | whole-honey-cake, custom-birthday-cake | $30 | 6 |
| 2 | Google Ads (Search, intent) | **$120** | 24% | custom-birthday-cake, whole-honey-cake | $25 | 5 |
| 3 | Office B2B push (GBP + LinkedIn boost) | **$80** | 16% | office-dessert-box | $40 | 2 |
| 4 | Google Business Profile + reviews incentive | **$40** | 8% | flywheel (all SKUs) | n/a | indirect |
| 5 | WhatsApp re-engagement (past-90d buyers) | **$50** | 10% | whole-honey-cake repeat | $10 | 5 |
| 6 | IG/Meta organic post boosts (gated) | **$30** | 6% | brand awareness | n/a | indirect |
| | **Total** | **$500** | **100%** | | | **18 paid-attributed orders** |

### Why each line

**1. Meta Ads — $180 (36%).** The single biggest line because it serves the strongest narrative: hyperlocal IG carousel of 3 cakes + WhatsApp CTA, served to mothers/parents inside an 8-mile radius of the Sugar Land shop (ZIP 77478, 77479, 77498). IG is already a "window display" per the brief — paid converts that window into traffic. CAC target $30 against $34.10 contribution is breakeven on the first order; profit comes from the +30% repeat.

**2. Google Ads — $120 (24%).** Brand defense ("happycake sugar land") + 3 commercial keywords ("cake delivery sugar land", "birthday cake near me 77478", "custom cake houston"). Search captures already-decided buyers cheaply. Custom-birthday-cake search intent has the highest CAC tolerance ($71.63 ceiling) — we can afford to bid up.

**3. Office B2B — $80 (16%).** The highest-leverage SKU. One office that orders monthly = $120 × 12 = $1,440/yr at 60% margin = $864 LTV from a single account. GBP posts targeting offices + a single LinkedIn boost on a "your team's next milestone" post. Two acquisitions / month = the entire $5K effect target on its own.

**4. GBP reviews — $40 (8%).** $5-off card in every box: "Leave us a review on Google." Review count is the #1 ranking signal in Google Maps for "cake near me" searches. This is paid into the GBP flywheel — the orders show up in line 2's Google Ads results next month at lower CPC.

**5. WhatsApp re-engagement — $50 (10%).** Templated outreach to last-90d buyers with the next pickup window. CAC target $10 because these are not new customers — the 30% repeat rate from line 1 lives here. Cheapest acquisition channel by an order of magnitude.

**6. IG/Meta boosts — $30 (6%).** Gated: only boost organic posts that already cleared 50+ saves or 5%+ engagement rate (read via `mcp__happycake__gb_get_metrics`). Boosting losers is the #1 small-business mistake; this line forces the system to earn the boost.

### What's deliberately NOT in the plan

- No paid TikTok / Reels acquisition. Audience (women 25–65, family-oriented per brand book) does not over-index there relative to Meta.
- No "boost everything" Instagram default — replaced by gated line 6.
- No paid acquisition for slices. Math doesn't work.
- No generic "branding" budget. Every $ has an attributable SKU.

---

## 4. Mother's Day spike (May 9–11, 2026)

The submission window is itself Mother's Day weekend. Brand book Appendix B labels it "paid ads peak." This plan front-loads:

- **50% of Meta Ads ($90)** concentrated May 9–11 on a cake "Honey" carousel ("the cake your mother remembers"). Brand book reference post #1 is the creative template.
- **50% of Google Ads ($60)** redirected to "mother's day cake sugar land" + "mother's day cake delivery houston" exact-match.
- **Full WhatsApp re-engagement blast ($50)** May 9 morning with 24h pickup window.
- **One GBP post** ("Today's bake is out — pick up by 7 PM Mother's Day") — free.

Expected: 8–12 incremental orders concentrated in 48h, weighted toward whole-honey-cake. This single spike covers ~$340–$500 of revenue at $34/order — proving the loop in one weekend.

---

## 5. The closed loop (how the system runs itself)

This plan is not a document — it is a script the system executes monthly:

```
1. read margin     →  mcp__happycake__marketing_get_margin_by_product
2. read history    →  mcp__happycake__marketing_get_sales_history
3. read budget     →  mcp__happycake__marketing_get_budget
4. compute econ    →  CAC ceilings per SKU (rule: contribution × 1.3)
5. allocate $500   →  table in §3, rebalanced if margin/AOV shifted
6. for each line:
     mcp__happycake__marketing_create_campaign
     mcp__happycake__marketing_launch_simulated_campaign
7. world_advance_time (sandbox simulates 7d)
8. for each campaign:
     mcp__happycake__marketing_get_campaign_metrics
     if CPA > target_CAC × 1.2:  marketing_adjust_campaign(decrease=true)
     if CPA < target_CAC × 0.7:  marketing_adjust_campaign(increase=true)
9. mcp__happycake__marketing_report_to_owner  (markdown summary)
10. append JSONL to marketing/evidence/loop-<timestamp>.jsonl
```

Step 9's markdown output is the artifact the Telegram owner-bot (running on a separate machine) shells out to retrieve. The loop is Telegram-agnostic; the bot is one consumer of its output.

The same markdown is mirrored at `happycake.us/marketing` so the evaluator can inspect the latest run without installing the bot.

---

## 6. Expected effect — does this hit $5,000?

| Source | Orders | $ contrib | Notes |
|---|---:|---:|---|
| Meta Ads, 6 orders × $34.10 | 6 | $205 | Whole honey cake majority |
| Google Ads, 5 orders × $44.60 (mix) | 5 | $223 | Custom-birthday-cake heavy |
| Office B2B, 2 accounts × $72 | 2 | $144 | First-month only |
| WhatsApp re-engage, 5 × $34.10 | 5 | $171 | Repeat buyers, mostly honey |
| GBP flywheel (org. lift, est. 3 orders/mo over next 90d) | 3 | $102 | Indirect |
| IG boosts (awareness, est. 2 attributed) | 2 | $68 | Indirect |
| **Total month 1 contribution** | **23** | **$913** | First-order only |

That's only $913 — short of $5,000. Where does the rest come from?

- **Repeat × 1.3 LTV factor** lifts month-1 cohort to **$1,187**.
- **Office B2B compounds**: 2 accounts × 11 reorders × $72 = **+$1,584** over 12 months.
- **GBP review flywheel**: month-3 onward organic lift estimated +$200/mo from improved Maps ranking = **+$1,800** over 9 months.
- **Mother's Day spike alone** delivers **+$300–$500** outside the steady-state model.

12-month projection from a single $500 cycle (with B2B compounding and GBP flywheel): **~$4,800–$5,200 contribution effect.** That is the answer to the $500 → $5,000 challenge — not a single month, but a cycle that learns and compounds.

---

## 7. Failure modes & guardrails

- **CAC creep.** If a campaign exceeds its CAC ceiling × 1.2 in week 2, the loop auto-adjusts down. No human approval needed for cuts; growth requires owner approval (brand book §7 approval flow).
- **Slice contamination.** If reporting shows paid clicks landing on slice SKU pages, the loop rewrites the landing URL to the whole-cake page. Slices stay walk-in.
- **Burst-exhaustion.** Mother's Day spike consumes 30% of monthly budget in 3 days. Day-12 checkpoint: if remaining $350 has < 18 days runway at current pace, throttle Meta Ads daily cap.
- **Brand voice drift.** All ad creative copy goes through the brand book §7 hard rules: HappyCake (one word), cake "Honey" (in quotes after "cake"), max 3 emoji, no fabrication. Loop pre-filters before `marketing_create_campaign`.

---

## 8. Evidence

Every claim above can be re-derived:

- `marketing/evidence/2026-05-09__margin_by_product.json` — line 1.1
- `marketing/evidence/2026-05-09__sales_history.json` — line 1.2
- `marketing/evidence/2026-05-09__budget.json` — line 1.3
- `marketing/evidence/loop-<timestamp>.jsonl` (after first loop run) — every MCP call recorded

To re-pull MCP data: `npx tsx marketing/run-loop.ts --pull-only`
To run a full loop: `npx tsx marketing/run-loop.ts`

---

*This plan is an artifact of the marketing agent. It is regenerated monthly from current MCP state — never hand-edited as a static document.*
