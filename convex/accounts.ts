import { v } from "convex/values";
import { ownerMutation } from "./access";
import { editError, MAX_NAME_LENGTH, nextOrder, nullable, order, ownedRecord, requiredText, requireSeen, requireUser } from "./editing";
import { accountFields } from "./lib/fields";
import { accountKind } from "./schema";

/**
 * Konten anlegen, ändern und archivieren. Archivieren setzt `active: false`,
 * nichts wird gelöscht; Stände bleiben erhalten. Stände trägt `stands:record` ein.
 */

const values = { name: v.string(), kind: accountKind, order: v.int64() };
const seen = v.object({ ...values, active: v.boolean() });

export const create = ownerMutation({
  args: { name: v.string(), kind: accountKind, order: v.optional(nullable(v.int64())) },
  handler: async (ctx, args) => {
    const user = requireUser(ctx);
    const name = requiredText(args.name, "name", MAX_NAME_LENGTH);
    const existing = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const id = await ctx.db.insert("accounts", {
      userId: user._id,
      name,
      kind: args.kind,
      order: args.order == null ? nextOrder(existing) : order(args.order),
      active: true,
    });
    return { id };
  },
});

/** Ersetzt Name, Art und Reihenfolge. `expected`: das Konto, wie die App es gezeigt hat. */
export const update = ownerMutation({
  args: { id: v.id("accounts"), ...values, expected: seen },
  handler: async (ctx, args) => {
    const account = await ownedRecord(ctx, args.id, "id");
    const name = requiredText(args.name, "name", MAX_NAME_LENGTH);
    const newOrder = order(args.order);
    requireSeen("account", account._id, accountFields(account), args.expected);
    await ctx.db.patch(account._id, { name, kind: args.kind, order: newOrder });
    return null;
  },
});

/** Archivieren (`active: false`) oder zurückholen. Ein Konto mit aktiven Pockets bleibt aktiv (`has_active_pockets`). */
export const setActive = ownerMutation({
  args: { id: v.id("accounts"), active: v.boolean(), expected: seen },
  handler: async (ctx, args) => {
    const account = await ownedRecord(ctx, args.id, "id");
    requireSeen("account", account._id, accountFields(account), args.expected);
    if (!args.active) {
      const pockets = await ctx.db.query("pockets").withIndex("by_user", (q) => q.eq("userId", account.userId)).collect();
      if (pockets.some((pocket) => pocket.accountId === account._id && pocket.active)) throw editError("has_active_pockets");
    }
    if (account.active !== args.active) await ctx.db.patch(account._id, { active: args.active });
    return null;
  },
});
