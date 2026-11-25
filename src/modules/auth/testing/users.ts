import { type NeonQueryFunction, neon } from "@neondatabase/serverless";

/**
 * Test/seed users for Neon Auth. Creates users through the branch's Neon Auth API (so
 * passwords are hashed by Better Auth) and looks ids up in the `neon_auth` schema.
 * Only for dev/test/preview branches: the seed refuses to run in production.
 */

export type SeedUser = { email: string; name: string; password: string };

/** Fixed test credentials. They only exist on dev/test/preview branches. */
export const TEST_PASSWORD = "template-test-password-1";

export const E2E_USERS = {
  a: { email: "e2e-user-a@example.test", name: "E2E User A", password: TEST_PASSWORD },
  b: { email: "e2e-user-b@example.test", name: "E2E User B", password: TEST_PASSWORD },
} as const satisfies Record<string, SeedUser>;

export const DEMO_USER: SeedUser = {
  email: process.env.SEED_USER_EMAIL || "demo@example.test",
  name: "Demo User",
  password: TEST_PASSWORD,
};

type Env = { databaseUrl: string; authBaseUrl: string; origin?: string };

async function findUserId(sql: NeonQueryFunction<false, false>, email: string): Promise<string | null> {
  const rows = (await sql`select id from neon_auth."user" where lower(email) = lower(${email}) limit 1`) as {
    id: string;
  }[];
  return rows[0]?.id ?? null;
}

/** Returns the user's id, creating the user if needed. Idempotent. */
export async function ensureUser(user: SeedUser, env: Env): Promise<string> {
  const sql = neon(env.databaseUrl);
  const existing = await findUserId(sql, user.email);
  if (existing) return existing;

  const response = await fetch(`${env.authBaseUrl}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: env.origin ?? "http://localhost:3000" },
    body: JSON.stringify({ email: user.email, name: user.name, password: user.password }),
  });
  if (!response.ok) {
    throw new Error(`Neon Auth sign-up failed for ${user.email}: ${response.status} ${await response.text()}`);
  }
  const created = await findUserId(sql, user.email);
  if (!created) throw new Error(`User ${user.email} was created but not found in neon_auth.user`);
  return created;
}
