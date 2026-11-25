import { neon } from "@neondatabase/serverless"; // @auth-module
import { createPrismaClient } from "@/lib/prisma";
import { E2E_USERS } from "@/modules/auth/testing/users"; // @auth-module

/**
 * Direct database access for test setup only (never for assertions the UI can make).
 * Available when the runner has the test branch's DATABASE_URL: locally and in CI, not
 * when running against a deployed preview.
 */
export const canUseDatabase = Boolean(process.env.DATABASE_URL);

async function ownerIdFor(key: "a" | "b"): Promise<string | undefined> {
  // @auth-module:start
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = (await sql`select id from neon_auth."user" where email = ${E2E_USERS[key].email}`) as { id: string }[];
  return rows[0]?.id;
  // @auth-module:end
  // @no-auth: return key === "a" ? "owner" : "other";
}

/** Deletes every task of an E2E user so a spec starts from the empty state. */
export async function resetTasks(key: "a" | "b"): Promise<void> {
  if (!canUseDatabase) return;
  const ownerId = await ownerIdFor(key);
  if (!ownerId) throw new Error(`E2E user ${key} is missing. Run \`pnpm db:test\` (it seeds E2E users).`);
  const db = createPrismaClient(process.env.DATABASE_URL ?? "");
  try {
    await db.task.deleteMany({ where: { ownerId } });
  } finally {
    await db.$disconnect();
  }
}
