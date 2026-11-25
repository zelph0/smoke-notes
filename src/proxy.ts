// @auth-module: file (deleted by scripts/remove-auth.ts). Auth integration point: route protection.
import type { NextRequest } from "next/server";
import { proxy as authProxy } from "@/modules/auth/proxy";

// Next.js needs a function declared in this file (a re-export isn't detected).
export function proxy(request: NextRequest) {
  return authProxy(request);
}

// Must stay inline: Next.js reads `config` statically from this file.
export const config = {
  // Everything except static assets. The OAuth callback must pass through the proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
