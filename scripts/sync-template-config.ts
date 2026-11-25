/**
 * `pnpm template:sync` copies template.config.ts into the few files that can't import it
 * (package.json name, README title). `pnpm template:check` fails CI if they drift.
 * Provisioning: edit template.config.ts, then run `pnpm template:sync`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { templateConfig } from "../template.config";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const README_TITLE = /^# .*<!-- template:name -->$/m;

type Target = { file: string; expected: (current: string) => string };

const targets: Target[] = [
  {
    file: "package.json",
    expected: (current) => {
      const pkg = JSON.parse(current) as Record<string, unknown>;
      pkg.name = templateConfig.slug;
      return `${JSON.stringify(pkg, null, 2)}\n`;
    },
  },
  {
    file: "README.md",
    expected: (current) => current.replace(README_TITLE, `# ${templateConfig.name} <!-- template:name -->`),
  },
];

if (!SLUG.test(templateConfig.slug)) {
  console.error(`template.config.ts: slug "${templateConfig.slug}" must be lowercase letters, digits and dashes.`);
  process.exit(1);
}

const check = process.argv.includes("--check");
let drift = false;
for (const { file, expected } of targets) {
  const current = readFileSync(file, "utf8");
  const next = expected(current);
  if (next === current) continue;
  drift = true;
  if (check) console.error(`${file} is out of sync with template.config.ts. Run \`pnpm template:sync\`.`);
  else {
    writeFileSync(file, next);
    console.info(`updated ${file}`);
  }
}
if (check && drift) process.exit(1);
if (!drift) console.info("Template placeholders are in sync.");
