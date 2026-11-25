import * as Sentry from "@sentry/nextjs";

/**
 * Report an unexpected error (logs + Sentry when a DSN is configured) and return a short
 * reference the UI can show. Use for failures the user can't fix; validation problems are
 * returned as ActionResult field errors instead.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): string {
  const eventId = Sentry.captureException(error, context ? { extra: context } : undefined);
  console.error("[app] unexpected error", { eventId, ...context }, error);
  return eventId;
}
