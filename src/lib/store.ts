"use client";

import { useSyncExternalStore } from "react";
import type { AppState, CalEvent, WeeklyClass } from "./types";
import { addDays, dayKey, startOfDay } from "./dates";

const KEY = "compass:v1";

export const DEFAULT_STATE: AppState = {
  version: 1,
  name: "",
  feeds: [],
  events: [],
  classes: [],
  deadlines: [],
  practices: [
    { id: "morning", name: "Morning offering", when: "daily" },
    { id: "scripture", name: "Gospel of the day", when: "daily" },
    { id: "rosary", name: "Rosary", when: "daily" },
    { id: "examen", name: "Evening examen", when: "daily" },
    { id: "mass", name: "Mass", when: "sundays" },
  ],
  practiceLog: {},
  focus: {},
  checkins: {},
  catchUp: [],
  tasks: [],
  claudeTaskIds: [],
};

let cache: AppState | null = null;
const listeners = new Set<() => void>();

function read(): AppState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<AppState>) } : DEFAULT_STATE;
  } catch {
    cache = DEFAULT_STATE;
  }
  return cache;
}

function write(next: AppState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory copy so the app still works this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_STATE);
}

/** False during server render and the first client paint, so pages can avoid flashing empty states. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function update(fn: (s: AppState) => AppState) {
  write(fn(read()));
}

export function replaceState(next: AppState) {
  write({ ...DEFAULT_STATE, ...next });
}

/** Expand hand-entered weekly classes into concrete events for a date range. */
export function expandClasses(classes: WeeklyClass[], from: Date, days: number): CalEvent[] {
  const out: CalEvent[] = [];
  const base = startOfDay(from);
  for (let i = 0; i < days; i++) {
    const d = addDays(base, i);
    for (const c of classes) {
      if (c.weekday !== d.getDay()) continue;
      const [sh, sm] = c.start.split(":").map(Number);
      const [eh, em] = c.end.split(":").map(Number);
      const s = new Date(d);
      s.setHours(sh, sm, 0, 0);
      const e = new Date(d);
      e.setHours(eh, em, 0, 0);
      out.push({
        id: `class:${c.id}:${dayKey(d)}`,
        feedId: "classes",
        title: c.name,
        start: s.toISOString(),
        end: e.toISOString(),
        allDay: false,
        location: c.location,
      });
    }
  }
  return out;
}

/** All events (feeds + weekly classes) that touch a given local day, sorted by start. */
export function eventsForDay(state: AppState, day: Date): CalEvent[] {
  const s = startOfDay(day).getTime();
  const e = addDays(startOfDay(day), 1).getTime();
  const feedEvents = state.events.filter((ev) => {
    const a = new Date(ev.start).getTime();
    const b = new Date(ev.end).getTime();
    return a < e && (b > s || (a >= s && a < e));
  });
  return [...feedEvents, ...expandClasses(state.classes, day, 1)].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

/** Events that count as "lectures" for attendance: timetable feed events and weekly classes. */
export function isLecture(state: AppState, ev: CalEvent): boolean {
  if (ev.feedId === "classes") return true;
  const feed = state.feeds.find((f) => f.id === ev.feedId);
  return feed?.kind === "timetable" && !ev.allDay;
}

export const DEADLINE_PATTERN = /\b(due|deadline|submi(t|ssion)|assignment|quiz|exam|test|essay|report|lab)\b/i;

let nowCache: Date | null = null;
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;
const WAKE_EVENTS = ["visibilitychange", "pageshow", "focus"] as const;

// Re-read the clock regularly and whenever the app comes back to the foreground, so a phone left
// overnight (or an app restored from the background) shows the new day.
function tick() {
  nowCache = new Date();
  nowListeners.forEach((x) => x());
}

function subscribeNow(l: () => void) {
  nowListeners.add(l);
  if (!nowTimer) {
    nowCache = new Date();
    nowTimer = setInterval(tick, 20_000);
    WAKE_EVENTS.forEach((e) => window.addEventListener(e, tick));
  }
  return () => {
    nowListeners.delete(l);
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer);
      WAKE_EVENTS.forEach((e) => window.removeEventListener(e, tick));
      nowTimer = null;
    }
  };
}

function nowSnapshot(): Date {
  // Timers are frozen while a phone sleeps, so never hand out a reading more than a minute old.
  if (!nowCache || Date.now() - nowCache.getTime() > 60_000) nowCache = new Date();
  return nowCache;
}

/** Current time, ticking on the client. Null while prerendering, so pages never bake in a build-time date. */
export function useNow(): Date | null {
  return useSyncExternalStore(subscribeNow, nowSnapshot, () => null);
}
