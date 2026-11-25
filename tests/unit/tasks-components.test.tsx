import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TasksEmptyState } from "@/features/tasks/components/empty-state";
import { TaskItem } from "@/features/tasks/components/task-item";
import { applyChange } from "@/features/tasks/components/task-list";
import type { TaskDTO } from "@/features/tasks/types";

vi.mock("@/features/tasks/actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  setTaskDone: vi.fn(),
  deleteTask: vi.fn(),
}));

const task = (overrides: Partial<TaskDTO> = {}): TaskDTO => ({
  id: "t1",
  title: "Write tests",
  notes: null,
  done: false,
  dueDate: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("TasksEmptyState", () => {
  it("invites the first task when there are none", () => {
    render(<TasksEmptyState filter="all" total={0} />);
    expect(screen.getByRole("heading", { name: "No tasks yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Show all tasks" })).not.toBeInTheDocument();
  });

  it("offers a way back when a filter hides everything", () => {
    render(<TasksEmptyState filter="active" total={3} />);
    expect(screen.getByRole("heading", { name: "All done" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all tasks" })).toHaveAttribute("href", "/tasks");
  });
});

describe("TaskItem", () => {
  it("shows the due date in a stable format and toggles via its labelled checkbox", async () => {
    const onToggle = vi.fn();
    render(
      <ul>
        <TaskItem
          task={task({ dueDate: "2027-03-05", notes: "Cover the edge cases" })}
          onToggle={onToggle}
          onDelete={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText("Mar 5, 2027")).toHaveAttribute("datetime", "2027-03-05");
    expect(screen.getByText("Cover the edge cases")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: 'Mark "Write tests" as done' }));
    expect(onToggle).toHaveBeenCalledWith("t1", true);
  });
});

describe("applyChange (optimistic reducer)", () => {
  const list = [task({ id: "a" }), task({ id: "b", done: true })];

  it("removes deleted tasks", () => {
    expect(applyChange(list, { type: "delete", id: "a" }, "all").map((t) => t.id)).toEqual(["b"]);
  });

  it("drops a task from the active view once it is completed", () => {
    expect(applyChange(list, { type: "toggle", id: "a", done: true }, "active")).toEqual([]);
  });

  it("keeps it in the all view, marked done", () => {
    expect(applyChange(list, { type: "toggle", id: "a", done: true }, "all")[0]?.done).toBe(true);
  });
});
