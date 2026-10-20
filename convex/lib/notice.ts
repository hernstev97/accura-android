import {
  addDays,
  addMonthsToMonth,
  daysInMonth,
  diffDays,
  formatDay,
  isCalendarDay,
  monthOf,
  parseDay,
  type CalendarDay,
} from "./calendar";

/**
 * Letzter Kündigungstag eines Vertrags: der letzte Tag, an dem die Kündigung
 * beim Anbieter angekommen sein muss, damit der Vertrag zum erfassten
 * Vertragsende endet. Kalenderrechnung ohne Uhr; das heutige Datum ist ein
 * Argument.
 *
 * Fristrechnung nach §§ 187, 188 BGB, rückwärts vom Vertragsende:
 * - Der Tag, an dem die Kündigung ankommt, zählt nicht mit. Eine Frist von
 *   N Tagen endet N Tage danach. Letzter Kündigungstag = Vertragsende − N Tage.
 * - Eine Frist von N Monaten endet am Tag mit derselben Zahl N Monate später,
 *   fehlt dieser Tag, am Monatsletzten. Rückwärts: vom Tag nach dem
 *   Vertragsende N Monate zurück; gibt es diesen Tag nicht (30. Februar),
 *   beginnt die Frist am Ersten des Folgemonats. Der Tag davor ist der letzte
 *   Kündigungstag. Beispiel: Ende 31.12., 3 Monate → 30.09.
 * - Wochenenden und Feiertage verschieben nichts.
 */

/** Längste Kündigungsfrist, die als plausibel gilt: zehn Jahre. */
export const MAX_NOTICE_PERIOD_DAYS = 3_660;
export const MAX_NOTICE_PERIOD_MONTHS = 120;

export type NoticeFields = {
  contractEndDay: string | null;
  noticePeriodDays: number | null;
  noticePeriodMonths: number | null;
};

/**
 * open: der letzte Kündigungstag ist heute oder später; passed: er ist vorbei;
 * incomplete: Vertragsende oder Frist fehlt; invalid: die Angaben passen nicht.
 */
export type CancellationState = "open" | "passed" | "incomplete" | "invalid";

export type Cancellation = {
  state: CancellationState;
  /** Wie gespeichert, auch wenn es kein gültiger Tag ist. */
  contractEndDay: string | null;
  noticePeriodDays: number | null;
  noticePeriodMonths: number | null;
  lastNoticeDay: CalendarDay | null;
  /** Tage von heute bis zum letzten Kündigungstag: 0 = heute, negativ = vorbei. */
  daysUntilLastNoticeDay: number | null;
  /** Hinweis bei passed, incomplete und invalid; bei open `null`. */
  reason: string | null;
};

export function lastNoticeDayByDays(contractEnd: CalendarDay, days: number): CalendarDay {
  return addDays(contractEnd, -days);
}

export function lastNoticeDayByMonths(contractEnd: CalendarDay, months: number): CalendarDay {
  const dayAfterEnd = addDays(contractEnd, 1);
  const { day } = parseDay(dayAfterEnd)!;
  const month = addMonthsToMonth(monthOf(dayAfterEnd), -months);
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const periodStart =
    day <= daysInMonth(year, monthNumber)
      ? formatDay(year, monthNumber, day)
      : `${addMonthsToMonth(month, 1)}-01`;
  return addDays(periodStart, -1);
}

const isNoticeAmount = (value: number, max: number) => Number.isSafeInteger(value) && value >= 0 && value <= max;

/** `null`, wenn weder Vertragsende noch Kündigungsfrist erfasst sind. */
export function cancellation(fields: NoticeFields, today: CalendarDay): Cancellation | null {
  const { contractEndDay, noticePeriodDays, noticePeriodMonths } = fields;
  if (contractEndDay === null && noticePeriodDays === null && noticePeriodMonths === null) return null;

  const result = (state: CancellationState, reason: string | null, lastNoticeDay: CalendarDay | null = null): Cancellation => ({
    state,
    contractEndDay,
    noticePeriodDays,
    noticePeriodMonths,
    lastNoticeDay,
    daysUntilLastNoticeDay: lastNoticeDay === null ? null : diffDays(today, lastNoticeDay),
    reason,
  });

  if (contractEndDay !== null && !isCalendarDay(contractEndDay)) return result("invalid", "Das Vertragsende ist kein gültiger Tag.");
  if (noticePeriodDays !== null && noticePeriodMonths !== null) {
    return result("invalid", "Die Kündigungsfrist steht in Tagen und in Monaten da. Es darf nur eine Angabe sein.");
  }
  if (
    (noticePeriodDays !== null && !isNoticeAmount(noticePeriodDays, MAX_NOTICE_PERIOD_DAYS)) ||
    (noticePeriodMonths !== null && !isNoticeAmount(noticePeriodMonths, MAX_NOTICE_PERIOD_MONTHS))
  ) {
    return result("invalid", "Die Kündigungsfrist ist ungültig.");
  }
  if (contractEndDay === null) return result("incomplete", "Das Vertragsende fehlt.");
  if (noticePeriodDays === null && noticePeriodMonths === null) return result("incomplete", "Die Kündigungsfrist fehlt.");

  let lastNoticeDay: CalendarDay | null;
  try {
    lastNoticeDay =
      noticePeriodMonths !== null
        ? lastNoticeDayByMonths(contractEndDay, noticePeriodMonths)
        : lastNoticeDayByDays(contractEndDay, noticePeriodDays!);
  } catch {
    lastNoticeDay = null;
  }
  // Nur bei absurden Daten am Rand des Kalenders (vor dem Jahr 1).
  if (lastNoticeDay === null || !isCalendarDay(lastNoticeDay)) return result("invalid", "Das Vertragsende ist kein gültiger Tag.");

  if (lastNoticeDay >= today) return result("open", null, lastNoticeDay);
  return result(
    "passed",
    contractEndDay < today
      ? "Das Vertragsende ist vorbei. Hat sich der Vertrag verlängert, trag das neue Ende ein, dann nennt accura den nächsten Kündigungstag."
      : "Der letzte Kündigungstag für dieses Vertragsende ist vorbei.",
    lastNoticeDay,
  );
}
