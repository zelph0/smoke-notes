"use client";

import { ErrorState } from "@/components/error-state";

export default function TasksError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <ErrorState error={error} retry={retry} title="Your tasks didn't load" />
    </main>
  );
}
