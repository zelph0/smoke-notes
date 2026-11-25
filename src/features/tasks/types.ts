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
};

export type TaskCounts = { all: number; active: number; done: number };
