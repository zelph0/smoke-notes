/**
 * Style candidates shown on /styleguide/compare (dev only, STYLE_PREVIEW=1). Generated while
 * choosing a style, then reset with `pnpm style:reset`. Never commit candidates. See docs/theming.md.
 */
export type StyleCandidate = {
  /** Lowercase letter: scopes the CSS as [data-theme-preview="<id>"]. */
  id: string;
  name: string;
  /** One line: what makes this direction different. */
  summary: string;
};

export const candidates: StyleCandidate[] = [];
