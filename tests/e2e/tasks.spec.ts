import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./support/a11y";
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

/**
 * Clicks an optimistic control and waits for its server action to finish. The UI updates before
 * the server does, and Next runs actions one at a time, so a reload right after several quick
 * clicks would drop the ones still queued.
 */
async function clickAndPersist(page: Page, locator: Locator) {
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && "next-action" in r.request().headers(),
  );
  await locator.click();
  await response;
}

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

test("subtasks: a task completes only when every subtask is done", async ({ page }) => {
  test.skip(!canUseDatabase, "needs a resettable database (local or CI)");
  await page.goto("/tasks");

  await page.getByRole("textbox", { name: "Title" }).fill("Plan the offsite");
  await page.getByRole("button", { name: "Add task" }).click();
  const task = item(page, "Plan the offsite");
  await expect(task).toBeVisible();

  // Add two subtasks inline; the input stays open for the next one. Blank titles are rejected.
  await page.getByRole("button", { name: 'Add a subtask to "Plan the offsite"' }).click();
  const newSubtask = task.getByRole("textbox", { name: "New subtask" });
  await newSubtask.press("Enter");
  await expect(task.getByText("Give the subtask a title.")).toBeVisible();
  await newSubtask.fill("Book the venue");
  await newSubtask.press("Enter");
  await expect(task.getByTestId("subtask-item").filter({ hasText: "Book the venue" })).toBeVisible();
  await expect(newSubtask).toHaveValue("");
  await newSubtask.fill("Send invites");
  await newSubtask.press("Enter");
  await expect(task.getByTestId("subtask-item")).toHaveCount(2);
  await newSubtask.press("Escape");
  await expect(newSubtask).toBeHidden();

  // The parent can't be completed while subtasks are open.
  const parent = page.getByRole("checkbox", { name: 'Mark "Plan the offsite" as done' });
  await expect(parent).toBeDisabled();
  await expect(task).toContainText("0 of 2 subtasks done");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expectNoSeriousA11yViolations(page);
  }

  // Rename one inline.
  await page.getByRole("button", { name: 'Rename subtask "Send invites"' }).click();
  const rename = task.getByRole("textbox", { name: "Subtask title" });
  await rename.fill("Send calendar invites");
  await rename.press("Enter");
  await expect(task.getByText("Send calendar invites")).toBeVisible();

  // Complete both subtasks, then the parent.
  await clickAndPersist(page, page.getByRole("checkbox", { name: 'Mark subtask "Book the venue" as done' }));
  await expect(parent).toBeDisabled();
  await clickAndPersist(page, page.getByRole("checkbox", { name: 'Mark subtask "Send calendar invites" as done' }));
  await expect(task).toContainText("2 of 2 subtasks done");
  await expect(parent).toBeEnabled();
  await clickAndPersist(page, parent);
  await expect(task).toHaveAttribute("data-done", "true");

  // Reopening a subtask reopens the task, and that was persisted.
  await clickAndPersist(page, page.getByRole("checkbox", { name: 'Mark subtask "Book the venue" as not done' }));
  await expect(task).toHaveAttribute("data-done", "false");
  await page.reload();
  await expect(task).toHaveAttribute("data-done", "false");
  await expect(task).toContainText("1 of 2 subtasks done");

  // Deleting the open subtask unblocks the parent.
  await page.getByRole("button", { name: 'Delete subtask "Book the venue"' }).click();
  await expect(page.getByText("Subtask deleted.")).toBeVisible();
  await expect(task).toContainText("1 of 1 subtask done");
  await expect(parent).toBeEnabled();
});
