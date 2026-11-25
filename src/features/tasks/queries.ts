import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { requireViewer } from "@/lib/viewer";
import { countTasksForOwner, listTasksForOwner } from "./data";
import type { TaskFilter } from "./schema";

/** Cache tag for everything derived from one owner's tasks. Actions call updateTag() with it. */
export const tasksTag = (ownerId: string) => `tasks:${ownerId}`;

/**
 * Reads for Server Components. Each resolves the viewer from the session, then reads through a
 * cache keyed by the owner id. The cached helpers stay unexported, so no caller can ask for
 * another owner's data. Reading the session means callers must sit inside <Suspense>.
 */
export async function listTasks(filter: TaskFilter) {
  const viewer = await requireViewer();
  return cachedList(viewer.id, filter);
}

export async function countTasks() {
  const viewer = await requireViewer();
  return cachedCounts(viewer.id);
}

async function cachedList(ownerId: string, filter: TaskFilter) {
  "use cache";
  cacheTag(tasksTag(ownerId));
  cacheLife("minutes");
  return listTasksForOwner(ownerId, filter);
}

async function cachedCounts(ownerId: string) {
  "use cache";
  cacheTag(tasksTag(ownerId));
  cacheLife("minutes");
  return countTasksForOwner(ownerId);
}
