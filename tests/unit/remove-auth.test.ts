import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeAuth, transformSource } from "../../scripts/remove-auth";

describe("transformSource", () => {
  it("deletes files marked as auth-only", () => {
    expect(transformSource("// @auth-module: file (deleted)\nexport const x = 1;\n")).toBeNull();
  });

  it("drops marked lines and activates @no-auth replacements", () => {
    const input = [
      'import { a } from "./auth"; // @auth-module',
      '// @no-auth: import { a } from "./single-owner";',
      "  extends: [authEnv], // @auth-module",
      "  # @no-auth: KEEP=1",
      "keep();",
    ].join("\n");
    expect(transformSource(input)).toBe(['import { a } from "./single-owner";', "  KEEP=1", "keep();"].join("\n"));
  });

  it("removes start/end blocks", () => {
    const input = ["before", "# --- Auth @auth-module:start", "SECRET=1", "# @auth-module:end", "after"].join("\n");
    expect(transformSource(input)).toBe("before\nafter");
  });

  it("leaves prose that merely mentions the marker", () => {
    const prose = "Lines ending in `// @auth-module` are removed.";
    expect(transformSource(prose)).toBe(prose);
  });
});

describe("removeAuth", () => {
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), "remove-auth-"));
    mkdirSync(join(root, "src/modules/auth"), { recursive: true });
    mkdirSync(join(root, "src/app/auth/sign-in"), { recursive: true });
    writeFileSync(join(root, "src/modules/auth/server.ts"), "export {};\n");
    writeFileSync(join(root, "src/app/auth/sign-in/page.tsx"), "// @auth-module: file\nexport {};\n");
    writeFileSync(
      join(root, "src/viewer.ts"),
      'export * from "./modules/auth/viewer"; // @auth-module\n// @no-auth: export * from "./single-owner";\n',
    );
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "x", dependencies: { "@neon/auth": "0.8.2", next: "16.4.6" } }),
    );
    return root;
  }

  it("removes the module, its routes and dependency, and is idempotent", () => {
    const root = fixture();
    const changes = removeAuth(root);
    expect(changes.map((c) => c.path).sort()).toEqual(
      ["package.json", "src/app/auth/sign-in/page.tsx", "src/modules/auth", "src/viewer.ts"].sort(),
    );
    expect(existsSync(join(root, "src/modules/auth"))).toBe(false);
    expect(existsSync(join(root, "src/app/auth"))).toBe(false);
    expect(readFileSync(join(root, "src/viewer.ts"), "utf8")).toBe('export * from "./single-owner";\n');
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies).toEqual({ next: "16.4.6" });
    expect(removeAuth(root)).toEqual([]);
  });

  it("changes nothing in dry-run mode", () => {
    const root = fixture();
    expect(removeAuth(root, { dryRun: true }).length).toBeGreaterThan(0);
    expect(existsSync(join(root, "src/modules/auth/server.ts"))).toBe(true);
  });
});
