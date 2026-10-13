import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Datenmodell nach Plan, Anhang B, mit den Abweichungen aus
 * docs/backend/schema.md.
 *
 * Regeln:
 * - Jede Ganzzahl ist int64 (`bigint` in TypeScript, `Long` in Kotlin). Kommazahlen
 *   gibt es weder in der Datenbank noch in Antworten.
 * - Geld ist immer ganze Cent.
 * - Kalendertage sind Text "YYYY-MM-DD" ohne Zeitzone; Zeitpunkte (`recordedAt`)
 *   sind Millisekunden seit 1970 als int64.
 * - Jede Tabelle außer `users` trägt `userId` und einen Index, der damit beginnt.
 */
const cents = v.int64();
const int = v.int64();
const calendarDay = v.string();
const timestampMs = v.int64();

export const accountKind = v.union(v.literal("bank"), v.literal("wallet"), v.literal("cash"));
export const budgetKind = v.union(v.literal("expense"), v.literal("reserve"));
export const debtKind = v.union(v.literal("loan"), v.literal("installment"));

export const necessity = v.union(
  v.literal("essential"),
  v.literal("necessary"),
  v.literal("worthwhile"),
  v.literal("optional"),
  v.literal("unnecessary"),
);

export default defineSchema({
  users: defineTable({
    clerkTokenIdentifier: v.string(),
    homeTimeZone: v.string(),
    // Bis zur Ersterfassung unbekannt. Es gibt keinen erfundenen Standardwert.
    monthlyIncomeCents: v.optional(cents),
    salaryDay: v.optional(int),
    createdAt: timestampMs,
  }).index("by_token_identifier", ["clerkTokenIdentifier"]),

  accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    kind: accountKind,
    order: int,
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  accountBalances: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    day: calendarDay,
    balanceCents: cents,
    recordedAt: timestampMs,
  }).index("by_user_account_day", ["userId", "accountId", "day"]),

  pockets: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    name: v.string(),
    order: int,
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  pocketBalances: defineTable({
    userId: v.id("users"),
    pocketId: v.id("pockets"),
    day: calendarDay,
    balanceCents: cents,
    recordedAt: timestampMs,
  }).index("by_user_pocket_day", ["userId", "pocketId", "day"]),

  budgetItems: defineTable({
    userId: v.id("users"),
    label: v.string(),
    monthlyAmountCents: cents,
    necessity,
    kind: budgetKind,
    category: v.string(),
    dueDay: v.optional(int),
    // Art eines Abos oder Vertrags, freier Text (z. B. „Streaming“). Gleiche Art fällt im Einspar-Hinweis auf.
    contractType: v.optional(v.string()),
    contractEndDay: v.optional(calendarDay),
    // Kündigungsfrist in Tagen oder in Monaten, höchstens eins von beiden.
    noticePeriodDays: v.optional(int),
    noticePeriodMonths: v.optional(int),
    // „Bewusst so“: wann und für welchen Stand des Postens (`hintFingerprint` in lib/hints.ts).
    waivedHintAt: v.optional(timestampMs),
    waivedHintFingerprint: v.optional(v.string()),
    note: v.optional(v.string()),
    order: int,
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  debts: defineTable({
    userId: v.id("users"),
    lender: v.string(),
    kind: debtKind,
    principalCents: cents,
    nominalRateBps: int,
    effectiveRateBps: int,
    monthlyPaymentCents: cents,
    firstPaymentDay: calendarDay,
    paymentCount: int,
    finalPaymentCents: v.optional(cents),
    specialRepaymentYearlyCents: v.optional(cents),
    note: v.optional(v.string()),
    order: int,
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  // Vom Bank-Stand bestätigte Restschuld. Ab diesem Tag rechnet der Plan weiter.
  debtBalances: defineTable({
    userId: v.id("users"),
    debtId: v.id("debts"),
    day: calendarDay,
    balanceCents: cents,
    payoffQuoteCents: v.optional(cents),
    recordedAt: timestampMs,
  }).index("by_user_debt_day", ["userId", "debtId", "day"]),

  // Nur das Kalorienziel, keine Körperdaten. `active: false` heißt archiviert.
  householdMembers: defineTable({
    userId: v.id("users"),
    label: v.string(),
    dailyKcal: int,
    active: v.boolean(),
  }).index("by_user", ["userId"]),
});
