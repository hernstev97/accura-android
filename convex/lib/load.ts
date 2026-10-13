import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { calendarDayInZone, type CalendarDay } from "./calendar";
import type { AccountInput, BudgetItemInput, DebtInput, FinanceInput, PocketInput, Stand } from "./input";
import { fromInt64, fromOptionalInt64 } from "./wire";

type Db = QueryCtx["db"];

function recordedDay(recordedAt: bigint, timeZone: string): CalendarDay | null {
  try {
    return calendarDayInZone(Number(recordedAt), timeZone);
  } catch {
    return null;
  }
}

export function emptyInput(today: CalendarDay): FinanceInput {
  return { today, incomeCents: null, salaryDay: null, accounts: [], pockets: [], budgetItems: [], debts: [] };
}

/**
 * Liest die Daten eines Nutzers und bringt sie in die Form des Rechenkerns.
 * Von jedem Konto, Pocket und Kredit wird der jüngste Stand bis einschließlich
 * heute gelesen (bei mehreren am selben Tag der zuletzt angelegte). Spätere
 * Stände werden nicht gelesen.
 */
export async function loadFinanceInput(db: Db, user: Doc<"users"> | null, today: CalendarDay): Promise<FinanceInput> {
  if (user === null) return emptyInput(today);
  const userId = user._id;
  const zone = user.homeTimeZone;

  const [accounts, pockets, budgetItems, debts] = await Promise.all([
    db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    db.query("pockets").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    db.query("debts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
  ]);

  const toStand = (row: { day: string; balanceCents: bigint; recordedAt: bigint } | null): Stand | null =>
    row === null ? null : { day: row.day, cents: fromInt64(row.balanceCents), recordedDay: recordedDay(row.recordedAt, zone) };

  const accountInputs: AccountInput[] = await Promise.all(
    accounts.map(async (account) => ({
      id: account._id,
      name: account.name,
      kind: account.kind,
      order: fromInt64(account.order),
      active: account.active,
      stand: toStand(
        await db
          .query("accountBalances")
          .withIndex("by_user_account_day", (q) => q.eq("userId", userId).eq("accountId", account._id as Id<"accounts">).lte("day", today))
          .order("desc")
          .first(),
      ),
    })),
  );

  const pocketInputs: PocketInput[] = await Promise.all(
    pockets.map(async (pocket) => ({
      id: pocket._id,
      accountId: pocket.accountId,
      name: pocket.name,
      order: fromInt64(pocket.order),
      active: pocket.active,
      stand: toStand(
        await db
          .query("pocketBalances")
          .withIndex("by_user_pocket_day", (q) => q.eq("userId", userId).eq("pocketId", pocket._id as Id<"pockets">).lte("day", today))
          .order("desc")
          .first(),
      ),
    })),
  );

  const budgetInputs: BudgetItemInput[] = budgetItems.map((item) => ({
    id: item._id,
    label: item.label,
    monthlyAmountCents: fromInt64(item.monthlyAmountCents),
    necessity: item.necessity,
    kind: item.kind,
    category: item.category,
    dueDay: fromOptionalInt64(item.dueDay),
    contractEndDay: item.contractEndDay ?? null,
    noticePeriodDays: fromOptionalInt64(item.noticePeriodDays),
    order: fromInt64(item.order),
    active: item.active,
  }));

  const debtInputs: DebtInput[] = await Promise.all(
    debts.map(async (debt) => {
      const anchorRow = await db
        .query("debtBalances")
        .withIndex("by_user_debt_day", (q) => q.eq("userId", userId).eq("debtId", debt._id as Id<"debts">).lte("day", today))
        .order("desc")
        .first();
      return {
        id: debt._id,
        lender: debt.lender,
        kind: debt.kind,
        terms: {
          principalCents: fromInt64(debt.principalCents),
          nominalRateBps: fromInt64(debt.nominalRateBps),
          monthlyPaymentCents: fromInt64(debt.monthlyPaymentCents),
          firstPaymentDay: debt.firstPaymentDay,
          paymentCount: fromInt64(debt.paymentCount),
          finalPaymentCents: fromOptionalInt64(debt.finalPaymentCents),
          specialRepaymentYearlyCents: fromOptionalInt64(debt.specialRepaymentYearlyCents),
        },
        effectiveRateBps: fromInt64(debt.effectiveRateBps),
        note: debt.note ?? null,
        order: fromInt64(debt.order),
        active: debt.active,
        anchor: anchorRow
          ? {
              day: anchorRow.day,
              balanceCents: fromInt64(anchorRow.balanceCents),
              payoffQuoteCents: fromOptionalInt64(anchorRow.payoffQuoteCents),
              recordedDay: recordedDay(anchorRow.recordedAt, zone),
            }
          : null,
      };
    }),
  );

  return {
    today,
    incomeCents: fromOptionalInt64(user.monthlyIncomeCents),
    salaryDay: fromOptionalInt64(user.salaryDay),
    accounts: accountInputs,
    pockets: pocketInputs,
    budgetItems: budgetInputs,
    debts: debtInputs,
  };
}
