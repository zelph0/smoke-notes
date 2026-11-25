import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Env vars owned by the auth module. Merged into src/env.ts via `extends`. */
export const authEnv = createEnv({
  server: {
    // Per-branch Neon Auth endpoint. The Neon <> Vercel integration injects it for previews.
    NEON_AUTH_BASE_URL: z.url(),
    // Signs the session cookie cache. Generate with `openssl rand -base64 32`.
    NEON_AUTH_COOKIE_SECRET: z.string().min(32),
    // Optional: branded auth emails via Resend. Without these, Neon's shared sender is used.
    RESEND_API_KEY: z.string().startsWith("re_").optional(),
    EMAIL_FROM: z.string().min(3).optional(),
  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
