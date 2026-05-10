import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";

// Proxies the storefront order form to the HappyCake wrapper's
// /api/orders endpoint. The wrapper handles capacity / lead-time
// validation, the custom-work approval gate, square_create_order
// + kitchen_create_ticket, evidence files, and Telegram owner pushes.

const WRAPPER_BASE_URL = process.env.WRAPPER_BASE_URL?.replace(/\/$/, "");

function normalizePickupAt(input: string): string {
  // Already ISO-with-Z? Pass through.
  if (/T.*Z$/.test(input)) return input;
  // Date constructor handles both `YYYY-MM-DD` (UTC midnight) and
  // `YYYY-MM-DDTHH:MM` (local TZ). The storefront's order form should
  // produce a full datetime; raw date-only strings will land at UTC
  // midnight, which the wrapper will likely reject as too soon and
  // auto-suggest a viable time — that's fine.
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid date: ${input}`);
  }
  return d.toISOString();
}

export async function POST(req: Request) {
  if (!WRAPPER_BASE_URL) {
    console.error("[order] WRAPPER_BASE_URL is not set in .env.local");
    return NextResponse.json(
      { error: "Storefront is not configured to reach the kitchen." },
      { status: 500 },
    );
  }

  let body: {
    product?: string;
    name?: string;
    phone?: string;
    email?: string;
    date?: string;
    notes?: string;
    quantity?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { product, name, phone, email, date, notes } = body;
  const quantity = Math.max(1, Math.min(20, Number(body.quantity ?? 1)));

  if (!product || !name || !phone || !date) {
    return NextResponse.json(
      { error: "Missing required fields: product, name, phone, date." },
      { status: 400 },
    );
  }

  const item = CATALOG.find((p) => p.slug === product);
  if (!item) {
    return NextResponse.json(
      { error: `Unknown product slug: ${product}` },
      { status: 400 },
    );
  }

  let pickupAt: string;
  try {
    pickupAt = normalizePickupAt(date);
  } catch {
    return NextResponse.json(
      { error: "Invalid pickup date — could not parse." },
      { status: 400 },
    );
  }

  const wrapperPayload = {
    items: [{ variationId: item.variationId, quantity }],
    customer: {
      name,
      phone,
      ...(email ? { email } : {}),
    },
    pickup_at: pickupAt,
    ...(notes ? { notes } : {}),
  };

  try {
    const r = await fetch(`${WRAPPER_BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrapperPayload),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    console.error("[order] proxy error:", err);
    return NextResponse.json(
      { error: "Could not reach the kitchen. Please try again in a minute." },
      { status: 502 },
    );
  }
}
