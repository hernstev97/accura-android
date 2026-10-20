import { v } from "convex/values";
import { ownerMutation } from "./access";
import {
  calendarDay,
  cents,
  intInRange,
  invalid,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  nextOrder,
  nullable,
  optionalCents,
  optionalText,
  order,
  ownedRecord,
  requiredText,
  requireSeen,
  requireUser,
} from "./editing";
import { MAX_PAYMENT_COUNT, validateTerms } from "./lib/amortization";
import { debtFields } from "./lib/fields";
import { fromInt64, fromOptionalInt64 } from "./lib/wire";
import { debtKind } from "./schema";

/**
 * Kredite und Ratenkäufe mit den Vertragsdaten anlegen, ändern und
 * archivieren (`active: false`, nichts wird gelöscht). Es gelten dieselben
 * Regeln wie beim Lesen (`validateTerms`), damit kein Kredit als `invalid`
 * gespeichert wird. Den Bankstand trägt `stands:record` ein.
 */

const values = {
  lender: v.string(),
  kind: debtKind,
  principalCents: v.int64(),
  nominalRateBps: v.int64(),
  effectiveRateBps: v.int64(),
  monthlyPaymentCents: v.int64(),
  firstPaymentDay: v.string(),
  paymentCount: v.int64(),
  finalPaymentCents: nullable(v.int64()),
  specialRepaymentYearlyCents: nullable(v.int64()),
  note: nullable(v.string()),
  order: v.int64(),
};
const seen = v.object({ ...values, active: v.boolean() });

const createArgs = {
  ...values,
  finalPaymentCents: v.optional(values.finalPaymentCents),
  specialRepaymentYearlyCents: v.optional(values.specialRepaymentYearlyCents),
  note: v.optional(values.note),
  order: v.optional(nullable(v.int64())),
};

const MAX_RATE_BPS = 10_000n;

type Input = {
  lender: string;
  kind: "loan" | "installment";
  principalCents: bigint;
  nominalRateBps: bigint;
  effectiveRateBps: bigint;
  monthlyPaymentCents: bigint;
  firstPaymentDay: string;
  paymentCount: bigint;
  finalPaymentCents?: bigint | null;
  specialRepaymentYearlyCents?: bigint | null;
  note?: string | null;
};

function checked(args: Input) {
  const fields = {
    lender: requiredText(args.lender, "lender", MAX_NAME_LENGTH),
    kind: args.kind,
    principalCents: cents(args.principalCents, "principalCents"),
    nominalRateBps: intInRange(args.nominalRateBps, "nominalRateBps", 0n, MAX_RATE_BPS),
    effectiveRateBps: intInRange(args.effectiveRateBps, "effectiveRateBps", 0n, MAX_RATE_BPS),
    monthlyPaymentCents: cents(args.monthlyPaymentCents, "monthlyPaymentCents"),
    firstPaymentDay: calendarDay(args.firstPaymentDay, "firstPaymentDay"),
    paymentCount: intInRange(args.paymentCount, "paymentCount", 1n, BigInt(MAX_PAYMENT_COUNT)),
    finalPaymentCents: optionalCents(args.finalPaymentCents, "finalPaymentCents"),
    specialRepaymentYearlyCents: optionalCents(args.specialRepaymentYearlyCents, "specialRepaymentYearlyCents"),
    note: optionalText(args.note, "note", MAX_NOTE_LENGTH, true),
  };
  // Gegenprobe mit der Regel, nach der die Abfragen rechnen. Nach den Prüfungen oben greift sie nie.
  const issues = validateTerms({
    principalCents: fromInt64(fields.principalCents),
    nominalRateBps: fromInt64(fields.nominalRateBps),
    monthlyPaymentCents: fromInt64(fields.monthlyPaymentCents),
    firstPaymentDay: fields.firstPaymentDay,
    paymentCount: fromInt64(fields.paymentCount),
    finalPaymentCents: fromOptionalInt64(fields.finalPaymentCents),
    specialRepaymentYearlyCents: fromOptionalInt64(fields.specialRepaymentYearlyCents),
  });
  if (issues.length > 0) throw invalid("terms");
  return fields;
}

export const create = ownerMutation({
  args: createArgs,
  handler: async (ctx, args) => {
    const user = requireUser(ctx);
    const fields = checked(args);
    const existing = await ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const id = await ctx.db.insert("debts", {
      userId: user._id,
      ...fields,
      order: args.order == null ? nextOrder(existing) : order(args.order),
      active: true,
    });
    return { id };
  },
});

/** Ersetzt alle Vertragsdaten, Notiz und Reihenfolge. `null` löscht ein freiwilliges Feld. */
export const update = ownerMutation({
  args: { id: v.id("debts"), ...values, expected: seen },
  handler: async (ctx, args) => {
    const debt = await ownedRecord(ctx, args.id, "id");
    const fields = checked(args);
    const newOrder = order(args.order);
    requireSeen("debt", debt._id, debtFields(debt), args.expected);
    await ctx.db.patch(debt._id, { ...fields, order: newOrder });
    return null;
  },
});

/** Archivieren (`active: false`, etwa nach der letzten Rate) oder zurückholen. */
export const setActive = ownerMutation({
  args: { id: v.id("debts"), active: v.boolean(), expected: seen },
  handler: async (ctx, args) => {
    const debt = await ownedRecord(ctx, args.id, "id");
    requireSeen("debt", debt._id, debtFields(debt), args.expected);
    if (debt.active !== args.active) await ctx.db.patch(debt._id, { active: args.active });
    return null;
  },
});
