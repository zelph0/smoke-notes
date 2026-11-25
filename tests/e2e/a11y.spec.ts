import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./support/a11y";

for (const [path, heading] of [
  ["/", undefined],
  ["/tasks", "Tasks"],
  ["/styleguide", "Styleguide"],
] as const) {
  test(`${path} has no serious accessibility violations (light and dark)`, async ({ page }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      if (heading) await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoSeriousA11yViolations(page);
    }
  });
}

// Dialogs use --popover and a muted footer that no page shows until one opens.
test("the delete dialog has no serious accessibility violations (light and dark)", async ({ page }) => {
  const title = `Dialog contrast check ${Date.now()}`;
  await page.goto("/tasks");
  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  const deleteButton = page.getByRole("button", { name: `Delete "${title}"` });
  await expect(deleteButton).toBeVisible();

  const dialog = page.getByRole("alertdialog");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await deleteButton.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("opacity", "1"); // let the open animation finish
    await expectNoSeriousA11yViolations(page, '[data-slot="alert-dialog-content"]');
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  }

  // Clean up: confirm the delete this time.
  await deleteButton.click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(deleteButton).toBeHidden();
});
