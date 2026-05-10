import { NextResponse } from "next/server";

// Proxies the on-site chat widget to the HappyCake wrapper's /api/chat
// endpoint. The wrapper runs Claude in headless mode against the
// project-root sales-agent prompts and the hosted MCP simulator, then
// returns the customer-facing reply. The wrapper is the single source of
// truth for brand voice, tool authorization, and owner escalation.

const WRAPPER_BASE_URL = process.env.WRAPPER_BASE_URL?.replace(/\/$/, "");

export async function POST(req: Request) {
  if (!WRAPPER_BASE_URL) {
    console.error("[agent] WRAPPER_BASE_URL is not set in .env.local");
    return NextResponse.json(
      { reply: "Sorry, my brain isn't connected right now. Please try again in a minute." },
      { status: 500 },
    );
  }

  let payload: { message?: string; history?: unknown[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (payload.message ?? "").toString().trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  const history = Array.isArray(payload.history) ? payload.history : [];

  try {
    const r = await fetch(`${WRAPPER_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
      // Claude turns can take ~30s; allow a generous timeout via an
      // AbortController so the storefront doesn't hang indefinitely.
      signal: AbortSignal.timeout(120_000),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error(`[agent] wrapper ${r.status}: ${detail.slice(0, 300)}`);
      return NextResponse.json({
        reply: "Sorry, the kitchen is a bit busy right now. Try again in a moment.",
      });
    }

    const data = await r.json();
    return NextResponse.json({
      reply: data.reply ?? "(no answer)",
      escalated: !!data.escalated,
      escalationType: data.escalation_type ?? null,
    });
  } catch (err) {
    console.error("[agent] proxy error:", err);
    return NextResponse.json({
      reply: "Connection error. Give us a moment and try again.",
    });
  }
}
