import { describe, expect, it } from "vitest";
import { createTaskSchema, setTaskDoneSchema, taskFilterSchema, updateTaskSchema } from "@/features/tasks/schema";

describe("createTaskSchema", () => {
  it("trims the title and normalizes empty optional fields to null", () => {
    const result = createTaskSchema.parse({ title: "  Ship it  ", notes: "", dueDate: "" });
    expect(result).toEqual({ title: "Ship it", notes: null, dueDate: null });
  });

  it("parses a due date as UTC midnight", () => {
    const result = createTaskSchema.parse({ title: "Pay rent", dueDate: "2027-02-01" });
    expect(result.dueDate?.toISOString()).toBe("2027-02-01T00:00:00.000Z");
  });

  it.each([
    [{ title: "" }, "title", "Give the task a title."],
    [{ title: "   " }, "title", "Give the task a title."],
    [{}, "title", "Give the task a title."],
    [{ title: "x".repeat(201) }, "title", "Keep the title under 200 characters."],
    [{ title: "ok", notes: "n".repeat(2001) }, "notes", "Keep notes under 2000 characters."],
    [{ title: "ok", dueDate: "2027-02-30" }, "dueDate", "Use a valid date."],
    [{ title: "ok", dueDate: "tomorrow" }, "dueDate", "Use a valid date."],
  ])("rejects %j with a message on %s", (input, path, message) => {
    const result = createTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path[0] === path);
    expect(issue?.message).toBe(message);
  });
});

describe("updateTaskSchema", () => {
  it("requires a valid task id", () => {
    expect(updateTaskSchema.safeParse({ id: "not a cuid!", title: "x" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: "cjld2cjxh0000qzrmn831i7rn", title: "x" }).success).toBe(true);
  });
});

describe("setTaskDoneSchema", () => {
  it("only accepts a boolean", () => {
    expect(setTaskDoneSchema.safeParse({ id: "cjld2cjxh0000qzrmn831i7rn", done: "yes" }).success).toBe(false);
  });
});

describe("taskFilterSchema", () => {
  it.each([
    ["active", "active"],
    ["done", "done"],
    [undefined, "all"],
    ["nonsense", "all"],
    [["done", "active"], "all"],
  ])("maps %j to %s", (input, expected) => {
    expect(taskFilterSchema.parse(input)).toBe(expected);
  });
});
