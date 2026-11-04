import { addDays, dayKey, startOfDay } from "./dates";

export type Season = "Advent" | "Christmas" | "Lent" | "Easter Triduum" | "Easter" | "Ordinary Time";

export interface LiturgicalDay {
  season: Season;
  colour: "violet" | "white" | "green" | "red" | "rose";
  /** Named day, if any (feast, solemnity, key observance). */
  name?: string;
  /** Sunday or holy day of obligation (Ireland). */
  massObligation: boolean;
  fasting: boolean;
  /** Abstinence from meat (Ash Wednesday, Fridays of Lent, Good Friday). */
  abstinence: boolean;
  /** Ordinary Friday outside Lent: some act of penance. */
  fridayPenance: boolean;
}

/** Gregorian Easter Sunday (anonymous algorithm). */
export function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function firstSundayOfAdvent(year: number): Date {
  const christmas = new Date(year, 11, 25);
  const dow = christmas.getDay();
  // Fourth Sunday of Advent is the Sunday before Christmas (or 7 days before if Christmas is a Sunday).
  const fourth = addDays(christmas, -(dow === 0 ? 7 : dow));
  return addDays(fourth, -21);
}

function baptismOfTheLord(year: number): Date {
  // Sunday after Epiphany (6 January, kept on that date in Ireland).
  const epiphany = new Date(year, 0, 6);
  return addDays(epiphany, 7 - epiphany.getDay());
}

/** Fixed holy days of obligation in Ireland, as MM-DD. */
const FIXED: Record<string, { name: string; obligation: boolean }> = {
  "01-01": { name: "Mary, Mother of God", obligation: false },
  "01-06": { name: "Epiphany of the Lord", obligation: true },
  "02-01": { name: "St Brigid", obligation: false },
  "02-02": { name: "Presentation of the Lord", obligation: false },
  "03-17": { name: "St Patrick", obligation: true },
  "03-19": { name: "St Joseph", obligation: false },
  "03-25": { name: "Annunciation of the Lord", obligation: false },
  "06-29": { name: "Ss Peter and Paul", obligation: false },
  "08-15": { name: "Assumption of Mary", obligation: true },
  "11-01": { name: "All Saints", obligation: true },
  "11-02": { name: "All Souls", obligation: false },
  "12-08": { name: "Immaculate Conception", obligation: true },
  "12-25": { name: "Christmas Day", obligation: true },
};

export function liturgicalDay(date: Date = new Date()): LiturgicalDay {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const t = d.getTime();
  const e = easter(y);
  const ashWed = addDays(e, -46);
  const palm = addDays(e, -7);
  const holyThu = addDays(e, -3);
  const goodFri = addDays(e, -2);
  const pentecost = addDays(e, 49);
  const ascension = addDays(e, 39);
  const advent = firstSundayOfAdvent(y);
  const christmas = new Date(y, 11, 25);
  const baptism = baptismOfTheLord(y);

  let season: Season;
  if (t < baptism.getTime() + 86400000 && d.getMonth() === 0) season = "Christmas";
  else if (t >= ashWed.getTime() && t < holyThu.getTime()) season = "Lent";
  else if (t >= holyThu.getTime() && t < e.getTime()) season = "Easter Triduum";
  else if (t >= e.getTime() && t <= pentecost.getTime()) season = "Easter";
  else if (t >= advent.getTime() && t < christmas.getTime()) season = "Advent";
  else if (t >= christmas.getTime()) season = "Christmas";
  else season = "Ordinary Time";

  const colour: LiturgicalDay["colour"] =
    season === "Advent" || season === "Lent"
      ? "violet"
      : season === "Ordinary Time"
        ? "green"
        : season === "Easter Triduum"
          ? "red"
          : "white";

  const key = dayKey(d).slice(5);
  const same = (x: Date) => dayKey(x) === dayKey(d);
  let name: string | undefined = FIXED[key]?.name;
  let obligation = FIXED[key]?.obligation ?? false;

  if (same(ashWed)) name = "Ash Wednesday";
  if (same(palm)) name = "Palm Sunday";
  if (same(holyThu)) name = "Holy Thursday";
  if (same(goodFri)) name = "Good Friday";
  if (same(addDays(e, -1))) name = "Holy Saturday";
  if (same(e)) name = "Easter Sunday";
  if (same(addDays(e, 7))) name = "Divine Mercy Sunday";
  if (same(ascension)) {
    name = "Ascension of the Lord";
    obligation = true;
  }
  if (same(pentecost)) name = "Pentecost";
  if (same(advent)) name = "First Sunday of Advent";
  if (same(baptism)) name = "Baptism of the Lord";
  if (same(addDays(advent, -7))) name = "Christ the King";

  const isSunday = d.getDay() === 0;
  const isFriday = d.getDay() === 5;
  const fasting = same(ashWed) || same(goodFri);
  const abstinence = fasting || (season === "Lent" && isFriday);
  const fridayPenance = isFriday && !abstinence && season !== "Christmas" && !obligation;

  return {
    season,
    colour: same(goodFri) ? "red" : colour,
    name,
    massObligation: isSunday || obligation,
    fasting,
    abstinence,
    fridayPenance,
  };
}
