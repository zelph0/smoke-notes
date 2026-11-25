// @auth-module: file (deleted by scripts/remove-auth.ts).
import { expect, test as setup } from "@playwright/test";
import { E2E_USERS } from "@/modules/auth/testing/users";

/**
 * Signs in the seeded E2E users once and saves their sessions, so specs start logged in.
 * Uses the app's real /api/auth route from inside the browser, so cookies are set exactly
 * as they are for a user. (The UI sign-in is email OTP, which needs an inbox.)
 */
for (const [key, user] of Object.entries(E2E_USERS)) {
  setup(`sign in E2E user ${key}`, async ({ page }) => {
    await page.goto("/");
    const status = await page.evaluate(async ({ email, password }) => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return response.status;
    }, user);
    expect(status, `sign-in for ${user.email} (seeded by pnpm db:seed)`).toBe(200);

    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
    await page.context().storageState({ path: `playwright/.auth/user-${key}.json` });
  });
}
