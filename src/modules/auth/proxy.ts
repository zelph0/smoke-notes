import type { NextRequest } from "next/server";
import { auth } from "@/modules/auth/server";

/**
 * Every page is PRIVATE unless listed here. Add marketing/public pages explicitly.
 * (Auth routes such as /auth/* and /api/auth/* are always public.)
 */
export const PUBLIC_ROUTES = [
  "/",
  "/styleguide",
  "/styleguide/compare",
  "/api/health",
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
];

const neonAuth = auth.middleware({ loginUrl: "/auth/sign-in", publicRoutes: PUBLIC_ROUTES });

export async function proxy(request: NextRequest) {
  const response = await neonAuth(request);

  // Remember where the user was going, so sign-in can send them back (sanitized by safeNext).
  const location = response.headers.get("location");
  if (location) {
    const target = new URL(location, request.url);
    if (target.pathname === "/auth/sign-in" && !target.searchParams.has("next")) {
      // Neon's middleware copies the original query onto the login URL; keep only `next`.
      target.search = "";
      target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      response.headers.set("location", target.toString());
    }
  }
  return response;
}
