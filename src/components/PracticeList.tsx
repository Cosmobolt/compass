"use client";

import { update, useAppState } from "@/lib/store";
import { dayKey } from "@/lib/dates";
import { liturgicalDay } from "@/lib/liturgy";
import type { Practice } from "@/lib/types";

export function practicesFor(practices: Practice[], date: Date): Practice[] {
  const lit = liturgicalDay(date);
  const dow = date.getDay();
  return practices.filter((p) =>
    p.when === "daily" ? true : p.when === "sundays" ? lit.massObligation : dow >= 1 && dow <= 5,
  );
}

export default function PracticeList({ date }: { date: Date }) {
  const state = useAppState();
  const key = dayKey(date);
  const done = new Set(state.practiceLog[key] ?? []);
  const list = practicesFor(state.practices, date);

  const toggle = (id: string) =>
    update((s) => {
      const cur = new Set(s.practiceLog[key] ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...s, practiceLog: { ...s.practiceLog, [key]: [...cur] } };
    });

  if (list.length === 0) return <div className="list"><div className="empty">No practices set. Add some in Setup.</div></div>;

  return (
    <div className="list">
      {list.map((p) => (
        <label className={`row${done.has(p.id) ? " done" : ""}`} key={p.id} style={{ cursor: "pointer" }}>
          <input type="checkbox" className="check" checked={done.has(p.id)} onChange={() => toggle(p.id)} />
          <div className="grow">
            <div className="title">{p.name}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
