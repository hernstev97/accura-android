import { v } from "convex/values";
import { ownerMutation } from "./access";
import { intInRange, MAX_DAILY_KCAL, MAX_NAME_LENGTH, ownedRecord, requiredText, requireSeen, requireUser } from "./editing";
import { householdMemberFields } from "./lib/fields";

/**
 * Haushaltsmitglieder: nur Bezeichnung und Kalorienziel pro Tag. Körperdaten
 * (Gewicht, Größe, Alter) speichert accura nicht; der Kalorienrechner läuft
 * auf dem Handy. Archivieren setzt `active: false`, nichts wird gelöscht.
 */

const values = { label: v.string(), dailyKcal: v.int64() };
const seen = v.object({ ...values, active: v.boolean() });

function checked(args: { label: string; dailyKcal: bigint }) {
  return {
    label: requiredText(args.label, "label", MAX_NAME_LENGTH),
    dailyKcal: intInRange(args.dailyKcal, "dailyKcal", 1n, MAX_DAILY_KCAL),
  };
}

export const create = ownerMutation({
  args: values,
  handler: async (ctx, args) => {
    const user = requireUser(ctx);
    const id = await ctx.db.insert("householdMembers", { userId: user._id, ...checked(args), active: true });
    return { id };
  },
});

export const update = ownerMutation({
  args: { id: v.id("householdMembers"), ...values, expected: seen },
  handler: async (ctx, args) => {
    const member = await ownedRecord(ctx, args.id, "id");
    const fields = checked(args);
    requireSeen("householdMember", member._id, householdMemberFields(member), args.expected);
    await ctx.db.patch(member._id, fields);
    return null;
  },
});

export const setActive = ownerMutation({
  args: { id: v.id("householdMembers"), active: v.boolean(), expected: seen },
  handler: async (ctx, args) => {
    const member = await ownedRecord(ctx, args.id, "id");
    requireSeen("householdMember", member._id, householdMemberFields(member), args.expected);
    if (member.active !== args.active) await ctx.db.patch(member._id, { active: args.active });
    return null;
  },
});
