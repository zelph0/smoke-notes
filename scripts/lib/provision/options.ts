import { resolve } from "node:path";
import { parseArgs } from "node:util";

/** Same rule as scripts/sync-template-config.ts: lowercase letters, digits and single dashes. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Regions the Vercel-managed Neon integration accepts (`vercel integration add neon --help`). */
export const REGIONS = ["iad1", "cle1", "pdx1", "fra1", "lhr1", "syd1", "sin1", "gru1"] as const;
/** Neon Auth providers that work with Neon's shared OAuth app (no client id/secret needed). */
export const PROVIDERS = ["google", "github", "vercel"] as const;

export type Provider = (typeof PROVIDERS)[number];

export type ProvisionOptions = {
  slug: string;
  name: string;
  description: string;
  /** GitHub owner; defaults to the logged-in gh user (resolved at preflight). */
  owner?: string;
  visibility: "public" | "private";
  auth: boolean;
  providers: Provider[];
  themeDir?: string;
  /** Where the new app is cloned. */
  dir: string;
  region: (typeof REGIONS)[number];
  /** Vercel team slug; defaults to the CLI's current team. */
  scope?: string;
  /** Template repo (owner/name); defaults to the checkout running the script. */
  template?: string;
  pr: boolean;
  verify: boolean;
  json: boolean;
  /** Check logins, slug and ownership, then stop without changing anything. */
  preflight: boolean;
};

export const USAGE = `Usage: pnpm provision <slug> [options]

  --name "My App"          Display name (default: from the slug)
  --description "…"        One sentence for metadata (default: the name)
  --owner <login|org>      GitHub owner (default: your gh login)
  --private                Private repo (default: public; free plans don't enforce rulesets on private repos)
  --no-auth                Remove the auth module
  --providers google,github  Social sign-in next to email codes (default: google; "none" for email only)
  --theme-dir <dir>        Copy theme.css, fonts.ts and components/ui/* from this folder
  --dir <path>             Where to clone the app (default: ../<slug>)
  --region iad1            Neon region: ${REGIONS.join(", ")}
  --scope <team>           Vercel team (default: the CLI's current team)
  --template <owner/repo>  Template repo (default: this checkout's GitHub repo)
  --no-pr                  Stop before committing and opening the PR
  --no-verify              Skip typecheck/lint/test/build in the new app
  --json                   Print a JSON summary on stdout (progress goes to stderr)
  --preflight              Only check logins, the slug and ownership; change nothing`;

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseProvisionArgs(argv: string[], cwd = process.cwd()): ProvisionOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      name: { type: "string" },
      description: { type: "string" },
      owner: { type: "string" },
      private: { type: "boolean", default: false },
      auth: { type: "boolean", default: true },
      providers: { type: "string", default: "google" },
      "theme-dir": { type: "string" },
      dir: { type: "string" },
      region: { type: "string", default: "iad1" },
      scope: { type: "string" },
      template: { type: "string" },
      pr: { type: "boolean", default: true },
      verify: { type: "boolean", default: true },
      json: { type: "boolean", default: false },
      preflight: { type: "boolean", default: false },
    },
  });

  if (positionals.length !== 1) throw new Error(`Expected exactly one app slug.\n\n${USAGE}`);
  const slug = positionals[0] ?? "";
  if (!SLUG.test(slug) || slug.length > 60) {
    throw new Error(`Slug "${slug}" must be lowercase letters, digits and dashes (max 60 chars).`);
  }
  if (slug === "app-template") throw new Error('Refusing to provision over the template itself ("app-template").');

  const region = values.region as ProvisionOptions["region"];
  if (!REGIONS.includes(region)) throw new Error(`--region must be one of: ${REGIONS.join(", ")}.`);

  const providers =
    values.providers === "none"
      ? []
      : values.providers
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
  for (const provider of providers) {
    if (!PROVIDERS.includes(provider as Provider)) {
      throw new Error(`--providers: "${provider}" isn't supported with shared credentials (${PROVIDERS.join(", ")}).`);
    }
  }
  if (values.template && !/^[\w.-]+\/[\w.-]+$/.test(values.template)) {
    throw new Error("--template must look like owner/repo.");
  }

  const name = values.name?.trim() || titleFromSlug(slug);
  return {
    slug,
    name,
    description: values.description?.trim() || name,
    owner: values.owner,
    visibility: values.private ? "private" : "public",
    auth: values.auth,
    providers: values.auth ? (providers as Provider[]) : [],
    themeDir: values["theme-dir"] ? resolve(cwd, values["theme-dir"]) : undefined,
    dir: resolve(cwd, values.dir ?? `../${slug}`),
    region,
    scope: values.scope,
    template: values.template,
    pr: values.pr,
    verify: values.verify,
    json: values.json,
    preflight: values.preflight,
  };
}
