import "@/styles/candidates/candidates.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { candidates } from "@/styles/candidates";
import { candidateFonts } from "@/styles/candidates/fonts";
import { PreviewSheet } from "./preview-sheet";

export const metadata: Metadata = { title: "Compare styles", robots: { index: false } };

/**
 * Style candidates side by side, each scoped with [data-theme-preview="<id>"] so they render
 * together without touching the real theme. Dev only: 404 unless STYLE_PREVIEW=1. The /new-app
 * styling step writes the candidates (src/styles/candidates/), `pnpm style:check` runs axe on
 * each one in light and dark, and `pnpm style:reset` removes them. See docs/theming.md.
 */
export default function CompareStylesPage() {
  if (process.env.STYLE_PREVIEW !== "1") notFound();

  return (
    <main id="main" className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-3xl">Compare styles</h1>
        <p className="text-muted-foreground">
          {candidates.length === 0
            ? "No candidates yet. The /new-app styling step writes them to src/styles/candidates/."
            : `${candidates.length} directions with the app's real components. Use the theme switch in the header for light and dark.`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {candidates.map((candidate) => (
          <section
            key={candidate.id}
            data-theme-preview={candidate.id}
            aria-labelledby={`candidate-${candidate.id}`}
            className={cn(
              candidateFonts[candidate.id],
              "flex flex-col gap-6 rounded-xl border-ui border-border bg-background p-6 font-sans text-foreground",
            )}
          >
            <header className="flex flex-col gap-1">
              <h2 id={`candidate-${candidate.id}`} className="font-heading text-xl">
                {candidate.id.toUpperCase()}. {candidate.name}
              </h2>
              <p className="text-muted-foreground text-sm">{candidate.summary}</p>
            </header>
            <PreviewSheet id={candidate.id} />
          </section>
        ))}
      </div>
    </main>
  );
}
