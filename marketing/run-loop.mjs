#!/usr/bin/env node
// HappyCake monthly $500 marketing loop.
//
// Reads sandbox MCP for margin/sales/budget, allocates the budget across six
// channels per marketing/plan.md, creates and launches simulated campaigns,
// advances the world clock, reads metrics, adjusts under-performers, and
// writes a markdown report + JSONL evidence trail.
//
// Usage:
//   node marketing/run-loop.mjs              # full loop
//   node marketing/run-loop.mjs --pull-only  # refresh evidence JSONs only
//   node marketing/run-loop.mjs --dry-run    # plan only, no MCP writes
//
// Env: SBC_TEAM_TOKEN (defaults to sandbox dev token in mcp-client.mjs)

import { mcpCall } from "./mcp-client.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.join(HERE, "evidence");

const args = new Set(process.argv.slice(2));
const PULL_ONLY = args.has("--pull-only");
const DRY_RUN = args.has("--dry-run");

const REPEAT_FACTOR = 1.3; // contribution × this = CAC ceiling

// Plan from marketing/plan.md §3, expressed as data so the loop can execute it.
const ALLOCATION = [
  {
    line: 1,
    name: "MotherDay Honey IG Carousel — Sugar Land 8mi",
    channel: "instagram",
    budgetUsd: 180,
    targetSku: "whole-honey-cake",
    targetCac: 30,
    objective:
      "Drive whole-honey-cake orders for Mother's Day from local IG audience.",
    targetAudience:
      "Women 25-65 with families inside 8mi of Sugar Land (ZIP 77478, 77479, 77498). Mother's Day shoppers, IG engagers, parents.",
    offer:
      "Order cake \"Honey\" for Mother's Day pickup — same-day available through Sunday.",
    landingPath: "/menu/whole-honey-cake",
  },
  {
    line: 2,
    name: "Google Search — Custom + Birthday Cake Sugar Land",
    channel: "google_local",
    budgetUsd: 120,
    targetSku: "custom-birthday-cake",
    targetCac: 25,
    objective:
      "Capture high-intent local search for custom and birthday cakes.",
    targetAudience:
      "Sugar Land + Houston metro, branded queries, 'cake delivery sugar land', 'birthday cake near me 77478', 'mother's day cake houston'.",
    offer: "Order online for next-day pickup or delivery in Sugar Land.",
    landingPath: "/menu/custom-birthday-cake",
  },
  {
    line: 3,
    name: "Office Dessert Box — Mixed Outreach",
    channel: "mixed",
    budgetUsd: 80,
    targetSku: "office-dessert-box",
    targetCac: 40,
    objective:
      "Acquire B2B office accounts with high LTV (monthly reorder pattern).",
    targetAudience:
      "Office managers and HR leads at Sugar Land / Houston companies (50+ employees) celebrating team milestones.",
    offer:
      "Office dessert box for your team — assorted, allergen-tagged, ready by 10am.",
    landingPath: "/menu/office-dessert-box",
  },
  {
    line: 4,
    name: "GBP Review Generation — $5 Off Card",
    channel: "google_local",
    budgetUsd: 40,
    targetSku: "flywheel",
    targetCac: null, // CPM-style, indirect
    objective:
      "Lift Google Maps ranking via review volume; flywheel for line 2.",
    targetAudience: "All HappyCake Sugar Land buyers, last 30 days.",
    offer:
      "Leave us a Google review and get $5 off your next cake. Card included in every box.",
    landingPath: "/policies",
  },
  {
    line: 5,
    name: "WhatsApp Re-engagement — Past 90d Buyers",
    channel: "whatsapp",
    budgetUsd: 50,
    targetSku: "whole-honey-cake",
    targetCac: 10,
    objective:
      "Reactivate proven buyers for Mother's Day weekend pickup window.",
    targetAudience:
      "Customers who placed an order in the last 90 days, opted in to WhatsApp.",
    offer:
      "Cake \"Honey\" is on the counter for Mother's Day. Reply HONEY to reserve.",
    landingPath: "/menu/whole-honey-cake",
  },
  {
    line: 6,
    name: "IG Organic Boost — Gated by Engagement Floor",
    channel: "instagram",
    budgetUsd: 30,
    targetSku: "awareness",
    targetCac: null,
    objective:
      "Amplify only posts that already cleared 50+ saves or 5% engagement.",
    targetAudience:
      "Lookalikes of top-performing post engagers, 8mi radius Sugar Land.",
    offer:
      "Behind the scenes at HappyCake Sugar Land — Tuesday morning bake.",
    landingPath: "/about",
  },
];

const totalAlloc = ALLOCATION.reduce((s, c) => s + c.budgetUsd, 0);
if (totalAlloc !== 500) {
  throw new Error(`Allocation sums to $${totalAlloc}, expected $500.`);
}

// ─── helpers ───────────────────────────────────────────────────────────────

const evidence = [];
function logEvidence(event) {
  evidence.push({ ts: new Date().toISOString(), ...event });
  // Compact one-line per event for terminal visibility
  console.log(`· ${event.kind} ${event.name ?? ""} ${event.detail ?? ""}`.trim());
}

async function safeMcp(toolName, args = {}) {
  try {
    const result = await mcpCall(toolName, args);
    logEvidence({ kind: "mcp_ok", name: toolName, args, result });
    return { ok: true, result };
  } catch (err) {
    logEvidence({ kind: "mcp_err", name: toolName, args, error: err.message });
    return { ok: false, error: err.message };
  }
}

function extractCampaignId(result) {
  if (!result || typeof result !== "object") return null;
  return (
    result.campaignId ??
    result.id ??
    result.campaign?.id ??
    result.campaign?.campaignId ??
    result.data?.campaignId ??
    result.data?.id ??
    null
  );
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`HappyCake marketing loop — ${stamp}`);
  console.log(
    `Mode: ${PULL_ONLY ? "PULL_ONLY" : DRY_RUN ? "DRY_RUN" : "FULL"}\n`,
  );

  // ── Step 1-3: Pull source-of-truth from MCP
  const margin = await safeMcp("marketing_get_margin_by_product");
  const sales = await safeMcp("marketing_get_sales_history");
  const budget = await safeMcp("marketing_get_budget");

  if (margin.ok)
    await writeFile(
      path.join(EVIDENCE_DIR, "latest__margin_by_product.json"),
      JSON.stringify(margin.result, null, 2),
    );
  if (sales.ok)
    await writeFile(
      path.join(EVIDENCE_DIR, "latest__sales_history.json"),
      JSON.stringify(sales.result, null, 2),
    );
  if (budget.ok)
    await writeFile(
      path.join(EVIDENCE_DIR, "latest__budget.json"),
      JSON.stringify(budget.result, null, 2),
    );

  if (PULL_ONLY) {
    console.log("\nPull-only mode complete. Evidence refreshed.");
    return;
  }

  // ── Step 4: Compute econ + CAC ceilings (sanity-check the plan)
  const econ = (margin.ok ? margin.result : []).map((p) => ({
    productId: p.productId,
    name: p.name,
    contribution: +(p.priceUsd * (p.estimatedMarginPct / 100)).toFixed(2),
    cacCeiling: +(
      p.priceUsd *
      (p.estimatedMarginPct / 100) *
      REPEAT_FACTOR
    ).toFixed(2),
  }));
  logEvidence({ kind: "econ_computed", detail: `${econ.length} SKUs`, result: econ });

  // ── Step 5-6: Create + launch each campaign
  const campaigns = [];
  for (const line of ALLOCATION) {
    if (DRY_RUN) {
      campaigns.push({ ...line, campaignId: `dry-${line.line}`, launched: false });
      continue;
    }
    const created = await safeMcp("marketing_create_campaign", {
      name: line.name,
      channel: line.channel,
      objective: line.objective,
      budgetUsd: line.budgetUsd,
      targetAudience: line.targetAudience,
      offer: line.offer,
      landingPath: line.landingPath,
    });
    if (!created.ok) {
      campaigns.push({ ...line, campaignId: null, error: created.error });
      continue;
    }
    const campaignId = extractCampaignId(created.result);
    if (!campaignId) {
      campaigns.push({
        ...line,
        campaignId: null,
        error: "no campaignId in response",
        rawCreate: created.result,
      });
      continue;
    }
    const launched = await safeMcp("marketing_launch_simulated_campaign", {
      campaignId,
      approvalNote: `Auto-approved by marketing loop per plan.md line ${line.line}.`,
    });
    campaigns.push({
      ...line,
      campaignId,
      launched: launched.ok,
      launchResult: launched.result,
    });
  }

  // ── Step 7: Advance world clock 7 days
  if (!DRY_RUN) {
    await safeMcp("world_advance_time", { minutes: 60 * 24 * 7 });
  }

  // ── Step 8: Read metrics + adjust under/over performers
  for (const c of campaigns) {
    if (!c.campaignId || c.campaignId.startsWith("dry-")) continue;
    const m = await safeMcp("marketing_get_campaign_metrics", {
      campaignId: c.campaignId,
    });
    // Sandbox returns metrics as [{...}] — normalize to a single object.
    const metricsObj = Array.isArray(m.result) ? m.result[0] : m.result;
    c.metrics = m.ok ? metricsObj : null;

    if (c.metrics?.orders > 0 && c.budgetUsd) {
      c.metrics.derivedCpa = +(c.budgetUsd / c.metrics.orders).toFixed(2);
    }

    if (m.ok && c.targetCac && c.metrics?.derivedCpa != null) {
      const cpa = c.metrics.derivedCpa;
      let adjustment = null;
      if (cpa > c.targetCac * 1.2) {
        adjustment = `CPA $${cpa} exceeds target $${c.targetCac} by >20%. Reduce daily cap, narrow audience.`;
      } else if (cpa < c.targetCac * 0.7) {
        adjustment = `CPA $${cpa} beats target $${c.targetCac} by >30%. Increase daily cap, expand lookalikes.`;
      }
      if (adjustment) {
        const adj = await safeMcp("marketing_adjust_campaign", {
          campaignId: c.campaignId,
          adjustment,
          expectedImpact:
            cpa > c.targetCac * 1.2
              ? "Lower spend, hold or improve CPA."
              : "Higher spend, hold acquisition cost.",
        });
        c.adjustment = adj.ok ? adjustment : null;
        c.adjustmentError = adj.ok ? null : adj.error;
      }
    }

    if (m.ok && c.campaignId) {
      const leads = await safeMcp("marketing_generate_leads", {
        campaignId: c.campaignId,
      });
      c.leads = leads.ok ? leads.result : null;
    }
  }

  // ── Step 9: Owner-facing report from MCP (sandbox truth) + our markdown
  const ownerReport = await safeMcp("marketing_report_to_owner");

  // ── Step 10: Write artifacts
  const jsonlPath = path.join(EVIDENCE_DIR, `loop-${stamp}.jsonl`);
  await writeFile(jsonlPath, evidence.map((e) => JSON.stringify(e)).join("\n"));

  const reportMd = renderReport({
    stamp,
    margin: margin.result,
    sales: sales.result,
    budget: budget.result,
    econ,
    campaigns,
    ownerReport: ownerReport.result,
  });
  const reportPath = path.join(EVIDENCE_DIR, `loop-${stamp}.md`);
  await writeFile(reportPath, reportMd);

  // Stable "latest" pointers for the website /marketing page to read.
  await writeFile(path.join(EVIDENCE_DIR, "latest__loop.md"), reportMd);
  await writeFile(
    path.join(EVIDENCE_DIR, "latest__loop.json"),
    JSON.stringify(
      {
        stamp,
        budget: budget.result,
        campaigns: campaigns.map((c) => ({
          line: c.line,
          name: c.name,
          channel: c.channel,
          budgetUsd: c.budgetUsd,
          targetSku: c.targetSku,
          targetCac: c.targetCac,
          campaignId: c.campaignId,
          launched: c.launched ?? false,
          metrics: c.metrics ?? null,
          adjustment: c.adjustment ?? null,
        })),
      },
      null,
      2,
    ),
  );

  console.log(`\n✓ Loop complete.`);
  console.log(`  Markdown: ${reportPath}`);
  console.log(`  Evidence: ${jsonlPath}`);
}

// ─── report rendering ──────────────────────────────────────────────────────

function renderReport({
  stamp,
  margin,
  sales,
  budget,
  econ,
  campaigns,
  ownerReport,
}) {
  const lines = [];
  lines.push(`# HappyCake $500 Marketing Loop — Run Report`);
  lines.push(``);
  lines.push(`**Run:** ${stamp}`);
  lines.push(
    `**Budget:** $${budget?.monthlyBudgetUsd ?? "?"} → target effect $${budget?.targetEffectUsd ?? "?"} (${budget?.challenge ?? "—"})`,
  );
  lines.push(``);
  lines.push(`## 1. Inputs (from sandbox MCP)`);
  lines.push(`### Margin per SKU`);
  lines.push(`| SKU | Price | Margin % | Contribution |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const p of margin ?? []) {
    lines.push(
      `| ${p.name} | $${p.priceUsd} | ${p.estimatedMarginPct}% | $${(p.priceUsd * p.estimatedMarginPct / 100).toFixed(2)} |`,
    );
  }
  lines.push(``);
  lines.push(`### Sales history (last 6 months)`);
  lines.push(`| Month | Revenue | Orders | AOV |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const m of sales ?? []) {
    lines.push(`| ${m.month} | $${m.revenueUsd.toLocaleString()} | ${m.orders} | $${m.avgTicketUsd.toFixed(2)} |`);
  }
  lines.push(``);
  lines.push(`## 2. Computed CAC ceilings`);
  lines.push(`(contribution × ${REPEAT_FACTOR} repeat factor)`);
  lines.push(``);
  lines.push(`| SKU | Contribution | CAC ceiling | Paid-acquirable? |`);
  lines.push(`|---|---:|---:|---|`);
  for (const e of econ) {
    const acquirable = e.cacCeiling >= 15 ? "Yes" : "No (organic/walk-in only)";
    lines.push(`| ${e.name} | $${e.contribution} | $${e.cacCeiling} | ${acquirable} |`);
  }
  lines.push(``);
  lines.push(`## 3. Channel allocation & live campaign state`);
  lines.push(``);
  lines.push(
    `| # | Campaign | Channel | $ | Target SKU | Tgt CAC | Imps | Clicks | Leads | Orders | CPA | Proj rev |`,
  );
  lines.push(
    `|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|`,
  );
  let totalProj = 0;
  let totalOrders = 0;
  for (const c of campaigns) {
    const m = c.metrics ?? {};
    const cpa = m.derivedCpa != null ? `$${m.derivedCpa}` : "—";
    const orders = m.orders ?? "—";
    const proj = m.projectedRevenueUsd ?? 0;
    totalProj += proj;
    totalOrders += typeof m.orders === "number" ? m.orders : 0;
    lines.push(
      `| ${c.line} | ${c.name} | ${c.channel} | $${c.budgetUsd} | ${c.targetSku} | ${c.targetCac ?? "n/a"} | ${m.impressions ?? "—"} | ${m.clicks ?? "—"} | ${m.leads ?? "—"} | ${orders} | ${cpa} | $${proj.toLocaleString()} |`,
    );
  }
  lines.push(``);
  lines.push(`**Totals:** ${totalOrders} orders · $${totalProj.toLocaleString()} projected revenue · target effect $${budget?.targetEffectUsd ?? 5000}.`);
  lines.push(``);
  lines.push(`## 4. Adjustments this cycle`);
  const adjusted = campaigns.filter((c) => c.adjustment);
  if (adjusted.length === 0) {
    lines.push(`No adjustments — all live campaigns within CAC tolerance band.`);
  } else {
    for (const c of adjusted) {
      lines.push(`- **${c.name}** — ${c.adjustment}`);
    }
  }
  lines.push(``);
  lines.push(`## 5. Owner report (from MCP \`marketing_report_to_owner\`)`);
  lines.push(``);
  lines.push("```json");
  lines.push(JSON.stringify(ownerReport ?? {}, null, 2));
  lines.push("```");
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(
    `*Generated by \`marketing/run-loop.mjs\`. Spec: \`marketing/plan.md\`. Evidence: this run's JSONL in the same folder.*`,
  );
  return lines.join("\n");
}

main().catch((err) => {
  console.error("Loop failed:", err);
  process.exit(1);
});
