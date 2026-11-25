import type { MetadataRoute } from "next";
import { siteUrl } from "@/env";

// Public pages only. Add new marketing pages here (and to PUBLIC_ROUTES in the auth proxy).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/`, changeFrequency: "weekly", priority: 1 }];
}
