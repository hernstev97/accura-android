import { ownerQuery } from "./access";
import {
  accountFields,
  budgetItemFields,
  byOrder,
  debtFields,
  householdMemberFields,
  pocketFields,
  settingsFields,
} from "./lib/fields";

/**
 * Version des Exportformats. Steigt, sobald sich Felder oder ihre Bedeutung
 * ändern, damit ein späteres Einlesen alte Dateien erkennt.
 */
export const EXPORT_FORMAT_VERSION = 1n;

/**
 * Alle eigenen Daten als ein Modell für den Export in der App (Plan:
 * „Datenexport in der App“). Jeder Wert ist JSON-tauglich: Text,
 * Wahrheitswert, `null` oder int64. Datenbank-Zeitstempel mit Kommastellen
 * (`_creationTime`), Besitzerkennung und Clerk-Kennung fehlen absichtlich.
 * Archivierte Datensätze und alle Stände samt Verlauf sind enthalten.
 *
 * Ein Einlesen über die App gibt es nicht. Für die Restore-Übung dient
 * `npx convex export` und `npx convex import` auf Stevens Rechner.
 */
export const all = ownerQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.owner.user;
    const empty = {
      formatVersion: EXPORT_FORMAT_VERSION,
      settings: null,
      accounts: [],
      accountBalances: [],
      pockets: [],
      pocketBalances: [],
      budgetItems: [],
      debts: [],
      debtBalances: [],
      householdMembers: [],
    };
    if (user === null) return empty;
    const userId = user._id;

    const [accounts, accountBalances, pockets, pocketBalances, budgetItems, debts, debtBalances, householdMembers] = await Promise.all([
      ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("accountBalances").withIndex("by_user_account_day", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("pockets").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("pocketBalances").withIndex("by_user_pocket_day", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("debtBalances").withIndex("by_user_debt_day", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("householdMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    return {
      ...empty,
      settings: { ...settingsFields(user), createdAt: user.createdAt },
      accounts: byOrder(accounts).map((row) => ({ id: row._id, ...accountFields(row) })),
      accountBalances: accountBalances.map((row) => ({
        accountId: row.accountId,
        day: row.day,
        balanceCents: row.balanceCents,
        recordedAt: row.recordedAt,
      })),
      pockets: byOrder(pockets).map((row) => ({ id: row._id, ...pocketFields(row) })),
      pocketBalances: pocketBalances.map((row) => ({
        pocketId: row.pocketId,
        day: row.day,
        balanceCents: row.balanceCents,
        recordedAt: row.recordedAt,
      })),
      budgetItems: byOrder(budgetItems).map((row) => ({
        id: row._id,
        ...budgetItemFields(row),
        waivedHintAt: row.waivedHintAt ?? null,
        waivedHintFingerprint: row.waivedHintFingerprint ?? null,
      })),
      debts: byOrder(debts).map((row) => ({ id: row._id, ...debtFields(row) })),
      debtBalances: debtBalances.map((row) => ({
        debtId: row.debtId,
        day: row.day,
        balanceCents: row.balanceCents,
        payoffQuoteCents: row.payoffQuoteCents ?? null,
        recordedAt: row.recordedAt,
      })),
      householdMembers: householdMembers.map((row) => ({ id: row._id, ...householdMemberFields(row) })),
    };
  },
});
