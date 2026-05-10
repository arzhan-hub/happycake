import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const base = `https://${BRAND.domain}`;
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
