/**
 * Kalenderrechnung ohne Uhr und ohne lokale Zeitzone.
 *
 * Ein Kalendertag ist der Text "YYYY-MM-DD". Gerechnet wird über fortlaufende
 * Tagesnummern (proleptischer gregorianischer Kalender), nie über `Date` in
 * der Zeitzone des Servers. Das heutige Datum kommt immer als Argument.
 */

export type CalendarDay = string;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const pad = (value: number, width: number) => String(value).padStart(width, "0");

export function formatDay(year: number, month: number, day: number): CalendarDay {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export type DayParts = { year: number; month: number; day: number };

/** Strenge Prüfung: Format und Existenz ("2026-02-31" gibt es nicht). */
export function parseDay(value: string): DayParts | null {
  const match = DAY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isCalendarDay(value: unknown): value is CalendarDay {
  return typeof value === "string" && parseDay(value) !== null;
}

export function assertCalendarDay(value: string, what = "Datum"): CalendarDay {
  if (!isCalendarDay(value)) throw new Error(`${what} ist kein gültiger Kalendertag (JJJJ-MM-TT).`);
  return value;
}

export function isMonth(value: string): boolean {
  const match = MONTH_PATTERN.exec(value);
  return match !== null && Number(match[1]) >= 1 && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** Tage seit 1970-01-01 (Algorithmus nach Howard Hinnant). */
function toEpochDay({ year, month, day }: DayParts): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function fromEpochDay(epochDay: number): CalendarDay {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime < 10 ? monthPrime + 3 : monthPrime - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return formatDay(year, month, day);
}

function mustParse(value: string): DayParts {
  const parts = parseDay(value);
  if (!parts) throw new Error(`Ungültiger Kalendertag: ${value}`);
  return parts;
}

export function addDays(value: CalendarDay, days: number): CalendarDay {
  return fromEpochDay(toEpochDay(mustParse(value)) + days);
}

/** Anzahl Kalendertage von `from` bis `to` (negativ, wenn `to` früher liegt). */
export function diffDays(from: CalendarDay, to: CalendarDay): number {
  return toEpochDay(mustParse(to)) - toEpochDay(mustParse(from));
}

/** Monat als "YYYY-MM". */
export function monthOf(value: CalendarDay): string {
  return value.slice(0, 7);
}

export function addMonthsToMonth(month: string, months: number): string {
  const [yearText, monthText] = month.split("-");
  const index = Number(yearText) * 12 + (Number(monthText) - 1) + months;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1, 2)}`;
}

/** Letzter Tag des Monats "YYYY-MM". */
export function lastDayOfMonth(month: string): CalendarDay {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return formatDay(year, monthNumber, daysInMonth(year, monthNumber));
}

/** Tag 29 bis 31 rutscht in kurzen Monaten auf den letzten Tag des Monats. */
export function dayInMonth(month: string, dayOfMonth: number): CalendarDay {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return formatDay(year, monthNumber, Math.min(dayOfMonth, daysInMonth(year, monthNumber)));
}

export function isDayOfMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

/**
 * Das n-te monatliche Vorkommen eines Tages, ausgehend vom Starttag.
 * Der Tag des Monats bleibt der des Starttags (31. Jan. → 28. Feb. → 31. März).
 */
export function addMonthsKeepingDay(start: CalendarDay, months: number): CalendarDay {
  const { day } = mustParse(start);
  return dayInMonth(addMonthsToMonth(monthOf(start), months), day);
}

/** Alle Vorkommen von `dayOfMonth` im Fenster [from, toExclusive), aufsteigend. */
export function occurrencesInWindow(
  dayOfMonth: number,
  from: CalendarDay,
  toExclusive: CalendarDay,
): CalendarDay[] {
  if (!isDayOfMonth(dayOfMonth) || toExclusive <= from) return [];
  const result: CalendarDay[] = [];
  const lastMonth = monthOf(toExclusive);
  for (let month = monthOf(from); month <= lastMonth; month = addMonthsToMonth(month, 1)) {
    const occurrence = dayInMonth(month, dayOfMonth);
    if (occurrence >= from && occurrence < toExclusive) result.push(occurrence);
  }
  return result;
}

/** Nächstes Vorkommen am oder nach `today`. */
export function nextOccurrence(today: CalendarDay, dayOfMonth: number): CalendarDay | null {
  if (!isDayOfMonth(dayOfMonth)) return null;
  const thisMonth = dayInMonth(monthOf(today), dayOfMonth);
  if (thisMonth >= today) return thisMonth;
  return dayInMonth(addMonthsToMonth(monthOf(today), 1), dayOfMonth);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ob `day` zum Zeitpunkt `nowMs` in irgendeiner Zeitzone „heute“ sein kann:
 * höchstens einen Tag vom UTC-Datum entfernt (Zeitzonen reichen von UTC−12
 * bis UTC+14). Bestimmt keinen Tag, sondern prüft den vom Gerät gelieferten,
 * damit ein falsch gestelltes Datum keinen Stand weit in Zukunft oder
 * Vergangenheit anlegt. Nur für Mutationen.
 */
export function isPlausibleToday(day: CalendarDay, nowMs: number): boolean {
  if (!isCalendarDay(day) || !Number.isFinite(nowMs)) return false;
  const utcToday = new Date(nowMs).toISOString().slice(0, 10);
  return Math.abs(diffDays(utcToday, day)) <= 1;
}

/**
 * Kalendertag eines Zeitpunkts in einer IANA-Zeitzone. Für Mutationen und
 * Clients gedacht (z. B. der Tag eines `recordedAt`), nie für Abfragen.
 */
export function calendarDayInZone(epochMs: number, timeZone: string): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
