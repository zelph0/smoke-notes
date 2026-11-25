import { defineConfig, devices } from "@playwright/test";

/**
 * `pnpm style:check`: axe (contrast included) on every style candidate on /styleguide/compare, in
 * light and dark. Runs against `next dev` with STYLE_PREVIEW=1: no build, no test database.
 * STYLE_BASE_URL reuses a preview server that's already running (one `next dev` per folder).
 */
const PORT = 3200;
const external = Boolean(process.env.STYLE_BASE_URL);
const baseURL = process.env.STYLE_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/style",
  workers: 1,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL },
  webServer: external
    ? undefined
    : {
        command: `pnpm dev --port ${PORT}`,
        url: `${baseURL}/styleguide/compare`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: { STYLE_PREVIEW: "1" },
      },
});
