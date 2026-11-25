// @auth-module: file (deleted by scripts/remove-auth.ts).
import { describe, expect, it } from "vitest";
import { safeNext } from "@/modules/auth/safe-next";

describe("safeNext (post-sign-in redirect)", () => {
  it.each([
    ["/tasks?filter=done", "/tasks?filter=done"],
    ["/tasks#top", "/tasks#top"],
    [undefined, "/tasks"],
    ["", "/tasks"],
    [["/a", "/b"], "/a"],
  ])("keeps same-origin path %j", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/auth/sign-in",
    "/api/auth/x",
  ])("blocks %s", (input) => {
    expect(safeNext(input)).toBe("/tasks");
  });
});
