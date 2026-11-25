import { vi } from "vitest";
import { loadTestEnv } from "./test-env";

loadTestEnv();

// Next.js request APIs don't exist outside a request; actions are tested with these stubbed.
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));
