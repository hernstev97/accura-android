import { diffDays, nextOccurrence, occurrencesInWindow, type CalendarDay } from "./calendar";
import type { DebtState } from "./debts";
import type { BudgetItemInput } from "./input";

/** Eine Fälligkeit gilt als „kurz vor Gehalt“, wenn sie 1 bis 7 Kalendertage vor dem Gehalt liegt. */
export const SHORTLY_BEFORE_SALARY_DAYS = 7;

export type UpcomingPayment = {
  id: string;
  name: string;
  source: "budget" | "debt";
  cents: number;
  dueDay: CalendarDay;
  /** Tag des Monats laut Vertrag oder Budgetposten. */
  dayOfMonth: number;
  daysUntilDue: number;
  isShortlyBeforeSalary: boolean;
};

/** Nächster Gehaltstag am oder nach heute; `null` ohne gültigen Gehaltstag. */
export function nextSalaryDay(today: CalendarDay, salaryDay: number | null): CalendarDay | null {
  return salaryDay === null ? null : nextOccurrence(today, salaryDay);
}

export function isShortlyBeforeSalary(dueDay: CalendarDay, salary: CalendarDay): boolean {
  const gap = diffDays(dueDay, salary);
  return gap >= 1 && gap <= SHORTLY_BEFORE_SALARY_DAYS;
}

/**
 * Alle Zahlungen im Fenster [heute, nächster Gehaltstag), chronologisch.
 * Heute fällige Zahlungen zählen mit, Zahlungen am Gehaltstag selbst nicht.
 * Kredite liefern ihre Raten aus dem Tilgungsplan (inklusive Schlussrate),
 * Budgetposten ihren monatlichen Tag, solange der Vertrag läuft.
 */
export function upcomingPayments(
  today: CalendarDay,
  salary: CalendarDay | null,
  budgetItems: readonly BudgetItemInput[],
  debts: readonly DebtState[],
): UpcomingPayment[] {
  if (salary === null) return [];
  const payments: UpcomingPayment[] = [];
  const add = (
    id: string,
    name: string,
    source: UpcomingPayment["source"],
    cents: number,
    dueDay: CalendarDay,
    dayOfMonth: number,
  ) =>
    payments.push({
      id,
      name,
      source,
      cents,
      dueDay,
      dayOfMonth,
      daysUntilDue: diffDays(today, dueDay),
      isShortlyBeforeSalary: isShortlyBeforeSalary(dueDay, salary),
    });

  for (const item of budgetItems) {
    if (!item.active || item.dueDay === null) continue;
    for (const dueDay of occurrencesInWindow(item.dueDay, today, salary)) {
      if (item.contractEndDay !== null && dueDay > item.contractEndDay) continue;
      add(item.id, item.label, "budget", item.monthlyAmountCents, dueDay, item.dueDay);
    }
  }
  for (const debt of debts) {
    for (const row of debt.plan?.upcomingRows ?? []) {
      if (row.day >= salary) break;
      add(debt.input.id, debt.input.lender, "debt", row.paymentCents, row.day, Number(row.day.slice(8)));
    }
  }

  return payments.sort(
    (a, b) =>
      (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : 0) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.id < b.id ? -1 : 1),
  );
}
