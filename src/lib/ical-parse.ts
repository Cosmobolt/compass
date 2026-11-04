import ICAL from "ical.js";

const MAX_OCCURRENCES_PER_EVENT = 400;

export interface OutEvent {
  id: string;
  feedId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

export function parseCalendar(text: string, feedId: string, from: Date, to: Date): OutEvent[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  for (const tz of comp.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(tz);
  }

  const vevents = comp.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid);
    if (m) m.relateException(ex);
  }

  const out: OutEvent[] = [];
  const push = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time, item: ICAL.Event) => {
    const s = start.toJSDate();
    const e = end.toJSDate();
    if (e < from || s > to) return;
    if (item.component.getFirstPropertyValue("status") === "CANCELLED") return;
    out.push({
      id: `${ev.uid}@${s.toISOString()}`,
      feedId,
      title: item.summary || "(untitled)",
      // All-day dates stay as local wall-clock dates, so they land on the right day in any timezone.
      start: start.isDate ? `${start.toString()}T00:00:00` : s.toISOString(),
      end: start.isDate ? `${end.toString().slice(0, 10)}T00:00:00` : e.toISOString(),
      allDay: start.isDate,
      location: item.location || undefined,
    });
  };

  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate ?? ev.startDate, ev);
      continue;
    }
    const it = ev.iterator();
    let next: ICAL.Time | null;
    let count = 0;
    while ((next = it.next()) && count < MAX_OCCURRENCES_PER_EVENT) {
      if (next.toJSDate() > to) break;
      const occ = ev.getOccurrenceDetails(next);
      push(ev, occ.startDate, occ.endDate, occ.item);
      count++;
    }
  }
  return out;
}

