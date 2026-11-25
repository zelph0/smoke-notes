/**
 * TEMPLATE PLACEHOLDERS: the single source of truth for app identity.
 * The provisioning script rewrites ONLY this object, then runs `pnpm template:sync`, which
 * copies `slug` into package.json and `name` into the README title. Everything else
 * (metadata, OG image, header, manifest) imports from here. See docs/template-contract.md.
 */
export const templateConfig = {
  /** Human-readable product name. */
  name: "App Template",
  /** URL/package-safe identifier: lowercase letters, digits and dashes. */
  slug: "app-template",
  /** One sentence used for <meta name="description"> and the OG image. */
  description: "An AI-first Next.js starter with Neon, Prisma, auth and a complete reference feature.",
  /** BCP 47 language tag for <html lang>. */
  locale: "en",
} as const;

export type TemplateConfig = typeof templateConfig;
