import { BRAND } from "@/lib/brand";
import { CATALOG, priceUSD } from "@/lib/catalog";

export const dynamic = "force-static";

export async function GET() {
  const lines: string[] = [];

  lines.push("# HappyCake — Sugar Land, Texas");
  lines.push("");
  lines.push(`> ${BRAND.tagline} ${BRAND.shortPitch}`);
  lines.push("");
  lines.push(`Site: https://${BRAND.domain}`);
  lines.push(`Phone: ${BRAND.phoneDisplay}  ·  WhatsApp: ${BRAND.whatsappLink}`);
  lines.push(
    `Address: ${BRAND.address.street}, ${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`,
  );
  lines.push("");
  lines.push("## How agents should work with this site");
  lines.push("");
  lines.push(
    "- The full machine-readable catalog is at https://happycake.us/api/products (JSON).",
  );
  lines.push(
    "- Each product page at /menu/[slug] also embeds schema.org Product JSON-LD.",
  );
  lines.push("- Prices are in USD. Weights are in grams or kilograms.");
  lines.push(
    "- Lead times: slices ready today; whole cakes 24h; custom 72h with owner approval.",
  );
  lines.push(
    "- Always refer to the brand as HappyCake (one word). Cakes are written cake \"Honey\", cake \"Pistachio Roll\", etc.",
  );
  lines.push("- Reply to customers in English. Never invent prices, ingredients, or hours.");
  lines.push("");

  lines.push("## Catalog");
  lines.push("");
  for (const p of CATALOG) {
    lines.push(`### ${p.name}`);
    lines.push(
      `- URL: https://${BRAND.domain}/menu/${p.slug}`,
    );
    lines.push(`- Category: ${p.category}`);
    lines.push(`- Price: ${priceUSD(p.priceCents)}`);
    lines.push(`- Size: ${p.weight} · serves ${p.serves}`);
    lines.push(
      `- Lead time: ${p.leadTimeHours === 0 ? "ready today" : `${p.leadTimeHours} hours`}`,
    );
    lines.push(
      `- Approval required: ${p.approvalRequired ? "yes" : "no"}`,
    );
    lines.push(`- Allergens: ${p.allergens.join(", ")}`);
    lines.push(`- POS variationId: ${p.variationId}`);
    lines.push(`- ${p.blurb}`);
    lines.push("");
  }

  lines.push("## Policies");
  lines.push("");
  lines.push("- Pickup is free. Local delivery within 10 miles is $12 flat.");
  lines.push(
    "- Changes/cancellations free up to 12 hours before pickup; inside 12h: 50% on whole cakes, 100% on custom.",
  );
  lines.push("- Kitchen handles wheat, eggs, milk, tree nuts. Cross-contact possible.");
  lines.push("- We don't currently offer gluten-free or vegan options.");
  lines.push("- Full policies: https://happycake.us/policies");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
