"use client";

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/observability";

type Props = {
  error: unknown;
  retry: () => void;
  title?: string;
};

/** Shared body for error.tsx boundaries: reports once, shows a calm message and a retry. */
export function ErrorState({ error, retry, title = "Something went wrong" }: Props) {
  useEffect(() => {
    reportError(error, { boundary: "segment" });
  }, [error]);

  const digest =
    typeof error === "object" && error && "digest" in error ? String((error as { digest: unknown }).digest) : null;

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <AlertTriangleIcon aria-hidden="true" className="size-8 text-destructive" />
      <h2 className="text-lg">{title}</h2>
      <p className="max-w-sm text-muted-foreground text-sm">
        We couldn't load this. It's probably temporary, so try again.
      </p>
      {digest ? <p className="font-mono text-muted-foreground text-xs">Reference: {digest}</p> : null}
      <Button variant="outline" onClick={() => retry()}>
        <RotateCcwIcon data-icon="inline-start" />
        Try again
      </Button>
    </div>
  );
}
