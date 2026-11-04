export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" });
}

export function fmtShortDay(d: Date): string {
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}

/** "in 3 days", "tomorrow", "2 days ago" style label for a due date. */
export function relativeDue(due: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86400000);
  if (due.getTime() < now.getTime()) {
    if (days === 0) return "overdue today";
    return days === -1 ? "1 day overdue" : `${-days} days overdue`;
  }
  if (days === 0) return `today at ${fmtTime(due)}`;
  if (days === 1) return `tomorrow at ${fmtTime(due)}`;
  if (days < 7) return `${due.toLocaleDateString("en-IE", { weekday: "long" })} (${days} days)`;
  return `${fmtShortDay(due)} (${days} days)`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
