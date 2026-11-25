/**
 * Rewrites the identity fields of `templateConfig` in template.config.ts (the single place app
 * identity lives; see docs/template-contract.md). Only the values change: comments and layout stay.
 */
export type Identity = { name: string; slug: string; description: string };

export function renderTemplateConfig(source: string, identity: Identity): string {
  let out = source;
  for (const [key, value] of Object.entries(identity)) {
    const field = new RegExp(`^(\\s+${key}: )"(?:[^"\\\\]|\\\\.)*",$`, "gm");
    const matches = out.match(field)?.length ?? 0;
    if (matches !== 1) {
      throw new Error(`template.config.ts: expected exactly one \`${key}: "…",\` line, found ${matches}.`);
    }
    out = out.replace(field, (_line, prefix: string) => `${prefix}${JSON.stringify(value)},`);
  }
  return out;
}
