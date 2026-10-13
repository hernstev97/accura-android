import { ownerQuery } from "./access";
import {
  accountFields,
  budgetItemFields,
  byOrder,
  debtFields,
  debtStandFields,
  householdMemberFields,
  pocketFields,
  settingsFields,
  standFields,
} from "./lib/fields";

/**
 * Alle Datensätze zum Bearbeiten, auch archivierte (`active: false`), mit
 * allen bearbeitbaren Feldern und dem jüngsten Stand. Genau diese Werte
 * schickt die App beim Ändern als `expected` zurück: die Felder ohne `id`
 * und `stand` an `update`/`setActive`, `stand` an `stands:record`.
 *
 * `stand` ist der jüngste gespeicherte Stand, unabhängig vom heutigen Tag.
 * Die Abfrage braucht deshalb kein Datum.
 */
export const list = ownerQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.owner.user;
    if (user === null) {
      return { settings: null, accounts: [], pockets: [], budgetItems: [], debts: [], householdMembers: [] };
    }
    const userId = user._id;
    const [accounts, pockets, budgetItems, debts, householdMembers] = await Promise.all([
      ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("pockets").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("householdMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    return {
      settings: settingsFields(user),
      accounts: await Promise.all(
        byOrder(accounts).map(async (account) => {
          const latest = await ctx.db
            .query("accountBalances")
            .withIndex("by_user_account_day", (q) => q.eq("userId", userId).eq("accountId", account._id))
            .order("desc")
            .first();
          return { id: account._id, ...accountFields(account), stand: latest === null ? null : standFields(latest) };
        }),
      ),
      pockets: await Promise.all(
        byOrder(pockets).map(async (pocket) => {
          const latest = await ctx.db
            .query("pocketBalances")
            .withIndex("by_user_pocket_day", (q) => q.eq("userId", userId).eq("pocketId", pocket._id))
            .order("desc")
            .first();
          return { id: pocket._id, ...pocketFields(pocket), stand: latest === null ? null : standFields(latest) };
        }),
      ),
      budgetItems: byOrder(budgetItems).map((item) => ({ id: item._id, ...budgetItemFields(item) })),
      debts: await Promise.all(
        byOrder(debts).map(async (debt) => {
          const latest = await ctx.db
            .query("debtBalances")
            .withIndex("by_user_debt_day", (q) => q.eq("userId", userId).eq("debtId", debt._id))
            .order("desc")
            .first();
          return { id: debt._id, ...debtFields(debt), stand: latest === null ? null : debtStandFields(latest) };
        }),
      ),
      householdMembers: householdMembers.map((member) => ({ id: member._id, ...householdMemberFields(member) })),
    };
  },
});

