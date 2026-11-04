"use client";

import type { CalEvent } from "./types";
import { update } from "./store";

export interface SyncResult {
  ok: boolean;
  errors: { feedId: string; error: string }[];
}

let inFlight: Promise<SyncResult> | null = null;

/** Fetch every feed through our server (calendar servers block browser requests) and replace cached events. */
export function syncCalendars(feeds: { id: string; url: string }[]): Promise<SyncResult> {
  if (inFlight) return inFlight;
  if (feeds.length === 0) return Promise.resolve({ ok: true, errors: [] });
  inFlight = (async () => {
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds,
          from: new Date(Date.now() - 14 * 86400000).toISOString(),
          to: new Date(Date.now() + 120 * 86400000).toISOString(),
        }),
      });
      if (!res.ok) return { ok: false, errors: [{ feedId: "*", error: `Server error ${res.status}` }] };
      const data = (await res.json()) as { results: { id: string; events: CalEvent[]; error?: string }[] };
      const errors = data.results.filter((r) => r.error).map((r) => ({ feedId: r.id, error: r.error! }));
      update((s) => {
        // Keep old events for feeds that failed this time, so a flaky network doesn't wipe your week.
        const failed = new Set(errors.map((e) => e.feedId));
        const kept = s.events.filter((e) => failed.has(e.feedId));
        const fresh = data.results.filter((r) => !r.error).flatMap((r) => r.events);
        return { ...s, events: [...kept, ...fresh], eventsFetchedAt: new Date().toISOString() };
      });
      return { ok: errors.length === 0, errors };
    } catch {
      return { ok: false, errors: [{ feedId: "*", error: "You seem to be offline" }] };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
