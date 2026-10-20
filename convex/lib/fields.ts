import type { Doc } from "../_generated/dataModel";

/**
 * Bearbeitbare Felder je Datensatz, so wie die App sie sieht und beim Ändern
 * als `expected` zurückschickt. Fehlende optionale Felder sind `null`, alle
 * Ganzzahlen int64. Dieselben Feldsätze liefern `records:list` zum Bearbeiten
 * und ein Konflikt als `current`; der Export baut darauf auf.
 */

export function settingsFields(user: Doc<"users">) {
  return {
    monthlyIncomeCents: user.monthlyIncomeCents ?? null,
    salaryDay: user.salaryDay ?? null,
    homeTimeZone: user.homeTimeZone,
  };
}

export function accountFields(account: Doc<"accounts">) {
  return { name: account.name, kind: account.kind, order: account.order, active: account.active };
}

export function pocketFields(pocket: Doc<"pockets">) {
  return { accountId: pocket.accountId, name: pocket.name, order: pocket.order, active: pocket.active };
}

export function budgetItemFields(item: Doc<"budgetItems">) {
  return {
    label: item.label,
    monthlyAmountCents: item.monthlyAmountCents,
    necessity: item.necessity,
    kind: item.kind,
    category: item.category,
    dueDay: item.dueDay ?? null,
    contractType: item.contractType ?? null,
    contractEndDay: item.contractEndDay ?? null,
    noticePeriodDays: item.noticePeriodDays ?? null,
    noticePeriodMonths: item.noticePeriodMonths ?? null,
    note: item.note ?? null,
    order: item.order,
    active: item.active,
  };
}

export function debtFields(debt: Doc<"debts">) {
  return {
    lender: debt.lender,
    kind: debt.kind,
    principalCents: debt.principalCents,
    nominalRateBps: debt.nominalRateBps,
    effectiveRateBps: debt.effectiveRateBps,
    monthlyPaymentCents: debt.monthlyPaymentCents,
    firstPaymentDay: debt.firstPaymentDay,
    paymentCount: debt.paymentCount,
    finalPaymentCents: debt.finalPaymentCents ?? null,
    specialRepaymentYearlyCents: debt.specialRepaymentYearlyCents ?? null,
    note: debt.note ?? null,
    order: debt.order,
    active: debt.active,
  };
}

export function householdMemberFields(member: Doc<"householdMembers">) {
  return { label: member.label, dailyKcal: member.dailyKcal, active: member.active };
}

/** Stand eines Kontos oder Pockets, wie ihn die App gesehen hat. */
export function standFields(row: Doc<"accountBalances"> | Doc<"pocketBalances">) {
  return { day: row.day, balanceCents: row.balanceCents };
}

export function debtStandFields(row: Doc<"debtBalances">) {
  return { day: row.day, balanceCents: row.balanceCents, payoffQuoteCents: row.payoffQuoteCents ?? null };
}

/** Flacher Feldsatz: Text, int64, Wahrheitswert oder `null`. */
export type FieldSet = Record<string, string | bigint | boolean | null>;

/** Gleiche Werte in allen Feldern beider Seiten. Ganzzahlen sind `bigint` und werden nach Wert verglichen. */
export function sameFields(a: FieldSet | null, b: FieldSet | null): boolean {
  if (a === null || b === null) return a === b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** Nach `order`, bei gleicher Reihenfolge nach Kennung (wie die Ansichten). */
export function byOrder<T extends { order: bigint; _id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
}
