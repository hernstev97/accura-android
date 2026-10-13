import type { BankAnchor, LoanTerms } from "./amortization";
import type { CalendarDay } from "./calendar";

/** Eingabe des Rechenkerns: reine Daten, keine Datenbank-Typen, alle Beträge in Cent als sichere Integer. */

export type Stand = {
  /** Tag, für den der Stand gilt. */
  day: CalendarDay;
  cents: number;
  /** Kalendertag (in Stevens Zeitzone), an dem der Stand eingetragen wurde. */
  recordedDay: CalendarDay | null;
};

export type AccountKind = "bank" | "wallet" | "cash";

export type AccountInput = {
  id: string;
  name: string;
  kind: AccountKind;
  order: number;
  active: boolean;
  /** Jüngster Stand; der Kern ignoriert Stände nach dem heutigen Tag. */
  stand: Stand | null;
};

export type PocketInput = {
  id: string;
  accountId: string;
  name: string;
  order: number;
  active: boolean;
  stand: Stand | null;
};

export const NECESSITIES = ["essential", "necessary", "worthwhile", "optional", "unnecessary"] as const;
export type Necessity = (typeof NECESSITIES)[number];

export type BudgetKind = "expense" | "reserve";

export type BudgetItemInput = {
  id: string;
  label: string;
  monthlyAmountCents: number;
  necessity: Necessity;
  kind: BudgetKind;
  category: string;
  dueDay: number | null;
  /** Art eines Abos oder Vertrags, freier Text; `null`, wenn nicht erfasst. */
  contractType: string | null;
  /** Wie gespeichert; der Kern prüft, ob es ein gültiger Tag ist. */
  contractEndDay: string | null;
  noticePeriodDays: number | null;
  noticePeriodMonths: number | null;
  /** Stand des Postens beim „bewusst so“; `null`, wenn kein Hinweis ausgeblendet ist. */
  waivedHintFingerprint: string | null;
  order: number;
  active: boolean;
};

export type DebtKind = "loan" | "installment";

export type DebtInput = {
  id: string;
  lender: string;
  kind: DebtKind;
  terms: LoanTerms;
  effectiveRateBps: number;
  note: string | null;
  order: number;
  active: boolean;
  /** Jüngster bestätigter Bankstand bis heute. */
  anchor: (BankAnchor & { recordedDay: CalendarDay | null }) | null;
};

export type FinanceInput = {
  /** Heutiger Kalendertag in Stevens Zeitzone; kommt vom Aufrufer. */
  today: CalendarDay;
  incomeCents: number | null;
  salaryDay: number | null;
  accounts: AccountInput[];
  pockets: PocketInput[];
  budgetItems: BudgetItemInput[];
  debts: DebtInput[];
};

export const sortByOrder = <T extends { order: number; id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
