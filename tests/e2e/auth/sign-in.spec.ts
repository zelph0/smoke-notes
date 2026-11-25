// @auth-module: file (deleted by scripts/remove-auth.ts).
import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../support/a11y";

test.use({ storageState: { cookies: [], origins: [] } });

test("private pages redirect to sign-in and remember where you were going", async ({ page }) => {
  await page.goto("/tasks?filter=done");
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Ftasks%3Ffilter%3Ddone$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sign-in offers email codes and Google, and validates the email", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
});

test("sign-in page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("public pages stay public", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
