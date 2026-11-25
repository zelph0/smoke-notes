import * as Sentry from "@sentry/nextjs";

// Server + edge error reporting. No DSN -> Sentry stays disabled (no-op in dev and CI).
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1,
  });
}

export const onRequestError = Sentry.captureRequestError;
