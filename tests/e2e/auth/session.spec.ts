// @auth-module: file (deleted by scripts/remove-auth.ts).
import { expect, test } from "@playwright/test";
import { E2E_USERS } from "@/modules/auth/testing/users";

// User B's session, so signing out doesn't log out user A for the other specs.
test.use({ storageState: "playwright/.auth/user-b.json" });

test("signed-in users see their account and can sign out", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(E2E_USERS.b.email)).toBeVisible();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
