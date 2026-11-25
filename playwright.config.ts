import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { parse } from "dotenv";

/**
 * E2E runs against the disposable Neon `test` branch (.env.test.local from `pnpm db:test`),
 * or against a deployed preview when BASE_URL is set (see .github/workflows/e2e-preview.yml).
 */
const testEnv = existsSync(".env.test.local") ? parse(readFileSync(".env.test.local")) : {};
for (const [key, value] of Object.entries(testEnv)) process.env[key] ??= value;

const PORT = 3100;
const external = Boolean(process.env.BASE_URL);
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const CI = Boolean(process.env.CI);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  // One seeded user's data is shared across specs, so run serially. Fast enough at this size.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : {},
  },
  // @auth-module:start
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user-a.json" },
      dependencies: ["setup"],
    },
  ],
  // @auth-module:end
  // @no-auth: projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        // CI builds in a separate step; locally build first so tests hit production output.
        command: CI ? `pnpm start --port ${PORT}` : `pnpm build && pnpm start --port ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !CI,
        timeout: 240_000,
        env: { ...testEnv, NEXT_PUBLIC_APP_URL: baseURL },
      },
});
