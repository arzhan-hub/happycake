import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { CATALOG } from "@/lib/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${BRAND.domain}`;
  const now = new Date();
  const staticRoutes = ["", "/menu", "/order", "/about", "/visit", "/policies"];
  return [
    ...staticRoutes.map((p) => ({
      url: `${base}${p}`,
      lastModified: now,
    })),
    ...CATALOG.map((c) => ({
      url: `${base}/menu/${c.slug}`,
      lastModified: now,
    })),
  ];
}
