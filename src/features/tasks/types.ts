/**
 * What the UI receives. Never pass Prisma models to Client Components: map them to a plain,
 * serializable DTO with only the fields the UI needs (dates as strings).
 */
export type TaskDTO = {
  id: string;
  title: string;
  notes: string | null;
  done: boolean;
  /** YYYY-MM-DD or null */
  dueDate: string | null;
  /** ISO timestamp */
  createdAt: string;
  /** Oldest first. A task can only be done when every subtask is done. */
  subtasks: SubtaskDTO[];
};

export type SubtaskDTO = {
  id: string;
  title: string;
  done: boolean;
};

/** The completion rule, shared by the UI (disabled checkbox) and the reducer. */
export function openSubtaskCount(task: Pick<TaskDTO, "subtasks">): number {
  return task.subtasks.filter((subtask) => !subtask.done).length;
}

export type TaskCounts = { all: number; active: number; done: number };
