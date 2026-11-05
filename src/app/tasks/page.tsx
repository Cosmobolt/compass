"use client";

import { useEffect, useState } from "react";
import { update, useAppState, useHydrated, useNow } from "@/lib/store";
import { addDays, dayKey, fmtShortDay, fromDayKey, logicalDay, uid } from "@/lib/dates";
import { STATUS_LABEL, importClaudeTasks, isOpen, setTaskStatus } from "@/lib/tasks";
import type { Task, TaskStatus } from "@/lib/types";

function dueLabel(due: string, today: string): { text: string; tone: "" | "warn" | "bad" } {
  if (due < today) return { text: `Overdue · ${fmtShortDay(fromDayKey(due))}`, tone: "bad" };
  if (due === today) return { text: "Today", tone: "warn" };
  return { text: fmtShortDay(fromDayKey(due)), tone: "" };
}

function TaskRow({ t, today }: { t: Task; today: string }) {
  const [open, setOpen] = useState(false);
  const due = t.due ? dueLabel(t.due, today) : null;
  const patch = (fn: (x: Task) => Task) =>
    update((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...fn(x), updatedAt: new Date().toISOString() } : x)) }));

  return (
    <div className={`card task ${t.status}`}>
      <div className="header-row">
        <input
          type="checkbox"
          className={`check${t.status === "partial" ? " half" : ""}`}
          aria-label={`Mark ${t.title} done`}
          checked={t.status === "done"}
          onChange={() => setTaskStatus(t.id, t.status === "done" ? "todo" : "done")}
        />
        <button className="task-main" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="title">
            {t.important && <span className="star" aria-label="Important">★ </span>}
            {t.title}
          </span>
          <span className="pills" style={{ marginTop: 4 }}>
            {t.status === "partial" && <span className="pill accent">Partly done</span>}
            {t.status === "skipped" && <span className="pill">Won&apos;t do</span>}
            {due && isOpen(t) && <span className={`pill ${due.tone}`}>{due.text}</span>}
            {t.source === "claude" && <span className="pill">From Claude</span>}
          </span>
        </button>
      </div>

      {open && (
        <div className="steps stack">
          <div className="seg wrap" role="group" aria-label="Status">
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={t.status === st}
                className={t.status === st ? (st === "done" ? "on-good" : st === "partial" ? "on-accent" : st === "skipped" ? "on-muted" : "on-accent") : ""}
                onClick={() => setTaskStatus(t.id, st)}
              >
                {STATUS_LABEL[st]}
              </button>
            ))}
          </div>
          <label className="field">
            Notes
            <textarea value={t.notes ?? ""} onChange={(e) => patch((x) => ({ ...x, notes: e.target.value || undefined }))} placeholder="How far did you get? What's left?" />
          </label>
          <div className="grid2">
            <label className="field">
              Due
              <input type="date" value={t.due ?? ""} onChange={(e) => patch((x) => ({ ...x, due: e.target.value || undefined }))} />
            </label>
            <label className="field" style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="button" className="btn small block" onClick={() => patch((x) => ({ ...x, important: !x.important }))}>
                {t.important ? "★ Important" : "☆ Mark important"}
              </button>
            </label>
          </div>
          <div className="btnrow">
            <button
              type="button"
              className="btn small"
              onClick={() => patch((x) => ({ ...x, due: dayKey(addDays(fromDayKey(today), 1)) }))}
            >
              Move to tomorrow
            </button>
            <button
              type="button"
              className="btn small danger"
              onClick={() => {
                if (confirm(`Delete "${t.title}"?`)) update((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== t.id) }));
              }}
            >
              Delete
            </button>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const state = useAppState();
  const hydrated = useHydrated();
  const now = useNow();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [important, setImportant] = useState(false);
  const [view, setView] = useState<"open" | "finished">("open");

  useEffect(() => {
    if (hydrated) importClaudeTasks();
  }, [hydrated]);

  if (!hydrated || !now) return null;
  const today = dayKey(logicalDay(now));

  const byPriority = (a: Task, b: Task) =>
    Number(Boolean(b.important)) - Number(Boolean(a.important)) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.createdAt.localeCompare(b.createdAt);
  const open = state.tasks.filter(isOpen).sort(byPriority);
  const finished = state.tasks.filter((t) => !isOpen(t)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const groups: { label: string; items: Task[] }[] = [
    { label: "Overdue", items: open.filter((t) => t.due && t.due < today) },
    { label: "Today", items: open.filter((t) => t.due === today) },
    { label: "Coming up", items: open.filter((t) => t.due && t.due > today) },
    { label: "Any time", items: open.filter((t) => !t.due) },
  ];

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const ts = new Date().toISOString();
    update((s) => ({
      ...s,
      tasks: [...s.tasks, { id: uid(), title: title.trim(), due: due || undefined, important, status: "todo", source: "me", createdAt: ts, updatedAt: ts }],
    }));
    setTitle("");
    setDue("");
    setImportant(false);
  };

  const doneToday = state.tasks.filter((t) => t.status === "done" && dayKey(logicalDay(new Date(t.updatedAt))) === today).length;

  return (
    <>
      <h1>Tasks</h1>
      <p className="sub">
        {open.length} open{doneToday ? ` · ${doneToday} done today` : ""}
      </p>

      <form className="card stack" style={{ marginTop: 16 }} onSubmit={add}>
        <input type="text" aria-label="New task" placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="btnrow" style={{ alignItems: "center" }}>
          <div className="seg" role="group" aria-label="When">
            <button type="button" className={due === today ? "on-accent" : ""} aria-pressed={due === today} onClick={() => setDue(due === today ? "" : today)}>
              Today
            </button>
            <button
              type="button"
              className={due && due !== today ? "on-accent" : ""}
              aria-pressed={Boolean(due && due !== today)}
              onClick={() => setDue(due && due !== today ? "" : dayKey(addDays(fromDayKey(today), 1)))}
            >
              Tomorrow
            </button>
          </div>
          <button type="button" className={`btn small${important ? " primary" : ""}`} aria-pressed={important} onClick={() => setImportant(!important)}>
            ★
          </button>
          <button type="submit" className="btn small primary" style={{ marginLeft: "auto" }}>
            Add
          </button>
        </div>
        {due && due !== today && (
          <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
        )}
      </form>

      <div className="seg" role="tablist" style={{ marginTop: 20 }}>
        <button role="tab" aria-selected={view === "open"} className={view === "open" ? "on-accent" : ""} onClick={() => setView("open")}>
          Open ({open.length})
        </button>
        <button role="tab" aria-selected={view === "finished"} className={view === "finished" ? "on-accent" : ""} onClick={() => setView("finished")}>
          Finished ({finished.length})
        </button>
      </div>

      {view === "open" &&
        (open.length === 0 ? (
          <div className="list" style={{ marginTop: 14 }}>
            <div className="empty">Nothing on your list. Add something above.</div>
          </div>
        ) : (
          groups
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.label}>
                <h2>{g.label}</h2>
                {g.items.map((t) => (
                  <TaskRow key={t.id} t={t} today={today} />
                ))}
              </section>
            ))
        ))}

      {view === "finished" && (
        <>
          <h2>Finished</h2>
          {finished.length ? finished.map((t) => <TaskRow key={t.id} t={t} today={today} />) : <div className="list"><div className="empty">Nothing finished yet.</div></div>}
        </>
      )}
    </>
  );
}
