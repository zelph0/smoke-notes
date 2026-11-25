import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";
import { env } from "@/env";

/**
 * Neon Auth (managed Better Auth). Users and sessions live in the `neon_auth` schema of the
 * current Neon branch, so every preview branch has its own users. See docs/decisions/0002-neon-auth.md.
 */
export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: { secret: env.NEON_AUTH_COOKIE_SECRET },
  logLevel: env.NODE_ENV === "test" ? "silent" : "warn",
});
