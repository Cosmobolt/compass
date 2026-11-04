"use client";

import Link from "next/link";
import { useEffect } from "react";
import { eventsForDay, isLecture, update, useAppState, useHydrated, useNow } from "@/lib/store";
import { addDays, dayKey, fmtDay, fmtTime, relativeDue } from "@/lib/dates";
import { liturgicalDay } from "@/lib/liturgy";
import { syncCalendars } from "@/lib/sync";
import type { AppState, Deadline } from "@/lib/types";
import PracticeList from "@/components/PracticeList";
import { importClaudeTasks, isOpen, setTaskStatus } from "@/lib/tasks";

function greeting(h: number) {
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function nextStep(d: Deadline) {
  return d.steps.find((s) => !s.done)?.text;
}

/** Suggest a "one thing" when the user hasn't set one: the next step of the most urgent deadline. */
function suggestFocus(state: AppState, now: Date): string | undefined {
  const open = state.deadlines.filter((d) => !d.done).sort((a, b) => a.due.localeCompare(b.due));
  const d = open[0];
  if (!d) return undefined;
  const step = nextStep(d);
  if (new Date(d.due) < now) return `Finish ${d.title} or ask for an extension`;
  return step ? `${step} (${d.title})` : `Start ${d.title}`;
}

export default function Today() {
  const state = useAppState();
  const hydrated = useHydrated();
  const now = useNow();

  // Refresh calendars in the background if they're more than 3 hours old.
  useEffect(() => {
    if (!hydrated || state.feeds.length === 0) return;
    const age = state.eventsFetchedAt ? Date.now() - new Date(state.eventsFetchedAt).getTime() : Infinity;
    if (age > 3 * 3600_000) syncCalendars(state.feeds);
  }, [hydrated, state.feeds, state.eventsFetchedAt]);

  useEffect(() => {
    if (hydrated) importClaudeTasks();
  }, [hydrated]);

  if (!hydrated || !now) return null;

  const today = dayKey(now);
  const lit = liturgicalDay(now);
  const events = eventsForDay(state, now);
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const nextUp = timed.find((e) => new Date(e.end) > now);

  const weekAhead = addDays(now, 7);
  const open = state.deadlines.filter((d) => !d.done).sort((a, b) => a.due.localeCompare(b.due));
  const overdue = open.filter((d) => new Date(d.due) < now);
  const soon = open.filter((d) => new Date(d.due) >= now && new Date(d.due) <= weekAhead);
  const catchUp = state.catchUp.filter((c) => !c.done);
  const checkedIn = Boolean(state.checkins[today]);
  const focus = state.focus[today] ?? "";
  const suggestion = suggestFocus(state, now);
  const todaysTasks = state.tasks
    .filter((t) => isOpen(t) && ((t.due && t.due <= today) || t.status === "partial"))
    .sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important)) || (a.due ?? "").localeCompare(b.due ?? ""));
  const firstRun = state.feeds.length === 0 && state.classes.length === 0 && state.deadlines.length === 0;

  return (
    <>
      <p className="muted small">{fmtDay(now)}</p>
      <h1>
        {greeting(now.getHours())}
        {state.name ? `, ${state.name}` : ""}
      </h1>

      <div className="pills">
        <span className="pill">
          <span className="dot" style={{ background: `var(--${lit.colour === "rose" ? "violet" : lit.colour})` }} />
          {lit.name ?? lit.season}
        </span>
        {lit.massObligation && <span className="pill accent">Mass today</span>}
        {lit.fasting && <span className="pill warn">Fast and abstinence</span>}
        {!lit.fasting && lit.abstinence && <span className="pill warn">Abstain from meat</span>}
        {lit.fridayPenance && <span className="pill">Friday penance</span>}
      </div>

      {firstRun && (
        <div className="banner accent">
          Start by adding your timetable and deadlines. <Link href="/settings">Set up Compass</Link>
        </div>
      )}

      <h2>Your one thing today</h2>
      <div className="card focus">
        <textarea
          rows={2}
          aria-label="Your one thing today"
          placeholder={suggestion ?? "What's the one thing that would make today a win?"}
          value={focus}
          onChange={(e) => update((s) => ({ ...s, focus: { ...s.focus, [today]: e.target.value } }))}
        />
        {!focus && suggestion && (
          <button
            className="btn ghost small"
            style={{ marginTop: 6, paddingLeft: 0 }}
            onClick={() => update((s) => ({ ...s, focus: { ...s.focus, [today]: suggestion } }))}
          >
            Use this suggestion
          </button>
        )}
      </div>

      {overdue.length > 0 && (
        <div className="banner">
          {overdue.length === 1 ? "1 deadline has" : `${overdue.length} deadlines have`} passed.{" "}
          <Link href="/deadlines" style={{ color: "inherit" }}>
            Decide what to do with {overdue.length === 1 ? "it" : "them"}
          </Link>
        </div>
      )}

      <h2>Schedule</h2>
      <div className="list">
        {allDay.map((e) => (
          <div className="row" key={e.id}>
            <span className="time">All day</span>
            <div className="grow">
              <div className="title">{e.title}</div>
            </div>
          </div>
        ))}
        {timed.map((e) => {
          const past = new Date(e.end) < now;
          const isNow = new Date(e.start) <= now && new Date(e.end) > now;
          return (
            <div className={`row${isNow ? " now" : ""}${past ? " past" : ""}`} key={e.id}>
              <span className="time">{fmtTime(e.start)}</span>
              <div className="grow">
                <div className="title">{e.title}</div>
                <div className="meta">
                  {fmtTime(e.start)} to {fmtTime(e.end)}
                  {e.location ? ` · ${e.location}` : ""}
                </div>
              </div>
              {isNow && <span className="pill accent">Now</span>}
              {!isNow && e === nextUp && <span className="pill">Next</span>}
              {isLecture(state, e) && !past && !isNow && e !== nextUp && <span className="pill">Class</span>}
            </div>
          );
        })}
        {events.length === 0 && <div className="empty">Nothing scheduled today.</div>}
      </div>

      <h2 style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Tasks</span>
        <Link href="/tasks" style={{ textTransform: "none", letterSpacing: 0 }}>
          All tasks
        </Link>
      </h2>
      <div className="list">
        {todaysTasks.slice(0, 6).map((t) => (
          <label className="row" key={t.id} style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              className={`check${t.status === "partial" ? " half" : ""}`}
              checked={false}
              onChange={() => setTaskStatus(t.id, "done")}
            />
            <div className="grow">
              <div className="title">
                {t.important && <span className="star">★ </span>}
                {t.title}
              </div>
              <div className="meta">
                {t.status === "partial" ? "Partly done" : t.due && t.due < today ? "Overdue" : "Today"}
                {t.source === "claude" ? " · From Claude" : ""}
              </div>
            </div>
          </label>
        ))}
        {todaysTasks.length > 6 && (
          <Link href="/tasks" className="row" style={{ color: "var(--accent)", textDecoration: "none" }}>
            {todaysTasks.length - 6} more
          </Link>
        )}
        {todaysTasks.length === 0 && (
          <div className="empty">
            Nothing for today. <Link href="/tasks">Add a task</Link>
          </div>
        )}
      </div>

      <h2>Due this week</h2>
      <div className="list">
        {[...overdue, ...soon].map((d) => {
          const due = new Date(d.due);
          const late = due < now;
          const urgent = !late && due.getTime() - now.getTime() < 2 * 86400000;
          const step = nextStep(d);
          return (
            <Link href="/deadlines" className="row" key={d.id} style={{ color: "inherit", textDecoration: "none" }}>
              <div className="grow">
                <div className="title">{d.title}</div>
                <div className="meta">
                  {d.course ? `${d.course} · ` : ""}
                  {step ? `Next: ${step}` : d.steps.length ? "All steps done" : "No steps yet"}
                </div>
              </div>
              <span className={`pill ${late ? "bad" : urgent ? "warn" : ""}`}>{relativeDue(due, now)}</span>
            </Link>
          );
        })}
        {overdue.length + soon.length === 0 && <div className="empty">Nothing due in the next 7 days.</div>}
      </div>

      {catchUp.length > 0 && (
        <>
          <h2>Catch-up</h2>
          <Link href="/checkin#catchup" className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <strong>{catchUp.length}</strong> missed {catchUp.length === 1 ? "class" : "classes"} to catch up on. Oldest:{" "}
            {catchUp[0].title}
          </Link>
        </>
      )}

      <h2>Prayer</h2>
      <PracticeList date={now} />

      <h2>Tonight</h2>
      {checkedIn ? (
        <div className="card">
          <span className="pill good">Checked in</span>{" "}
          <span className="muted small">See you tomorrow. {state.checkins[today].tomorrow && `Tomorrow's one thing: ${state.checkins[today].tomorrow}`}</span>
        </div>
      ) : (
        <Link href="/checkin" className="btn primary block">
          {now.getHours() >= 18 ? "Do your evening check-in" : "Evening check-in (2 minutes)"}
        </Link>
      )}

      {nextUp && timed.length > 0 && <p className="muted small" style={{ marginTop: 18 }}>Next up: {nextUp.title} at {fmtTime(nextUp.start)}</p>}
    </>
  );
}
