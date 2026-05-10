import { BRAND } from "@/lib/brand";
import { CATALOG, CATEGORIES } from "@/lib/catalog";

export const dynamic = "force-static";

export async function GET() {
  const body = {
    brand: "HappyCake",
    location: BRAND.city,
    domain: BRAND.domain,
    currency: "USD",
    updatedAt: new Date().toISOString().slice(0, 10),
    categories: CATEGORIES,
    products: CATALOG.map((p) => ({
      slug: p.slug,
      url: `https://${BRAND.domain}/menu/${p.slug}`,
      name: p.name,
      shortName: p.shortName,
      category: p.category,
      priceUsd: p.priceCents / 100,
      priceCents: p.priceCents,
      weight: p.weight,
      serves: p.serves,
      leadTimeHours: p.leadTimeHours,
      approvalRequired: p.approvalRequired,
      image: p.image,
      gallery: p.gallery,
      blurb: p.blurb,
      ingredients: p.ingredients,
      allergens: p.allergens,
      pos: {
        squareItemId: p.squareItemId,
        variationId: p.variationId,
      },
    })),
  };

  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
