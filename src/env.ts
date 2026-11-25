import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { authEnv } from "./modules/auth/env"; // @auth-module

/**
 * Typed, validated environment. Import `env` instead of reading `process.env`.
 * next.config.ts imports this file, so `next build` fails when a required var is missing.
 * Set SKIP_ENV_VALIDATION=1 only for lint/typecheck jobs that never run the app.
 */
export const env = createEnv({
  extends: [authEnv], // @auth-module
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Pooled Neon URL used by the app at runtime (Prisma + Neon adapter).
    DATABASE_URL: z.url(),
    // Direct (unpooled) URL used only by the Prisma CLI for migrations.
    DATABASE_URL_UNPOOLED: z.url().optional(),
    SENTRY_DSN: z.url().optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/** Absolute site URL for metadata, OG images and auth callbacks. */
export function siteUrl(): string {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
