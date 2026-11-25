/**
 * Style candidates live in src/styles/candidates/ while /styleguide/compare shows them, and are
 * reset to these exact contents afterwards. The committed state is always this (a unit test checks),
 * so candidates never ship. Format of each file: docs/theming.md, "Comparing styles".
 */
export const CANDIDATES_DIR = "src/styles/candidates";

export const EMPTY_CANDIDATE_FILES: Record<string, string> = {
  "index.ts": `/**
 * Style candidates shown on /styleguide/compare (dev only, STYLE_PREVIEW=1). Generated while
 * choosing a style, then reset with \`pnpm style:reset\`. Never commit candidates. See docs/theming.md.
 */
export type StyleCandidate = {
  /** Lowercase letter: scopes the CSS as [data-theme-preview="<id>"]. */
  id: string;
  name: string;
  /** One line: what makes this direction different. */
  summary: string;
};

export const candidates: StyleCandidate[] = [];
`,
  "candidates.css": `/*
 * Scoped token overrides for /styleguide/compare, one block per candidate:
 *   [data-theme-preview="a"] { --primary: …; }              light tokens
 *   .dark [data-theme-preview="a"] { --primary: …; }        dark tokens
 *   [data-theme-preview="a"] [data-slot="button"] { … }     variant previews
 * Empty when no comparison is running. See docs/theming.md.
 */
`,
  "fonts.ts": `// next/font loaders for style candidates. Kept apart from ./index.ts, which must stay importable
// outside Next (pnpm style:check). Maps candidate id -> next/font classNames (sans, heading, mono).
export const candidateFonts: Record<string, string> = {};
`,
};
