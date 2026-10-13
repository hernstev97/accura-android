import { diffDays, type CalendarDay } from "./calendar";

/** Ab so vielen Tagen gilt ein Konto- oder Pocket-Stand als alt (ruhiger Hinweis, keine Fehlermeldung). */
export const BALANCE_STALE_AFTER_DAYS = 7;

/** Ab so vielen Tagen gilt ein bestätigter Kreditstand als alt. Der Plan rechnet dann weiter, der Bankstand fehlt aber. */
export const DEBT_ANCHOR_STALE_AFTER_DAYS = 90;

export function ageInDays(day: CalendarDay, today: CalendarDay): number {
  return Math.max(0, diffDays(day, today));
}

export function isStale(day: CalendarDay, today: CalendarDay, thresholdDays: number): boolean {
  return ageInDays(day, today) > thresholdDays;
}
