# Theming

Every app gets its own visual style without forking components. A style is **tokens + variants**:
tokens set colour, shape, density, depth, motion and type. Variants set what components look like
beyond what tokens can express.

## What `/new-app` changes to restyle an app

1. **`src/styles/theme.css`**: rewrite the token values in `:root` (light) and `.dark`. Keep every
   variable name; components depend on them.
2. **`src/config/fonts.ts`**: pick fonts via `next/font/google` (or `next/font/local`). Keep the three
   exports and their CSS variable names (`--font-family-sans`, `--font-family-heading`, `--font-family-mono`).
3. **Component variants** in `src/components/ui/*` (optional, for personality): edit the `cva`
   variant strings, e.g. pill buttons, uppercase labels, underline inputs, solid vs. ghost defaults. Use
   tokens inside variants (`rounded-lg`, `h-control`, `border-ui`, `shadow-surface`), not raw values.
4. Verify on **`/styleguide`** in light and dark, then run `pnpm db:test && pnpm test:e2e` (axe checks
   contrast there, and in an open dialog).

`/new-app` doesn't guess one style: it generates several **candidates**, shows them side by side on
`/styleguide/compare`, and applies only the one the user picks (see "Comparing styles" below).

Nothing else should need to change. If a style needs a new token, add it to `theme.css`, map it
in `src/app/globals.css` (`@theme inline`) and show it on `/styleguide`.

## Comparing styles

`/styleguide/compare` renders the app's real components once per candidate:
- the Tasks list in every state;
- the task form with a validation error;
- a dialog;
- buttons, inputs and badges;
- the sign-in card.

Each candidate sits in its own `[data-theme-preview="<id>"]` scope, so several render together
without touching the real theme. The page is dev-only and 404s unless `STYLE_PREVIEW=1`.

| File (`src/styles/candidates/`) | Holds |
|---|---|
| `index.ts` | the list: `{ id, name, summary }` (no imports: `style:check` reads it outside Next) |
| `fonts.ts` | `next/font` loaders per candidate, exported as `candidateFonts[id]` classNames |
| `candidates.css` | scoped tokens (`[data-theme-preview=a]`, `.dark [data-theme-preview=a]`) and variant previews on `data-slot`s |

1. Write the candidates in the formats below.
2. Run `STYLE_PREVIEW=1 pnpm dev --port 3200` and open `/styleguide/compare`. Use the theme switch
   in the header for light and dark.
3. Run `STYLE_BASE_URL=http://localhost:3200 pnpm style:check`. It runs axe on each candidate in
   light and dark; nobody should see a failing one.
4. Apply the chosen candidate to `theme.css`, `fonts.ts` and the `cva` variants, then run
   `pnpm style:reset`. The folder's committed state is always empty, and a unit test fails CI
   otherwise.

The same flow restyles an existing app, or the template's own default look.

### Files (src/styles/candidates/)

#### `index.ts`: the list

Importable outside Next (`pnpm style:check` reads it), so no imports here.

```ts
export type StyleCandidate = { id: string; name: string; summary: string };

export const candidates: StyleCandidate[] = [
  { id: "a", name: "Soft & friendly", summary: "Warm coral primary, big radius, diffuse shadows, rounded type." },
  { id: "b", name: "Dense & technical", summary: "Tight controls, square corners, mono headings, flat borders." },
  { id: "c", name: "Editorial", summary: "Serif headings, borderless surfaces, underline buttons, ink-black neutrals." },
];
```

Ids are lowercase letters (`a`, `b`, …): they scope the CSS and label the options you show.

#### `fonts.ts`: one font set per candidate

`next/font/google` loaders; the variable names are fixed because the app maps them to
`font-sans`, `font-heading` and `font-mono`. Each candidate's classNames go on its preview scope.

```ts
import { DM_Sans, Fraunces } from "next/font/google";

const aSans = DM_Sans({ variable: "--font-family-sans", subsets: ["latin"] });
const aHeading = Fraunces({ variable: "--font-family-heading", subsets: ["latin"], weight: ["600"] });

export const candidateFonts: Record<string, string> = {
  a: [aSans.variable, aHeading.variable].join(" "),
};
```

Omit a family to keep the app's current one (e.g. no mono override). Every loader runs at
module load, so keep it to two or three families per candidate. Restart the preview server after
changing fonts.

#### `candidates.css`: tokens and variant previews, scoped

```css
[data-theme-preview="a"] {            /* light tokens */
  --background: oklch(0.985 0.01 60);
  --primary: oklch(0.55 0.17 30);
  --radius: 1rem;
  /* … */
}
.dark [data-theme-preview="a"] {      /* dark tokens: colours (and shadows) */
  --background: oklch(0.2 0.02 40);
  /* … */
}
[data-theme-preview="a"] [data-slot="button"] {   /* variant preview: pill buttons */
  border-radius: 9999px;
}
```

**Tokens.** Set the full colour list in BOTH light and dark blocks, or the app's defaults leak
through and a dark background ends up behind a light-mode primary (axe catches it, but it's
wasted round-trips). The names, all in `src/styles/theme.css`:

- Colour: `--background --foreground --card --card-foreground --popover --popover-foreground
  --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground
  --accent --accent-foreground --destructive --success --border --input --ring --chart-1..5
  --sidebar --sidebar-foreground --sidebar-primary --sidebar-primary-foreground --sidebar-accent
  --sidebar-accent-foreground --sidebar-border --sidebar-ring`. Use oklch, like the app.
- Shape `--radius --border-width` · Density `--control-height --control-height-sm
  --control-height-lg --surface-padding --surface-padding-sm` · Depth `--surface-shadow
  --overlay-shadow` · Motion `--motion-duration --motion-ease` · Type `--heading-tracking
  --heading-weight`.

Every `*-foreground` on its pair needs ≥ 4.5:1 contrast; `--muted-foreground` on `--background`
and `--card` is the usual failure, then `--primary` used as link text on `--background`.

**Variant previews.** Things tokens can't express (pill or uppercase buttons, underline inputs,
uppercase badges, flat cards) go in scoped rules on the components' `data-slot`s: `button`,
`badge`, `input`, `textarea`, `checkbox`, `card`, `card-header`, `card-title`, `card-content`,
`card-footer`, `alert`, `dialog-content`, `field-label`, `field-error`, `tabs-list`,
`tabs-trigger`, `select-trigger`, `dropdown-menu-content`. Keep each rule to what you'll be able
to express as a `cva` change later, and use tokens (`var(--radius)`, `var(--border)`), not raw
colours.

### What makes a good set of directions

- 3–4 directions that a person would describe differently, not one style in four colours. Vary
  at least two of: shape (radius, borders), density, depth, type, motion, variant personality.
- Anchor each in the user's vibe and references; the `frontend-design` skill helps you commit to
  a clear point of view per direction instead of averaging them.
- With a user palette: keep its colours in every direction; vary their roles and the neutrals.
- Dark mode is part of the style, not an inversion: pick dark neutrals with the same temperature
  as the light ones, and lighten the primary enough for contrast.

### Applying the chosen candidate

1. **Tokens → `src/styles/theme.css`.** Copy the light block's values into `:root` and the dark
   block's into `.dark`, keeping every existing variable (fill anything the candidate didn't set
   from the current file). Keep the file's comments.
2. **Fonts → `src/config/fonts.ts`.** Replace the loaders but keep the three exports
   (`fontSans`, `fontHeading`, `fontMono`), their CSS variable names, and `fontVariables`.
3. **Variant previews → `cva` edits** in `src/components/ui/*`: e.g. `border-radius: 9999px` on
   `button` becomes `rounded-full` in the base classes of `buttonVariants`; uppercase badges become
   `uppercase tracking-wide` in `badgeVariants`. Use token utilities (`rounded-lg`, `h-control`,
   `border-ui`, `shadow-surface`), never raw values.
4. A **mix** ("A's colours with C's shapes") is a new candidate first: write it, check it, show
   it, then apply it like any other.
5. `pnpm style:reset`, then check `git status`: only `theme.css`, `fonts.ts` and the edited
   `components/ui` files should have changed.


## Tokens

| Group | Variables | Notes |
|---|---|---|
| Colour | `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar-*` | oklch. Each `*-foreground` pair must reach ≥ 4.5:1 contrast |
| Shape | `--radius` (scales `rounded-sm…4xl`), `--border-width` | `border-width: 0` gives a borderless, flat style |
| Density | `--control-height(-sm/-lg)`, `--surface-padding(-sm)` | buttons/inputs use `h-control`; cards use surface padding |
| Depth | `--surface-shadow`, `--overlay-shadow` | cards vs. menus/dialogs |
| Motion | `--motion-duration`, `--motion-ease` | default for every `transition-*`; `prefers-reduced-motion` is honoured globally |
| Type | `--heading-tracking`, `--heading-weight` + fonts | headings use `font-heading` |

How tokens reach components (`src/app/globals.css`):

- `--spacing-control` makes `h-control`, `size-control`.
- `--shadow-surface` makes `shadow-surface`.
- `border-ui` and `ring-ui` are utilities that read `--border-width`.
- `--default-transition-*` makes every `transition` use the motion tokens.

## Rules for components

- No hard-coded colours (`bg-zinc-100`, `#fff`, `text-black`), radii in px, shadows or control heights
  in features. Use semantic classes (`bg-muted`, `text-muted-foreground`, `rounded-lg`, `h-control`).
- New UI primitives go in `src/components/ui/` and read tokens the same way. Add them to `/styleguide`.
- Feature components compose `components/ui`; they don't restyle primitives with long class overrides.
  If many call sites need the same override, it's a new variant.

## Example: three styles from the same tokens

| Vibe | Changes |
|---|---|
| Soft & friendly | `--radius: 1rem`, warm `--primary`, `--surface-shadow` larger and diffuse, rounded font, `--motion-duration: 220ms` |
| Dense & technical | `--radius: 0.25rem`, `--control-height: 2rem`, `--surface-padding: 0.875rem`, mono headings, `--surface-shadow: none`, `--border-width: 1px` |
| Editorial | serif heading font, `--heading-tracking: -0.03em`, `--border-width: 0`, buttons variant → underline links, high-contrast neutrals |
