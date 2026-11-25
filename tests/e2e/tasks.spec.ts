import { expect, type Page, test } from "@playwright/test";
import { canUseDatabase, resetTasks } from "./support/db";

/**
 * The reference feature end to end, as a signed-in user (auth variant) or the single
 * owner (no-auth variant). Starts from an empty list.
 */
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetTasks("a");
});

const item = (page: Page, title: string) => page.getByTestId("task-item").filter({ hasText: title });

test("empty state, create, validate, edit, complete, filter and delete", async ({ page }) => {
  test.skip(!canUseDatabase, "needs a resettable database (local or CI)");
  await page.goto("/tasks");

  await expect(page.getByRole("heading", { name: "No tasks yet" })).toBeVisible();

  // Server-side validation surfaces inline.
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Give the task a title.")).toBeVisible();

  // Create
  await page.getByRole("textbox", { name: "Title" }).fill("Buy oat milk");
  await page.getByRole("textbox", { name: "Notes" }).fill("The barista one");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Task added.")).toBeVisible();
  await expect(item(page, "Buy oat milk")).toContainText("The barista one");
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("");

  // Edit
  await page.getByRole("button", { name: 'Edit "Buy oat milk"' }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  await dialog.getByRole("textbox", { name: "Title" }).fill("Buy oat milk x2");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(item(page, "Buy oat milk x2")).toBeVisible();

  // Complete (optimistic), then check filters and counts.
  await page.getByRole("checkbox", { name: 'Mark "Buy oat milk x2" as done' }).click();
  await expect(item(page, "Buy oat milk x2")).toHaveAttribute("data-done", "true");
  const filters = page.getByRole("navigation", { name: "Filter tasks" });
  await filters.getByRole("link", { name: /Active/ }).click();
  await expect(page).toHaveURL(/filter=active/);
  await expect(page.getByRole("heading", { name: "All done" })).toBeVisible();
  await filters.getByRole("link", { name: /Done/ }).click();
  await expect(item(page, "Buy oat milk x2")).toBeVisible();

  // The change survived a reload (it was persisted, not just optimistic).
  await page.reload();
  await expect(item(page, "Buy oat milk x2")).toHaveAttribute("data-done", "true");

  // Delete with confirmation.
  await page.getByRole("button", { name: 'Delete "Buy oat milk x2"' }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Task deleted.")).toBeVisible();
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "No tasks yet" })).toBeVisible();
});
