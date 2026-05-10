// /marketing — public mirror of the latest $500 marketing loop run.
// Reads JSON evidence files written by marketing/run-loop.mjs.
// Server component: no client JS, no library — straight TSX rendering.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Margin = {
  productId: string;
  name: string;
  priceUsd: number;
  estimatedMarginPct: number;
};

type SalesMonth = {
  month: string;
  revenueUsd: number;
  orders: number;
  avgTicketUsd: number;
};

type Budget = {
  monthlyBudgetUsd: number;
  targetEffectUsd: number;
  challenge: string;
};

type Metrics = {
  impressions?: number;
  clicks?: number;
  leads?: number;
  orders?: number;
  projectedRevenueUsd?: number;
  derivedCpa?: number;
};

type Campaign = {
  line: number;
  name: string;
  channel: string;
  budgetUsd: number;
  targetSku: string;
  targetCac: number | null;
  campaignId: string | null;
  launched: boolean;
  metrics: Metrics | null;
  adjustment: string | null;
};

type LoopJson = {
  stamp: string;
  budget: Budget;
  campaigns: Campaign[];
};

const EVIDENCE = path.join(process.cwd(), "..", "marketing", "evidence");

async function readJson<T>(filename: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(EVIDENCE, filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default async function MarketingPage() {
  const [margin, sales, budget, loop] = await Promise.all([
    readJson<Margin[]>("latest__margin_by_product.json"),
    readJson<SalesMonth[]>("latest__sales_history.json"),
    readJson<Budget>("latest__budget.json"),
    readJson<LoopJson>("latest__loop.json"),
  ]);

  const totalProj =
    loop?.campaigns.reduce(
      (s, c) => s + (c.metrics?.projectedRevenueUsd ?? 0),
      0,
    ) ?? 0;
  const totalOrders =
    loop?.campaigns.reduce((s, c) => s + (c.metrics?.orders ?? 0), 0) ?? 0;

  return (
    <main className="bg-cream-50 text-text-primary">
      {/* Header */}
      <section className="bg-happy-blue-900 text-text-on-blue">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-widest text-cream-200/80">
            ◆ HappyCake · {BRAND.city}
          </p>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl">
            $500 a month, working like $5,000.
          </h1>
          <p className="mt-6 max-w-2xl text-cream-200/90 leading-relaxed">
            Every dollar in our marketing budget is tied to a SKU, a CAC ceiling,
            and a sandbox-verified campaign. This page is the live mirror of the
            latest run by our marketing agent.
          </p>
          {budget && (
            <div className="mt-8 inline-flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-cream-200/30 px-5 py-3 text-sm">
              <span>
                Budget: <strong>${budget.monthlyBudgetUsd}/mo</strong>
              </span>
              <span>
                Target effect: <strong>${budget.targetEffectUsd.toLocaleString()}</strong>
              </span>
              <span className="text-cream-200/70">{budget.challenge}</span>
            </div>
          )}
        </div>
      </section>

      {/* Loop summary */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {!loop ? (
          <p className="text-text-primary/70">
            No loop run found. Execute{" "}
            <code className="bg-cream-100 px-1 rounded">node marketing/run-loop.mjs</code>
            from the project root to populate this page.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <Stat label="Latest run" value={loop.stamp} mono />
              <Stat label="Orders this cycle" value={fmt(totalOrders)} />
              <Stat
                label="Projected revenue"
                value={`$${fmt(totalProj)}`}
                accent={totalProj >= (budget?.targetEffectUsd ?? 5000)}
              />
            </div>

            <h2 className="font-display text-2xl mb-4">Channel allocation</h2>
            <div className="overflow-x-auto rounded-md border border-happy-blue-700/15 bg-bakery-white">
              <table className="w-full text-sm">
                <thead className="bg-cream-100 text-text-primary/70">
                  <tr>
                    <Th>#</Th>
                    <Th>Campaign</Th>
                    <Th>Channel</Th>
                    <Th align="right">Budget</Th>
                    <Th>Target SKU</Th>
                    <Th align="right">Tgt CAC</Th>
                    <Th align="right">Orders</Th>
                    <Th align="right">CPA</Th>
                    <Th align="right">Proj rev</Th>
                  </tr>
                </thead>
                <tbody>
                  {loop.campaigns.map((c) => (
                    <tr key={c.campaignId ?? c.line} className="border-t border-happy-blue-700/10">
                      <Td>{c.line}</Td>
                      <Td>{c.name}</Td>
                      <Td>
                        <span className="px-2 py-0.5 text-xs rounded bg-happy-blue-200 text-happy-blue-900">
                          {c.channel}
                        </span>
                      </Td>
                      <Td align="right">${c.budgetUsd}</Td>
                      <Td>{c.targetSku}</Td>
                      <Td align="right">{c.targetCac ?? "n/a"}</Td>
                      <Td align="right">{fmt(c.metrics?.orders)}</Td>
                      <Td align="right">
                        {c.metrics?.derivedCpa != null
                          ? `$${c.metrics.derivedCpa}`
                          : "—"}
                      </Td>
                      <Td align="right">
                        ${fmt(c.metrics?.projectedRevenueUsd)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-happy-blue-700/20 bg-cream-100/60 font-medium">
                    <Td colSpan={3}>Totals</Td>
                    <Td align="right">${loop.budget.monthlyBudgetUsd}</Td>
                    <Td colSpan={3} align="right">
                      {totalOrders} orders
                    </Td>
                    <Td align="right">—</Td>
                    <Td align="right">${fmt(totalProj)}</Td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {loop.campaigns.some((c) => c.adjustment) && (
              <div className="mt-10">
                <h2 className="font-display text-2xl mb-4">
                  Adjustments this cycle
                </h2>
                <ul className="space-y-2 text-sm">
                  {loop.campaigns
                    .filter((c) => c.adjustment)
                    .map((c) => (
                      <li
                        key={c.campaignId}
                        className="border-l-2 border-happy-blue-700 pl-3"
                      >
                        <strong>{c.name}</strong> — {c.adjustment}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Inputs section */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl mb-4">Inputs (sandbox MCP)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {margin && (
            <div>
              <h3 className="font-medium mb-3 text-text-primary/80">
                Margin per SKU
              </h3>
              <table className="w-full text-sm bg-bakery-white border border-happy-blue-700/15 rounded">
                <thead className="bg-cream-100 text-text-primary/70">
                  <tr>
                    <Th>SKU</Th>
                    <Th align="right">Price</Th>
                    <Th align="right">Margin</Th>
                    <Th align="right">Contrib</Th>
                  </tr>
                </thead>
                <tbody>
                  {margin.map((p) => (
                    <tr
                      key={p.productId}
                      className="border-t border-happy-blue-700/10"
                    >
                      <Td>{p.name}</Td>
                      <Td align="right">${p.priceUsd}</Td>
                      <Td align="right">{p.estimatedMarginPct}%</Td>
                      <Td align="right">
                        ${(p.priceUsd * p.estimatedMarginPct / 100).toFixed(2)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sales && (
            <div>
              <h3 className="font-medium mb-3 text-text-primary/80">
                Sales history (6 months)
              </h3>
              <table className="w-full text-sm bg-bakery-white border border-happy-blue-700/15 rounded">
                <thead className="bg-cream-100 text-text-primary/70">
                  <tr>
                    <Th>Month</Th>
                    <Th align="right">Revenue</Th>
                    <Th align="right">Orders</Th>
                    <Th align="right">AOV</Th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((m) => (
                    <tr
                      key={m.month}
                      className="border-t border-happy-blue-700/10"
                    >
                      <Td>{m.month}</Td>
                      <Td align="right">${fmt(m.revenueUsd)}</Td>
                      <Td align="right">{m.orders}</Td>
                      <Td align="right">${m.avgTicketUsd.toFixed(2)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-10 rounded-md bg-cream-100 p-5 text-sm leading-relaxed text-text-primary/80">
          <p>
            <strong>How this page stays honest:</strong> every number above is
            read from <code>marketing/evidence/</code> JSON files written by the
            sandbox MCP. The full plan with rationale, CAC math, and Mother&apos;s
            Day spike is in <code>marketing/plan.md</code>. The latest run&apos;s
            full markdown report and JSONL trail of MCP calls live alongside.
          </p>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${accent ? "border-happy-blue-700 bg-happy-blue-200/30" : "border-happy-blue-700/15 bg-bakery-white"}`}
    >
      <div className="text-xs uppercase tracking-wide text-text-primary/60">
        {label}
      </div>
      <div
        className={`mt-1 text-xl ${mono ? "font-mono text-sm" : "font-display"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-medium text-xs uppercase tracking-wide ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </td>
  );
}
