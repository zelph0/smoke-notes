import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

/**
 * Loads the disposable test-branch env (.env.test.local, written by `pnpm db:test`) and
 * refuses to run against the dev branch. In CI the workflow exports the per-run branch's
 * variables directly, so the file is optional there.
 */
export function loadTestEnv(): void {
  if (existsSync(".env.test.local")) {
    const values = parse(readFileSync(".env.test.local"));
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
  } else if (!process.env.CI) {
    throw new Error("Missing .env.test.local. Run `pnpm db:test` to create the disposable test branch.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set for tests.");

  if (existsSync(".env.local")) {
    const dev = parse(readFileSync(".env.local"));
    if (endpoint(dev.DATABASE_URL) && endpoint(dev.DATABASE_URL) === endpoint(process.env.DATABASE_URL)) {
      throw new Error("Tests are pointed at the dev branch. Run `pnpm db:test` and use .env.test.local.");
    }
  }
}

function endpoint(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0]?.replace(/-pooler$/, "") ?? null;
  } catch {
    return null;
  }
}
