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
  createSubtask: vi.fn(),
  updateSubtask: vi.fn(),
  setSubtaskDone: vi.fn(),
  deleteSubtask: vi.fn(),
}));

const task = (overrides: Partial<TaskDTO> = {}): TaskDTO => ({
  id: "t1",
  title: "Write tests",
  notes: null,
  done: false,
  dueDate: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  subtasks: [],
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

describe("TaskItem with subtasks", () => {
  const withSubtasks = (done: [boolean, boolean], parentDone = false) =>
    task({
      done: parentDone,
      subtasks: [
        { id: "s1", title: "Outline", done: done[0] },
        { id: "s2", title: "Draft", done: done[1] },
      ],
    });

  it("disables completing the task while a subtask is open, and says why", () => {
    render(
      <ul>
        <TaskItem task={withSubtasks([true, false])} onToggle={vi.fn()} onDelete={vi.fn()} />
      </ul>,
    );
    const checkbox = screen.getByRole("checkbox", { name: 'Mark "Write tests" as done' });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAccessibleDescription(/1 of 2 subtasks done · finish them all to complete this task/);
    expect(screen.getByRole("list", { name: 'Subtasks of "Write tests"' })).toBeInTheDocument();
  });

  it("enables it once every subtask is done", async () => {
    const onToggle = vi.fn();
    render(
      <ul>
        <TaskItem task={withSubtasks([true, true])} onToggle={onToggle} onDelete={vi.fn()} />
      </ul>,
    );
    const checkbox = screen.getByRole("checkbox", { name: 'Mark "Write tests" as done' });
    expect(checkbox).not.toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAccessibleDescription("2 of 2 subtasks done");
    await userEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith("t1", true);
  });

  it("toggles and deletes subtasks via their labelled controls", async () => {
    const onToggleSubtask = vi.fn();
    const onDeleteSubtask = vi.fn();
    render(
      <ul>
        <TaskItem
          task={withSubtasks([false, true])}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
          onToggleSubtask={onToggleSubtask}
          onDeleteSubtask={onDeleteSubtask}
        />
      </ul>,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: 'Mark subtask "Outline" as done' }));
    expect(onToggleSubtask).toHaveBeenCalledWith("s1", true);
    await userEvent.click(screen.getByRole("button", { name: 'Delete subtask "Draft"' }));
    expect(onDeleteSubtask).toHaveBeenCalledWith("s2");
  });

  it("opens the inline add form and closes it with Escape", async () => {
    render(
      <ul>
        <TaskItem task={task()} onToggle={vi.fn()} onDelete={vi.fn()} />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: 'Add a subtask to "Write tests"' }));
    const input = screen.getByRole("textbox", { name: "New subtask" });
    expect(input).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "New subtask" })).not.toBeInTheDocument();
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

  const parent = task({
    id: "p",
    done: true,
    subtasks: [
      { id: "s1", title: "One", done: true },
      { id: "s2", title: "Two", done: true },
    ],
  });

  it("refuses to complete a task that has open subtasks", () => {
    const blocked = task({ id: "p", subtasks: [{ id: "s1", title: "One", done: false }] });
    expect(applyChange([blocked], { type: "toggle", id: "p", done: true }, "all")[0]?.done).toBe(false);
  });

  it("reopens the task when a subtask is reopened, and moves it out of the done view", () => {
    const change = { type: "subtask-toggle", taskId: "p", id: "s2", done: false } as const;
    const [next] = applyChange([parent], change, "all");
    expect(next?.done).toBe(false);
    expect(next?.subtasks.find((s) => s.id === "s2")?.done).toBe(false);
    expect(applyChange([parent], change, "done")).toEqual([]);
  });

  it("removes a deleted subtask without touching the task's state", () => {
    const [next] = applyChange([parent], { type: "subtask-delete", taskId: "p", id: "s1" }, "all");
    expect(next?.done).toBe(true);
    expect(next?.subtasks.map((s) => s.id)).toEqual(["s2"]);
  });
});
