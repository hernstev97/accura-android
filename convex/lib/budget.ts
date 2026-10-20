import { NECESSITIES, sortByOrder, type BudgetItemInput, type Necessity } from "./input";
import { sumCents } from "./money";

export type BudgetTotals = {
  /** Aktive Posten in Anzeigereihenfolge. */
  items: BudgetItemInput[];
  expenseItems: BudgetItemInput[];
  reserveItems: BudgetItemInput[];
  expensesCents: number;
  reservesCents: number;
  plannedCents: number;
  byNecessity: { necessity: Necessity; totalCents: number }[];
  byCategory: { category: string; totalCents: number }[];
};

export function budgetTotals(all: readonly BudgetItemInput[]): BudgetTotals {
  const items = sortByOrder(all.filter((item) => item.active));
  const expenseItems = items.filter((item) => item.kind === "expense");
  const reserveItems = items.filter((item) => item.kind === "reserve");
  const expensesCents = sumCents(expenseItems.map((item) => item.monthlyAmountCents));
  const reservesCents = sumCents(reserveItems.map((item) => item.monthlyAmountCents));

  const byNecessity = NECESSITIES.map((necessity) => ({
    necessity,
    totalCents: sumCents(items.filter((item) => item.necessity === necessity).map((item) => item.monthlyAmountCents)),
  }));

  const categories = new Map<string, number>();
  for (const item of items) categories.set(item.category, (categories.get(item.category) ?? 0) + item.monthlyAmountCents);
  const byCategory = [...categories.entries()]
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents || (a.category < b.category ? -1 : 1));

  return {
    items,
    expenseItems,
    reserveItems,
    expensesCents,
    reservesCents,
    plannedCents: expensesCents + reservesCents,
    byNecessity,
    byCategory,
  };
}
