import { parseCalendarWithStats, type OutEvent } from "@/lib/ical-parse";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 5_000_000;

interface FeedRequest {
  id: string;
  url: string;
}


function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 6) {
    const a = addr.toLowerCase();
    if (a === "::1" || a === "::") return true;
    if (a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80")) return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = addr.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Only fetch public http(s) hosts, so this route can't be used to reach internal services. */
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) and webcal links work");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address isn't public");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn't public");
  return url;
}

async function fetchCalendar(raw: string): Promise<string> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { Accept: "text/calendar, */*", "User-Agent": "Compass calendar sync" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The calendar server answered ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new Error("Calendar is too large");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("Calendar is too large");
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link isn't a calendar feed (.ics)");
    return text;
  }
  throw new Error("Too many redirects");
}

export async function POST(request: Request) {
  let body: { feeds?: FeedRequest[]; from?: string; to?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const feeds = (body.feeds ?? []).slice(0, 10);
  const from = body.from ? new Date(body.from) : new Date(Date.now() - 7 * 86400000);
  const to = body.to ? new Date(body.to) : new Date(Date.now() + 60 * 86400000);

  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const text = await fetchCalendar(f.url);
        const { events, total } = parseCalendarWithStats(text, f.id, from, to);
        return { id: f.id, events, total };
      } catch (err) {
        return { id: f.id, events: [] as OutEvent[], error: err instanceof Error ? err.message : "Couldn't load" };
      }
    }),
  );

  return Response.json({ results });
}
