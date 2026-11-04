"use client";

import { useState } from "react";
import { DEADLINE_PATTERN, update, useAppState, useHydrated, useNow } from "@/lib/store";
import { relativeDue, uid } from "@/lib/dates";
import type { CalEvent, Deadline } from "@/lib/types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function patch(id: string, fn: (d: Deadline) => Deadline) {
  update((s) => ({ ...s, deadlines: s.deadlines.map((d) => (d.id === id ? fn(d) : d)) }));
}

function DeadlineCard({ d, now }: { d: Deadline; now: Date }) {
  const [open, setOpen] = useState(false);
  const [stepText, setStepText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const due = new Date(d.due);
  const late = !d.done && due < now;
  const urgent = !d.done && !late && due.getTime() - now.getTime() < 2 * 86400000;
  const doneSteps = d.steps.filter((s) => s.done).length;

  const addStep = (text: string) => {
    if (!text.trim()) return;
    patch(d.id, (x) => ({ ...x, steps: [...x.steps, { id: uid(), text: text.trim(), done: false }] }));
  };

  const breakDown = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: d.title, course: d.course, due: due.toString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      patch(d.id, (x) => ({
        ...x,
        steps: [...x.steps, ...(data.steps as string[]).map((t) => ({ id: uid(), text: t, done: false }))],
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className={`header-row${d.done ? " done" : ""}`}>
        <input
          type="checkbox"
          className="check"
          aria-label={`Mark ${d.title} done`}
          checked={d.done}
          onChange={() => patch(d.id, (x) => ({ ...x, done: !x.done }))}
        />
        <div className="grow" style={{ flex: 1, minWidth: 0 }}>
          <div className="title" style={{ fontWeight: 600 }}>
            {d.title}
          </div>
          <div className="meta small muted">
            {d.course ? `${d.course} · ` : ""}
            {d.steps.length ? `${doneSteps} of ${d.steps.length} steps` : "No steps yet"}
          </div>
        </div>
        <span className={`pill ${d.done ? "good" : late ? "bad" : urgent ? "warn" : ""}`}>
          {d.done ? "Done" : relativeDue(due, now)}
        </span>
      </div>
      {d.steps.length > 0 && (
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${(doneSteps / d.steps.length) * 100}%` }} />
        </div>
      )}

      {!open && !d.done && (
        <button className="btn ghost small" style={{ paddingLeft: 0, marginTop: 4 }} onClick={() => setOpen(true)}>
          {d.steps.length ? "Show steps" : "Break it into steps"}
        </button>
      )}

      {open && (
        <div className="steps">
          {d.steps.map((s) => (
            <div className={`step${s.done ? " done" : ""}`} key={s.id}>
              <input
                type="checkbox"
                className="check"
                aria-label={s.text}
                checked={s.done}
                onChange={() =>
                  patch(d.id, (x) => ({ ...x, steps: x.steps.map((y) => (y.id === s.id ? { ...y, done: !y.done } : y)) }))
                }
              />
              <span>{s.text}</span>
              <button
                className="btn ghost small"
                aria-label={`Remove step ${s.text}`}
                onClick={() => patch(d.id, (x) => ({ ...x, steps: x.steps.filter((y) => y.id !== s.id) }))}
              >
                ✕
              </button>
            </div>
          ))}
          <form
            className="inline-add"
            onSubmit={(e) => {
              e.preventDefault();
              addStep(stepText);
              setStepText("");
            }}
          >
            <input type="text" placeholder="Add a small step" value={stepText} onChange={(e) => setStepText(e.target.value)} />
            <button className="btn small" type="submit">
              Add
            </button>
          </form>
          {err && <p className="small" style={{ color: "var(--bad)", marginTop: 6 }}>{err}</p>}
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={breakDown} disabled={busy}>
              {busy ? "Thinking…" : "Suggest steps with AI"}
            </button>
            <label className="btn small" style={{ position: "relative" }}>
              Move date
              <input
                type="datetime-local"
                aria-label="New due date"
                value={toLocalInput(d.due)}
                onChange={(e) => e.target.value && patch(d.id, (x) => ({ ...x, due: e.target.value }))}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              />
            </label>
            <button
              className="btn small danger"
              onClick={() => {
                if (confirm(`Delete "${d.title}"?`)) update((s) => ({ ...s, deadlines: s.deadlines.filter((x) => x.id !== d.id) }));
              }}
            >
              Delete
            </button>
            <button className="btn ghost small" onClick={() => setOpen(false)}>
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Deadlines() {
  const state = useAppState();
  const hydrated = useHydrated();
  const now = useNow();
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);
  if (!hydrated || !now) return null;

  const sorted = [...state.deadlines].sort((a, b) => a.due.localeCompare(b.due));
  const overdue = sorted.filter((d) => !d.done && new Date(d.due) < now);
  const upcoming = sorted.filter((d) => !d.done && new Date(d.due) >= now);
  const done = sorted.filter((d) => d.done);

  // Calendar items that look like coursework and aren't tracked yet.
  const tracked = new Set(state.deadlines.map((d) => d.sourceEventId).filter(Boolean));
  const lmsFeeds = new Set(state.feeds.filter((f) => f.kind === "lms").map((f) => f.id));
  const suggestions: CalEvent[] = state.events
    .filter((e) => new Date(e.end) >= now && !tracked.has(e.id))
    .filter((e) => lmsFeeds.has(e.feedId) || DEADLINE_PATTERN.test(e.title))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 8);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !due) return;
    update((s) => ({
      ...s,
      deadlines: [...s.deadlines, { id: uid(), title: title.trim(), course: course.trim() || undefined, due, done: false, steps: [] }],
    }));
    setTitle("");
    setCourse("");
    setDue("");
  };

  return (
    <>
      <h1>Deadlines</h1>
      <p className="sub">Everything due, broken into steps small enough to start today.</p>

      <h2>Add a deadline</h2>
      <form className="card stack" onSubmit={add}>
        <label className="field">
          What is it?
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Essay 2: Aquinas on natural law" required />
        </label>
        <div className="stack">
          <label className="field">
            Module
            <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="PHIL20010" />
          </label>
          <label className="field">
            Due
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
          </label>
        </div>
        <button className="btn primary block" type="submit">
          Add deadline
        </button>
      </form>

      {suggestions.length > 0 && (
        <>
          <h2>Found in your calendar</h2>
          <div className="list">
            {suggestions.map((e) => (
              <div className="row" key={e.id}>
                <div className="grow">
                  <div className="title">{e.title}</div>
                  <div className="meta">{relativeDue(new Date(e.start), now)}</div>
                </div>
                <button
                  className="btn small"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      deadlines: [
                        ...s.deadlines,
                        { id: uid(), title: e.title, due: toLocalInput(e.allDay ? e.start.replace(/T.*/, "T23:59:00") : e.start), done: false, steps: [], sourceEventId: e.id },
                      ],
                    }))
                  }
                >
                  Track
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {overdue.length > 0 && (
        <>
          <h2>Overdue</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>
            Email your lecturer about an extension, move the date, or mark it done. Don&apos;t let it sit here.
          </p>
          {overdue.map((d) => (
            <DeadlineCard key={d.id} d={d} now={now} />
          ))}
        </>
      )}

      <h2>Coming up</h2>
      {upcoming.length ? upcoming.map((d) => <DeadlineCard key={d.id} d={d} now={now} />) : <div className="list"><div className="empty">Nothing coming up. Add your next deadline above.</div></div>}

      {done.length > 0 && (
        <>
          <button className="btn ghost" style={{ marginTop: 16, paddingLeft: 0 }} onClick={() => setShowDone(!showDone)}>
            {showDone ? "Hide" : "Show"} finished ({done.length})
          </button>
          {showDone && done.map((d) => <DeadlineCard key={d.id} d={d} now={now} />)}
        </>
      )}
    </>
  );
}
