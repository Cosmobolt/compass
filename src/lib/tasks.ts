"use client";

import { update } from "./store";
import type { Task, TaskStatus } from "./types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  partial: "Partly done",
  done: "Done",
  skipped: "Won't do",
};

export function setTaskStatus(id: string, status: TaskStatus) {
  update((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)),
  }));
}

export function isOpen(t: Task) {
  return t.status === "todo" || t.status === "partial";
}

interface IncomingTask {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  important?: boolean;
}

let checked = false;

/**
 * Pull tasks Claude has added to public/claude-tasks.json in the repo. Each id is imported once,
 * so tasks you finish or delete in the app stay that way.
 */
export async function importClaudeTasks(force = false) {
  if (checked && !force) return 0;
  checked = true;
  try {
    const res = await fetch("/claude-tasks.json", { cache: "no-store" });
    if (!res.ok) return 0;
    const data = (await res.json()) as { tasks?: IncomingTask[] };
    const incoming = (data.tasks ?? []).filter((t) => t && typeof t.id === "string" && typeof t.title === "string");
    let added = 0;
    update((s) => {
      const seen = new Set(s.claudeTaskIds);
      const fresh = incoming.filter((t) => !seen.has(t.id));
      added = fresh.length;
      if (!fresh.length) return s;
      const now = new Date().toISOString();
      return {
        ...s,
        claudeTaskIds: [...s.claudeTaskIds, ...fresh.map((t) => t.id)],
        tasks: [
          ...s.tasks,
          ...fresh.map<Task>((t) => ({
            id: `claude:${t.id}`,
            title: t.title.slice(0, 300),
            notes: t.notes?.slice(0, 2000),
            due: /^\d{4}-\d{2}-\d{2}$/.test(t.due ?? "") ? t.due : undefined,
            important: Boolean(t.important),
            status: "todo",
            source: "claude",
            createdAt: now,
            updatedAt: now,
          })),
        ],
      };
    });
    return added;
  } catch {
    return 0;
  }
}
