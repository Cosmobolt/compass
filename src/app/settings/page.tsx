"use client";

import { useRef, useState } from "react";
import { DEFAULT_STATE, replaceState, update, useAppState, useHydrated } from "@/lib/store";
import { uid } from "@/lib/dates";
import { syncCalendars } from "@/lib/sync";
import type { AppState, FeedKind, Practice } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const KIND_LABEL: Record<FeedKind, string> = {
  timetable: "Timetable (lectures)",
  lms: "Brightspace (deadlines)",
  personal: "Personal / Outlook",
};

export default function Settings() {
  const state = useAppState();
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);

  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedKind, setFeedKind] = useState<FeedKind>("lms");
  const [feedMsg, setFeedMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const [cName, setCName] = useState("");
  const [cDay, setCDay] = useState(1);
  const [cStart, setCStart] = useState("09:00");
  const [cEnd, setCEnd] = useState("10:00");
  const [cLoc, setCLoc] = useState("");

  const [pName, setPName] = useState("");
  const [pWhen, setPWhen] = useState<Practice["when"]>("daily");

  if (!hydrated) return null;

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim()) return;
    setAdding(true);
    setFeedMsg("");
    const feed = { id: uid(), name: feedName.trim() || KIND_LABEL[feedKind], url: feedUrl.trim(), kind: feedKind };
    const next = [...state.feeds, feed];
    update((s) => ({ ...s, feeds: next }));
    const r = await syncCalendars(next);
    const mine = r.errors.find((x) => x.feedId === feed.id || x.feedId === "*");
    if (mine) {
      setFeedMsg(`Added, but it didn't load: ${mine.error}. Check the link.`);
    } else {
      setFeedMsg("Connected.");
      setFeedName("");
      setFeedUrl("");
    }
    setAdding(false);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `compass-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (parsed.version !== 1) throw new Error();
      replaceState(parsed);
      alert("Backup restored.");
    } catch {
      alert("That file isn't a Compass backup.");
    }
  };

  return (
    <>
      <h1>Setup</h1>

      <h2>You</h2>
      <div className="card">
        <label className="field">
          Your first name
          <input type="text" value={state.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} placeholder="J" />
        </label>
      </div>

      <h2>Calendars</h2>
      <div className="list">
        {state.feeds.map((f) => (
          <div className="row" key={f.id}>
            <div className="grow">
              <div className="title">{f.name}</div>
              <div className="meta">{KIND_LABEL[f.kind]}</div>
            </div>
            <button
              className="btn small danger"
              onClick={() => update((s) => ({ ...s, feeds: s.feeds.filter((x) => x.id !== f.id), events: s.events.filter((x) => x.feedId !== f.id) }))}
            >
              Remove
            </button>
          </div>
        ))}
        {state.feeds.length === 0 && <div className="empty">No calendars yet.</div>}
      </div>

      <form className="card stack" style={{ marginTop: 10 }} onSubmit={addFeed}>
        <label className="field">
          What kind of calendar?
          <select value={feedKind} onChange={(e) => setFeedKind(e.target.value as FeedKind)}>
            {(Object.keys(KIND_LABEL) as FeedKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Calendar link (.ics or webcal://)
          <input type="url" inputMode="url" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://…" required />
        </label>
        <label className="field">
          Name (optional)
          <input type="text" value={feedName} onChange={(e) => setFeedName(e.target.value)} placeholder="Brightspace" />
        </label>
        <button className="btn primary block" disabled={adding}>
          {adding ? "Connecting…" : "Connect calendar"}
        </button>
        {feedMsg && <p className="small">{feedMsg}</p>}
        <details>
          <summary>Where do I find these links?</summary>
          <ol className="help">
            <li>
              <strong>Brightspace:</strong> open Calendar, choose Subscribe, and copy the link. It includes your assignment due dates.
            </li>
            <li>
              <strong>Outlook (UCD Connect):</strong> in Outlook on the web go to Settings, Calendar, Shared calendars, Publish a calendar.
              Pick your calendar, choose &quot;Can view all details&quot;, Publish, then copy the ICS link.
            </li>
            <li>
              <strong>Google Calendar:</strong> Settings, pick the calendar, &quot;Secret address in iCal format&quot;.
            </li>
            <li>
              <strong>Timetable:</strong> if your UCD timetable gives you a calendar or subscribe link, add it as Timetable. If not, add
              your classes by hand below. It takes five minutes and you only do it once a term.
            </li>
          </ol>
        </details>
      </form>

      <h2>Weekly classes</h2>
      <div className="list">
        {[...state.classes]
          .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
          .map((c) => (
            <div className="row" key={c.id}>
              <div className="grow">
                <div className="title">{c.name}</div>
                <div className="meta">
                  {DAYS[c.weekday]} {c.start} to {c.end}
                  {c.location ? ` · ${c.location}` : ""}
                </div>
              </div>
              <button className="btn small danger" onClick={() => update((s) => ({ ...s, classes: s.classes.filter((x) => x.id !== c.id) }))}>
                Remove
              </button>
            </div>
          ))}
        {state.classes.length === 0 && <div className="empty">No classes added by hand.</div>}
      </div>
      <form
        className="card stack"
        style={{ marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!cName.trim() || cEnd <= cStart) return;
          update((s) => ({
            ...s,
            classes: [...s.classes, { id: uid(), name: cName.trim(), weekday: cDay, start: cStart, end: cEnd, location: cLoc.trim() || undefined }],
          }));
          setCName("");
          setCLoc("");
        }}
      >
        <label className="field">
          Class
          <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="COMP20010 Lecture" required />
        </label>
        <div className="grid2">
          <label className="field">
            Day
            <select value={cDay} onChange={(e) => setCDay(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Room
            <input type="text" value={cLoc} onChange={(e) => setCLoc(e.target.value)} placeholder="Science Hub H2.38" />
          </label>
          <label className="field">
            Starts
            <input type="time" value={cStart} onChange={(e) => setCStart(e.target.value)} />
          </label>
          <label className="field">
            Ends
            <input type="time" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
          </label>
        </div>
        <button className="btn block">Add class</button>
      </form>

      <h2>Prayer and practices</h2>
      <div className="list">
        {state.practices.map((p) => (
          <div className="row" key={p.id}>
            <div className="grow">
              <div className="title">{p.name}</div>
              <div className="meta">{p.when === "daily" ? "Every day" : p.when === "sundays" ? "Sundays and holy days" : "Weekdays"}</div>
            </div>
            <button className="btn small danger" onClick={() => update((s) => ({ ...s, practices: s.practices.filter((x) => x.id !== p.id) }))}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <form
        className="card stack"
        style={{ marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pName.trim()) return;
          update((s) => ({ ...s, practices: [...s.practices, { id: uid(), name: pName.trim(), when: pWhen }] }));
          setPName("");
        }}
      >
        <div className="grid2">
          <label className="field">
            Practice
            <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Angelus" />
          </label>
          <label className="field">
            When
            <select value={pWhen} onChange={(e) => setPWhen(e.target.value as Practice["when"])}>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="sundays">Sundays and holy days</option>
            </select>
          </label>
        </div>
        <button className="btn block">Add practice</button>
      </form>

      <h2>Your data</h2>
      <div className="card stack">
        <p className="small muted">
          Everything is saved on this device only. Download a backup now and then, and use it to move to a new phone.
        </p>
        <div className="btnrow">
          <button className="btn small" onClick={exportData}>
            Download backup
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
          />
          <button
            className="btn small danger"
            onClick={() => {
              if (confirm("Erase everything in Compass on this device?")) replaceState(DEFAULT_STATE);
            }}
          >
            Erase all
          </button>
        </div>
      </div>
    </>
  );
}
