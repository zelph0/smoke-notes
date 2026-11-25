/**
 * TEMPLATE PLACEHOLDERS: the single source of truth for app identity.
 * The provisioning script rewrites ONLY this object, then runs `pnpm template:sync`, which
 * copies `slug` into package.json and `name` into the README title. Everything else
 * (metadata, OG image, header, manifest) imports from here. See docs/template-contract.md.
 */
export const templateConfig = {
  /** Human-readable product name. */
  name: "Smoke Notes",
  /** URL/package-safe identifier: lowercase letters, digits and dashes. */
  slug: "smoke-notes",
  /** One sentence used for <meta name="description"> and the OG image. */
  description: "A note and reminders app that has unique cool visual effects that resembles smoke.",
  /** BCP 47 language tag for <html lang>. */
  locale: "en",
} as const;

export type TemplateConfig = typeof templateConfig;
