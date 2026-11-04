export type FeedKind = "timetable" | "lms" | "personal";

export interface Feed {
  id: string;
  name: string;
  url: string;
  kind: FeedKind;
}

/** One occurrence of a calendar event, already expanded from any recurrence. */
export interface CalEvent {
  id: string;
  feedId: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
}

/** A class you enter by hand, repeating every week. */
export interface WeeklyClass {
  id: string;
  name: string;
  weekday: number; // 0 = Sunday
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  location?: string;
}

export interface Step {
  id: string;
  text: string;
  done: boolean;
}

export interface Deadline {
  id: string;
  title: string;
  course?: string;
  due: string; // local "YYYY-MM-DDTHH:MM"
  done: boolean;
  steps: Step[];
  sourceEventId?: string;
}

export interface Practice {
  id: string;
  name: string;
  /** Which days it applies to. "sundays" also covers holy days of obligation. */
  when: "daily" | "sundays" | "weekdays";
}

export interface CatchUp {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD it was missed
  done: boolean;
}

export interface CheckIn {
  date: string; // YYYY-MM-DD
  attendance: Record<string, "attended" | "missed">; // keyed by event id
  wentWell: string;
  fellShort: string;
  tomorrow: string;
  savedAt: string;
}

export type TaskStatus = "todo" | "partial" | "done" | "skipped";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  due?: string; // YYYY-MM-DD
  important?: boolean;
  status: TaskStatus;
  /** Where it came from: added in the app, or sent by Claude through claude-tasks.json. */
  source: "me" | "claude";
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  version: 1;
  name: string;
  feeds: Feed[];
  events: CalEvent[];
  eventsFetchedAt?: string;
  classes: WeeklyClass[];
  deadlines: Deadline[];
  practices: Practice[];
  /** practice completions: date -> practice ids done */
  practiceLog: Record<string, string[]>;
  /** "one thing" per day: date -> text */
  focus: Record<string, string>;
  checkins: Record<string, CheckIn>;
  catchUp: CatchUp[];
  tasks: Task[];
  /** Ids of Claude-sent tasks already imported, so deleting one doesn't bring it back. */
  claudeTaskIds: string[];
}
