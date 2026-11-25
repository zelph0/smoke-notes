/**
 * `pnpm db:seed`: realistic, idempotent data for dev, test and preview branches.
 * Re-running resets the seeded users' tasks to the same state. Never runs in production.
 */
import { config } from "dotenv";
import { createPrismaClient } from "../src/lib/prisma";
import { DEMO_USER, E2E_USERS, ensureUser } from "../src/modules/auth/testing/users"; // @auth-module

config({ path: [".env.local", ".env"], quiet: true });

// @no-auth: const DEMO_USER = { email: "owner@localhost" };
// @no-auth: const E2E_USERS = { a: { email: "owner@localhost" }, b: { email: "other@localhost" } };
// @no-auth: const ensureUser = async (user: { email: string }, _env?: unknown) => user.email.split("@")[0] ?? "owner";

if (process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed: production environment.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const authEnv = { databaseUrl, authBaseUrl: process.env.NEON_AUTH_BASE_URL ?? "" };

const db = createPrismaClient(databaseUrl);

const day = 24 * 60 * 60 * 1000;
const dateIn = (days: number) => new Date(Math.floor(Date.now() / day) * day + days * day);

type DemoTask = { title: string; notes?: string; dueInDays?: number; done?: boolean; subtasks?: [string, boolean][] };

const DEMO_TASKS: DemoTask[] = [
  {
    title: "Draft Q3 planning doc",
    notes: "Pull numbers from the June dashboard first.",
    dueInDays: 2,
    subtasks: [
      ["Pull June numbers", true],
      ["Outline the three goals", true],
      ["Write the risks section", false],
    ],
  },
  { title: "Review Priya's pull request on billing retries", dueInDays: 0 },
  { title: "Book flights for the Lisbon offsite", notes: "Prefer the morning flight on the 14th.", dueInDays: 9 },
  { title: "Renew the domain before it lapses", dueInDays: 5 },
  { title: "Reply to the accountant about VAT receipts", done: true },
  { title: "Update onboarding checklist for new hires" },
  { title: "Fix flaky checkout test", notes: "Fails ~1 in 20 runs on CI; suspect a race in the cart fixture." },
  {
    title: "Prepare demo for Thursday's customer call",
    dueInDays: 3,
    subtasks: [
      ["Reset the demo account", false],
      ["Rehearse the billing flow", false],
    ],
  },
  { title: "Order replacement laptop charger", done: true },
  { title: "Write release notes for v1.4", dueInDays: 1 },
  { title: "Schedule 1:1s for next week" },
  { title: "Clean up unused feature flags", notes: "At least: new-nav, legacy-export, promo-banner." },
  { title: "Read the Postgres 18 release notes", done: true },
  { title: "Water the office plants", done: true },
  { title: "Send invoice #1042 to Northwind", dueInDays: -1 },
  { title: "Sketch the new settings page layout" },
  { title: "Back up the design files to the shared drive", done: true },
  { title: "Call the landlord about the heating", dueInDays: 4 },
  { title: "Set up error alerts for the payments service" },
  { title: "Collect feedback from beta users", notes: "Short survey: 5 questions max.", dueInDays: 12 },
  { title: "Archive last quarter's Slack channels", done: true },
  { title: "Pair with Sam on the search indexing bug" },
  { title: "Plan the team lunch", dueInDays: 6 },
  {
    title: "Rotate the staging API keys",
    done: true,
    subtasks: [
      ["Generate new keys", true],
      ["Update the secrets store", true],
    ],
  },
  { title: "Tidy up the README", done: true },
];

async function main() {
  const demoId = await ensureUser(DEMO_USER, authEnv);
  await db.task.deleteMany({ where: { ownerId: demoId } }); // cascades to subtasks
  await db.$transaction(
    DEMO_TASKS.map((task, index) => {
      const createdAt = new Date(Date.now() - index * 3_600_000);
      return db.task.create({
        data: {
          ownerId: demoId,
          title: task.title,
          notes: task.notes ?? null,
          status: task.done ? "DONE" : "TODO",
          dueDate: task.dueInDays === undefined ? null : dateIn(task.dueInDays),
          createdAt,
          subtasks: {
            create: (task.subtasks ?? []).map(([title, done], i) => ({
              title,
              done,
              createdAt: new Date(createdAt.getTime() + i * 1000),
            })),
          },
        },
      });
    }),
  );

  // E2E users start empty; the specs create what they need.
  for (const user of Object.values(E2E_USERS)) {
    const id = await ensureUser(user, authEnv);
    await db.task.deleteMany({ where: { ownerId: id } });
  }

  console.info(
    `Seeded ${DEMO_TASKS.length} tasks for ${DEMO_USER.email} and reset ${Object.keys(E2E_USERS).length} E2E users.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
