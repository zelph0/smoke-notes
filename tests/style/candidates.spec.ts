import { expect, test } from "@playwright/test";
import { candidates } from "../../src/styles/candidates";
import { expectNoSeriousA11yViolations } from "../e2e/support/a11y";

/**
 * Every style candidate must pass axe (contrast included) in light and dark before anyone is
 * shown it. Run with `pnpm style:check`; fix or drop failing candidates.
 */
test("there are candidates to check", () => {
  expect(candidates.length, "src/styles/candidates/index.ts lists no candidates").toBeGreaterThan(0);
});

for (const candidate of candidates) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${candidate.id.toUpperCase()}. ${candidate.name} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/styleguide/compare");
      const scope = page.locator(`[data-theme-preview="${candidate.id}"]`);
      await expect(scope).toBeVisible();
      await page.waitForLoadState("networkidle");
      const selector = `[data-theme-preview="${candidate.id}"]`;
      await expectNoSeriousA11yViolations(page, selector);

      // Dialog surfaces (--popover, its footer) only exist while a dialog is open. It portals into the
      // candidate's scope; check just the dialog, since the page behind the overlay is dimmed on purpose.
      await scope.getByRole("button", { name: "Open dialog" }).click();
      const dialog = scope.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS("opacity", "1"); // let the open animation finish
      await expectNoSeriousA11yViolations(page, `${selector} [data-slot="dialog-content"]`);
    });
  }
}
