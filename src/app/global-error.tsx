"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Replaces the root layout when it fails, so it renders its own <html> and stays dependency-light.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please try again. If it keeps happening, come back in a few minutes.</p>
        <button type="button" onClick={() => retry()} style={{ padding: "0.5rem 1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
