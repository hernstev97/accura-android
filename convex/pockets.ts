import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { ownerMutation, type OwnerMutationCtx } from "./access";
import { editError, MAX_NAME_LENGTH, nextOrder, nullable, order, ownedRecord, requiredText, requireSeen, requireUser } from "./editing";
import { pocketFields } from "./lib/fields";

/**
 * Pockets anlegen, ändern und archivieren (`active: false`, nichts wird
 * gelöscht). Ein aktives Pocket gehört immer zu einem aktiven Konto des
 * Nutzers, sonst `account_archived`.
 */

const values = { accountId: v.id("accounts"), name: v.string(), order: v.int64() };
const seen = v.object({ ...values, active: v.boolean() });

async function requireActiveAccount(ctx: OwnerMutationCtx, accountId: Id<"accounts">) {
  const account = await ownedRecord(ctx, accountId, "accountId");
  if (!account.active) throw editError("account_archived", "accountId");
}

export const create = ownerMutation({
  args: { accountId: v.id("accounts"), name: v.string(), order: v.optional(nullable(v.int64())) },
  handler: async (ctx, args) => {
    const user = requireUser(ctx);
    const name = requiredText(args.name, "name", MAX_NAME_LENGTH);
    await requireActiveAccount(ctx, args.accountId);
    const existing = await ctx.db.query("pockets").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const id = await ctx.db.insert("pockets", {
      userId: user._id,
      accountId: args.accountId,
      name,
      order: args.order == null ? nextOrder(existing) : order(args.order),
      active: true,
    });
    return { id };
  },
});

/** Ersetzt Konto, Name und Reihenfolge. Umziehen geht nur in ein aktives Konto. */
export const update = ownerMutation({
  args: { id: v.id("pockets"), ...values, expected: seen },
  handler: async (ctx, args) => {
    const pocket = await ownedRecord(ctx, args.id, "id");
    const name = requiredText(args.name, "name", MAX_NAME_LENGTH);
    const newOrder = order(args.order);
    if (args.accountId !== pocket.accountId) await requireActiveAccount(ctx, args.accountId);
    requireSeen("pocket", pocket._id, pocketFields(pocket), args.expected);
    await ctx.db.patch(pocket._id, { accountId: args.accountId, name, order: newOrder });
    return null;
  },
});

/** Archivieren (`active: false`) oder zurückholen; zurückholen nur, solange das Konto aktiv ist. */
export const setActive = ownerMutation({
  args: { id: v.id("pockets"), active: v.boolean(), expected: seen },
  handler: async (ctx, args) => {
    const pocket = await ownedRecord(ctx, args.id, "id");
    requireSeen("pocket", pocket._id, pocketFields(pocket), args.expected);
    if (args.active) await requireActiveAccount(ctx, pocket.accountId);
    if (pocket.active !== args.active) await ctx.db.patch(pocket._id, { active: args.active });
    return null;
  },
});
