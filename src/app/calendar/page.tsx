"use client";

import Link from "next/link";
import { useState } from "react";
import { eventsForDay, isLecture, useAppState, useHydrated, useNow } from "@/lib/store";
import { addDays, fmtShortDay, fmtTime, logicalDay } from "@/lib/dates";
import { liturgicalDay } from "@/lib/liturgy";
import { syncCalendars } from "@/lib/sync";

export default function Calendar() {
  const state = useAppState();
  const hydrated = useHydrated();
  const now = useNow();
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  if (!hydrated || !now) return null;

  const today = logicalDay(now);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const feedName = (id: string) => (id === "classes" ? "Your classes" : state.feeds.find((f) => f.id === id)?.name ?? "");

  const refresh = async () => {
    setSyncing(true);
    const r = await syncCalendars(state.feeds);
    setErrors(r.errors.map((e) => `${feedName(e.feedId) || "Calendar"}: ${e.error}`));
    setSyncing(false);
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Calendar</h1>
          <p className="sub small">
            {state.eventsFetchedAt
              ? `Updated ${new Date(state.eventsFetchedAt).toLocaleString("en-IE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
              : state.feeds.length
                ? "Not synced yet"
                : "No calendars connected"}
          </p>
        </div>
        {state.feeds.length > 0 ? (
          <button className="btn small" onClick={refresh} disabled={syncing}>
            {syncing ? "Syncing…" : "Refresh"}
          </button>
        ) : (
          <Link className="btn small" href="/settings">
            Connect
          </Link>
        )}
      </div>
      {errors.map((e) => (
        <div className="banner" key={e}>
          {e}
        </div>
      ))}

      {(() => {
        // If nothing falls in the next two weeks, point to the next event so it doesn't look broken.
        const horizon = addDays(today, 14).getTime();
        const later = state.events.filter((e) => new Date(e.start).getTime() >= horizon).sort((a, b) => a.start.localeCompare(b.start));
        const inRange = state.events.some((e) => {
          const t = new Date(e.start).getTime();
          return t >= today.getTime() && t < horizon;
        });
        if (inRange || later.length === 0) return null;
        return (
          <div className="banner accent">
            No calendar events in the next two weeks. Next one: {later[0].title}, {fmtShortDay(new Date(later[0].start))}.
          </div>
        );
      })()}

      {days.map((d) => {
        const evs = eventsForDay(state, d);
        const lit = liturgicalDay(d);
        return (
          <section key={d.toISOString()}>
            <h2 style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{d.getTime() === today.getTime() ? "Today" : fmtShortDay(d)}</span>
              {(lit.name || lit.massObligation) && (
                <span style={{ textTransform: "none", letterSpacing: 0 }}>
                  {lit.name ?? "Sunday Mass"}
                </span>
              )}
            </h2>
            <div className="list">
              {evs.map((e) => (
                <div className="row" key={e.id}>
                  <span className="time">{e.allDay ? "All day" : fmtTime(e.start)}</span>
                  <div className="grow">
                    <div className="title">{e.title}</div>
                    <div className="meta">
                      {feedName(e.feedId)}
                      {e.location ? ` · ${e.location}` : ""}
                    </div>
                  </div>
                  {isLecture(state, e) && <span className="pill">Class</span>}
                </div>
              ))}
              {evs.length === 0 && <div className="empty small">Free</div>}
            </div>
          </section>
        );
      })}
    </>
  );
}
