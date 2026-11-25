import type { MetadataRoute } from "next";
import { siteUrl } from "@/env";

export default function robots(): MetadataRoute.Robots {
  // Only production is indexable; previews and dev are hidden from crawlers.
  const indexable = process.env.VERCEL_ENV === "production";
  return {
    rules: indexable
      ? { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
