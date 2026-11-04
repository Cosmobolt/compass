"use client";

import { useState } from "react";
import { eventsForDay, isLecture, update, useAppState, useHydrated, useNow } from "@/lib/store";
import { addDays, dayKey, fmtShortDay, fmtTime, fromDayKey, uid } from "@/lib/dates";
import type { AppState, CheckIn } from "@/lib/types";
import PracticeList, { practicesFor } from "@/components/PracticeList";

function streak(state: AppState, today: Date): number {
  let n = 0;
  let d = state.checkins[dayKey(today)] ? today : addDays(today, -1);
  while (state.checkins[dayKey(d)]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function CheckInForm({ state, now }: { state: AppState; now: Date }) {
  const key = dayKey(now);
  const existing = state.checkins[key];
  const lectures = eventsForDay(state, now).filter((e) => isLecture(state, e) && new Date(e.start) <= now);

  const [attendance, setAttendance] = useState<CheckIn["attendance"]>(existing?.attendance ?? {});
  const [wentWell, setWentWell] = useState(existing?.wentWell ?? "");
  const [fellShort, setFellShort] = useState(existing?.fellShort ?? "");
  const [tomorrow, setTomorrow] = useState(existing?.tomorrow ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    update((s) => {
      const tomorrowKey = dayKey(addDays(now, 1));
      // Every missed class goes on the catch-up list once; un-marking it removes it again.
      const missedIds = new Set(Object.entries(attendance).filter(([, v]) => v === "missed").map(([k]) => k));
      const catchUp = s.catchUp.filter((c) => !(c.date === key && c.id.startsWith("cu:") && !missedIds.has(c.id.slice(3))));
      for (const ev of lectures) {
        if (missedIds.has(ev.id) && !catchUp.some((c) => c.id === `cu:${ev.id}`)) {
          catchUp.push({ id: `cu:${ev.id}`, title: ev.title, date: key, done: false });
        }
      }
      return {
        ...s,
        catchUp,
        checkins: { ...s.checkins, [key]: { date: key, attendance, wentWell, fellShort, tomorrow, savedAt: new Date().toISOString() } },
        focus: tomorrow.trim() && !s.focus[tomorrowKey] ? { ...s.focus, [tomorrowKey]: tomorrow.trim() } : s.focus,
      };
    });
    setSaved(true);
  };

  return (
    <>
      {lectures.length > 0 && (
        <>
          <h2>Did you make it to class?</h2>
          <div className="list">
            {lectures.map((e) => (
              <div className="row" key={e.id}>
                <div className="grow">
                  <div className="title">{e.title}</div>
                  <div className="meta">{fmtTime(e.start)}</div>
                </div>
                <div className="seg" role="group" aria-label={`Attendance for ${e.title}`}>
                  <button
                    type="button"
                    className={attendance[e.id] === "attended" ? "on-good" : ""}
                    aria-pressed={attendance[e.id] === "attended"}
                    onClick={() => setAttendance({ ...attendance, [e.id]: "attended" })}
                  >
                    Went
                  </button>
                  <button
                    type="button"
                    className={attendance[e.id] === "missed" ? "on-bad" : ""}
                    aria-pressed={attendance[e.id] === "missed"}
                    onClick={() => setAttendance({ ...attendance, [e.id]: "missed" })}
                  >
                    Missed
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            Missed classes go on your catch-up list.
          </p>
        </>
      )}

      <h2>Prayer today</h2>
      <PracticeList date={now} />

      <h2>Examen</h2>
      <div className="card stack">
        <label className="field">
          Where did you see God today? What went well?
          <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        </label>
        <label className="field">
          Where did you fall short?
          <textarea value={fellShort} onChange={(e) => setFellShort(e.target.value)} />
        </label>
        <label className="field">
          Tomorrow&apos;s one thing
          <input type="text" value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} placeholder="e.g. Write the intro to Essay 2" />
        </label>
      </div>

      <button className="btn primary block" style={{ marginTop: 16 }} onClick={save}>
        {existing ? "Update check-in" : "Finish check-in"}
      </button>
      {saved && (
        <p className="small" style={{ color: "var(--good)", marginTop: 8, textAlign: "center" }}>
          Saved. Good night, and God bless.
        </p>
      )}
    </>
  );
}

export default function CheckInPage() {
  const state = useAppState();
  const hydrated = useHydrated();
  const now = useNow();
  const [newCatch, setNewCatch] = useState("");
  if (!hydrated || !now) return null;

  const key = dayKey(now);
  const pending = state.catchUp.filter((c) => !c.done);
  const s = streak(state, now);

  // Prayer consistency over the last 7 days.
  let planned = 0;
  let done = 0;
  // Only count days since you started using Compass, so week one isn't a wall of zeros.
  const firstDay = [...Object.keys(state.practiceLog), ...Object.keys(state.checkins)].sort()[0] ?? key;
  for (let i = 0; i < 7; i++) {
    const d = addDays(now, -i);
    if (dayKey(d) < firstDay) break;
    const ps = practicesFor(state.practices, d);
    const log = new Set(state.practiceLog[dayKey(d)] ?? []);
    planned += ps.length;
    done += ps.filter((p) => log.has(p.id)).length;
  }

  return (
    <>
      <h1>Evening check-in</h1>
      <p className="sub">Two minutes to look back on today and set up tomorrow.</p>

      <div className="stat" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="num">{s}</div>
          <div className="lbl">day streak</div>
        </div>
        <div className="card">
          <div className="num">{planned ? Math.round((done / planned) * 100) : 0}%</div>
          <div className="lbl">prayer, last 7 days</div>
        </div>
        <div className="card">
          <div className="num">{pending.length}</div>
          <div className="lbl">to catch up</div>
        </div>
      </div>

      <CheckInForm key={key} state={state} now={now} />

      <h2 id="catchup">Catch-up list</h2>
      <div className="list">
        {pending.map((c) => (
          <label className="row" key={c.id} style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              className="check"
              checked={false}
              onChange={() => update((st) => ({ ...st, catchUp: st.catchUp.map((x) => (x.id === c.id ? { ...x, done: true } : x)) }))}
            />
            <div className="grow">
              <div className="title">{c.title}</div>
              <div className="meta">Missed {fmtShortDay(fromDayKey(c.date))}. Watch the recording or get the notes.</div>
            </div>
          </label>
        ))}
        {pending.length === 0 && <div className="empty">You&apos;re all caught up.</div>}
      </div>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCatch.trim()) return;
          update((st) => ({ ...st, catchUp: [...st.catchUp, { id: uid(), title: newCatch.trim(), date: key, done: false }] }));
          setNewCatch("");
        }}
      >
        <input type="text" placeholder="Add something you missed earlier" value={newCatch} onChange={(e) => setNewCatch(e.target.value)} />
        <button className="btn small" type="submit">
          Add
        </button>
      </form>
    </>
  );
}
