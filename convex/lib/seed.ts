import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { FinanceInput } from "./input";
import { toInt64 } from "./wire";

type Db = MutationCtx["db"];


/**
 * Schreibt eine `FinanceInput` als Datensätze eines Nutzers. Nur für Tests
 * und das Befüllen eines Entwicklungs-Deployments mit anonymen Testdaten.
 * Je Konto, Pocket und Kredit entsteht höchstens ein Stand.
 */
export async function seedFinanceInput(db: Db, userId: Id<"users">, input: FinanceInput, recordedAt: number): Promise<void> {
  const at = toInt64(recordedAt);

  const accountIds = new Map<string, Id<"accounts">>();
  for (const account of input.accounts) {
    const id = await db.insert("accounts", {
      userId,
      name: account.name,
      kind: account.kind,
      order: toInt64(account.order),
      active: account.active,
    });
    accountIds.set(account.id, id);
    if (account.stand) {
      await db.insert("accountBalances", {
        userId,
        accountId: id,
        day: account.stand.day,
        balanceCents: toInt64(account.stand.cents),
        recordedAt: at,
      });
    }
  }

  for (const pocket of input.pockets) {
    const accountId = accountIds.get(pocket.accountId);
    if (!accountId) throw new Error(`Pocket ${pocket.id} verweist auf ein unbekanntes Konto.`);
    const id = await db.insert("pockets", {
      userId,
      accountId,
      name: pocket.name,
      order: toInt64(pocket.order),
      active: pocket.active,
    });
    if (pocket.stand) {
      await db.insert("pocketBalances", {
        userId,
        pocketId: id,
        day: pocket.stand.day,
        balanceCents: toInt64(pocket.stand.cents),
        recordedAt: at,
      });
    }
  }

  for (const item of input.budgetItems) {
    await db.insert("budgetItems", {
      userId,
      label: item.label,
      monthlyAmountCents: toInt64(item.monthlyAmountCents),
      necessity: item.necessity,
      kind: item.kind,
      category: item.category,
      ...(item.dueDay === null ? {} : { dueDay: toInt64(item.dueDay) }),
      ...(item.contractType === null ? {} : { contractType: item.contractType }),
      ...(item.contractEndDay === null ? {} : { contractEndDay: item.contractEndDay }),
      ...(item.noticePeriodDays === null ? {} : { noticePeriodDays: toInt64(item.noticePeriodDays) }),
      ...(item.noticePeriodMonths === null ? {} : { noticePeriodMonths: toInt64(item.noticePeriodMonths) }),
      ...(item.waivedHintFingerprint === null ? {} : { waivedHintAt: at, waivedHintFingerprint: item.waivedHintFingerprint }),
      order: toInt64(item.order),
      active: item.active,
    });
  }

  for (const debt of input.debts) {
    const id = await db.insert("debts", {
      userId,
      lender: debt.lender,
      kind: debt.kind,
      principalCents: toInt64(debt.terms.principalCents),
      nominalRateBps: toInt64(debt.terms.nominalRateBps),
      effectiveRateBps: toInt64(debt.effectiveRateBps),
      monthlyPaymentCents: toInt64(debt.terms.monthlyPaymentCents),
      firstPaymentDay: debt.terms.firstPaymentDay,
      paymentCount: toInt64(debt.terms.paymentCount),
      ...(debt.terms.finalPaymentCents === null ? {} : { finalPaymentCents: toInt64(debt.terms.finalPaymentCents) }),
      ...(debt.terms.specialRepaymentYearlyCents === null
        ? {}
        : { specialRepaymentYearlyCents: toInt64(debt.terms.specialRepaymentYearlyCents) }),
      ...(debt.note === null ? {} : { note: debt.note }),
      order: toInt64(debt.order),
      active: debt.active,
    });
    if (debt.anchor) {
      await db.insert("debtBalances", {
        userId,
        debtId: id,
        day: debt.anchor.day,
        balanceCents: toInt64(debt.anchor.balanceCents),
        ...(debt.anchor.payoffQuoteCents === null ? {} : { payoffQuoteCents: toInt64(debt.anchor.payoffQuoteCents) }),
        recordedAt: at,
      });
    }
  }
}
