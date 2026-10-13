import { v, type Infer } from "convex/values";
import { ownerMutation } from "./access";
import {
  cents,
  dayOfMonth,
  invalid,
  MAX_CATEGORY_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  nextOrder,
  nullable,
  optionalCalendarDay,
  optionalIntInRange,
  optionalText,
  order,
  ownedRecord,
  requiredText,
  requireSeen,
  requireUser,
} from "./editing";
import { MAX_NOTICE_PERIOD_DAYS, MAX_NOTICE_PERIOD_MONTHS } from "./lib/notice";
import { budgetItemFields } from "./lib/fields";
import { budgetKind, necessity } from "./schema";

/**
 * Budgetposten anlegen, ändern und archivieren (`active: false`, nichts wird
 * gelöscht). Vertragsdaten (Art, Vertragsende, Kündigungsfrist) gelten nach
 * denselben Regeln wie beim Lesen in `lib/notice.ts`, damit kein Posten als
 * `invalid` gespeichert wird. „Bewusst so“ setzt `hints:setWaived`; eine
 * Änderung hier ändert den Fingerabdruck und holt den Hinweis zurück.
 */

const values = {
  label: v.string(),
  monthlyAmountCents: v.int64(),
  necessity,
  kind: budgetKind,
  category: v.string(),
  dueDay: nullable(v.int64()),
  contractType: nullable(v.string()),
  contractEndDay: nullable(v.string()),
  noticePeriodDays: nullable(v.int64()),
  noticePeriodMonths: nullable(v.int64()),
  note: nullable(v.string()),
  order: v.int64(),
};
const seen = v.object({ ...values, active: v.boolean() });

/** Wie `values`, nur dürfen freiwillige Felder und die Reihenfolge fehlen. */
const createArgs = {
  label: values.label,
  monthlyAmountCents: values.monthlyAmountCents,
  necessity: values.necessity,
  kind: values.kind,
  category: values.category,
  dueDay: v.optional(values.dueDay),
  contractType: v.optional(values.contractType),
  contractEndDay: v.optional(values.contractEndDay),
  noticePeriodDays: v.optional(values.noticePeriodDays),
  noticePeriodMonths: v.optional(values.noticePeriodMonths),
  note: v.optional(values.note),
  order: v.optional(nullable(v.int64())),
};

type Values = Omit<Infer<typeof seen>, "active" | "order">;
type Optional<T> = { [K in keyof T]?: T[K] | null | undefined };

/** Prüft und normalisiert; `undefined` heißt „Feld nicht gesetzt“. */
function checked(args: Pick<Values, "label" | "monthlyAmountCents" | "necessity" | "kind" | "category"> & Optional<Values>) {
  if (args.noticePeriodDays != null && args.noticePeriodMonths != null) throw invalid("noticePeriodMonths");
  return {
    label: requiredText(args.label, "label", MAX_NAME_LENGTH),
    monthlyAmountCents: cents(args.monthlyAmountCents, "monthlyAmountCents"),
    necessity: args.necessity,
    kind: args.kind,
    category: requiredText(args.category, "category", MAX_CATEGORY_LENGTH),
    dueDay: dayOfMonth(args.dueDay, "dueDay"),
    contractType: optionalText(args.contractType, "contractType", MAX_CATEGORY_LENGTH),
    contractEndDay: optionalCalendarDay(args.contractEndDay, "contractEndDay"),
    noticePeriodDays: optionalIntInRange(args.noticePeriodDays, "noticePeriodDays", 0n, BigInt(MAX_NOTICE_PERIOD_DAYS)),
    noticePeriodMonths: optionalIntInRange(args.noticePeriodMonths, "noticePeriodMonths", 0n, BigInt(MAX_NOTICE_PERIOD_MONTHS)),
    note: optionalText(args.note, "note", MAX_NOTE_LENGTH, true),
  };
}

export const create = ownerMutation({
  args: createArgs,
  handler: async (ctx, args) => {
    const user = requireUser(ctx);
    const fields = checked(args);
    const existing = await ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const id = await ctx.db.insert("budgetItems", {
      userId: user._id,
      ...fields,
      order: args.order == null ? nextOrder(existing) : order(args.order),
      active: true,
    });
    return { id };
  },
});

/** Ersetzt alle Felder außer `active`. `null` löscht ein freiwilliges Feld. */
export const update = ownerMutation({
  args: { id: v.id("budgetItems"), ...values, expected: seen },
  handler: async (ctx, args) => {
    const item = await ownedRecord(ctx, args.id, "id");
    const fields = checked(args);
    const newOrder = order(args.order);
    requireSeen("budgetItem", item._id, budgetItemFields(item), args.expected);
    // `undefined` im Patch entfernt das Feld, beim Anlegen fehlt es einfach.
    await ctx.db.patch(item._id, { ...fields, order: newOrder });
    return null;
  },
});

/** Archivieren (`active: false`) oder zurückholen. */
export const setActive = ownerMutation({
  args: { id: v.id("budgetItems"), active: v.boolean(), expected: seen },
  handler: async (ctx, args) => {
    const item = await ownedRecord(ctx, args.id, "id");
    requireSeen("budgetItem", item._id, budgetItemFields(item), args.expected);
    if (item.active !== args.active) await ctx.db.patch(item._id, { active: args.active });
    return null;
  },
});
