// next/font loaders for style candidates. Kept apart from ./index.ts, which must stay importable
// outside Next (pnpm style:check). Maps candidate id -> next/font classNames (sans, heading, mono).
export const candidateFonts: Record<string, string> = {};
