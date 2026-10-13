import { v } from "convex/values";
import { ownerMutation } from "./access";
import {
  calendarDay,
  cents,
  conflictError,
  editError,
  invalid,
  MAX_STANDS_PER_LIST,
  nullable,
  optionalCents,
  ownedRecord,
  signedCents,
  type Conflict,
} from "./editing";
import { isPlausibleToday } from "./lib/calendar";
import { debtStandFields, sameFields, standFields } from "./lib/fields";

/**
 * Stände eintragen: Konto, Pocket und bestätigter Bankstand eines Kredits.
 *
 * Regeln (aus dem ACC-72-Editor, ADR 0015 im alten Repo):
 * - Ein Stand je Kalendertag. Ein Stand am selben Tag wird ersetzt, ältere
 *   bleiben als Verlauf.
 * - Der Tag kommt vom Aufrufer (heute in Stevens Zeitzone). Die Uhr des
 *   Servers prüft nur, dass er höchstens einen Tag vom UTC-Datum abweicht;
 *   `recordedAt` ist der Zeitpunkt der Eintragung.
 * - Jeder Eintrag schickt den zuletzt gesehenen Stand (`expected`, `null` =
 *   noch keiner). Weicht der jüngste gespeicherte Stand ab, wird nichts
 *   gespeichert (`conflict` mit allen abweichenden Ständen).
 * - Liegt der jüngste Stand schon nach dem Tag, wird nichts gespeichert
 *   (`date_conflict`), weil der neue Stand nie gelten würde.
 * - Alle Einträge eines Aufrufs gelten ganz oder gar nicht („Stände aktualisieren“).
 *
 * „Unverändert“ (`unchanged: true`) übernimmt den Betrag des jüngsten Stands
 * als Stand des Tages. Das gibt es nur für Konten und Pockets: Ein alter
 * Bankstand eines Kredits mit neuem Datum würde die seither gezahlten Raten
 * übergehen, denn der Tilgungsplan rechnet ab dem Tag des Bankstands.
 */

const seenStand = v.object({ day: v.string(), balanceCents: v.int64() });
const seenDebtStand = v.object({ day: v.string(), balanceCents: v.int64(), payoffQuoteCents: nullable(v.int64()) });

const accountEntry = v.union(
  v.object({ id: v.id("accounts"), balanceCents: v.int64(), expected: nullable(seenStand) }),
  v.object({ id: v.id("accounts"), unchanged: v.literal(true), expected: seenStand }),
);
const pocketEntry = v.union(
  v.object({ id: v.id("pockets"), balanceCents: v.int64(), expected: nullable(seenStand) }),
  v.object({ id: v.id("pockets"), unchanged: v.literal(true), expected: seenStand }),
);
const debtEntry = v.object({
  id: v.id("debts"),
  balanceCents: v.int64(),
  payoffQuoteCents: v.optional(nullable(v.int64())),
  expected: nullable(seenDebtStand),
});

export const record = ownerMutation({
  args: {
    day: v.string(),
    accounts: v.optional(v.array(accountEntry)),
    pockets: v.optional(v.array(pocketEntry)),
    debts: v.optional(v.array(debtEntry)),
  },
  handler: async (ctx, args) => {
    const day = calendarDay(args.day, "day");
    if (!isPlausibleToday(day, Date.now())) throw invalid("day");
    const lists = { accounts: args.accounts ?? [], pockets: args.pockets ?? [], debts: args.debts ?? [] };
    for (const [name, list] of Object.entries(lists)) {
      if (list.length > MAX_STANDS_PER_LIST) throw invalid(name);
      const ids = list.map((entry) => entry.id as string);
      ids.forEach((id, index) => {
        if (ids.indexOf(id) !== index) throw invalid(`${name}.${index}.id`);
      });
    }

    // Erst alles prüfen, dann schreiben. Ein Fehler beim Schreiben bricht die
    // ganze Mutation ab; Convex verwirft dann auch die vorherigen Schreibvorgänge.
    const conflicts: Conflict[] = [];
    const writes: (() => Promise<unknown>)[] = [];
    const recordedAt = BigInt(Date.now());

    for (const [index, entry] of lists.accounts.entries()) {
      const path = `accounts.${index}`;
      const account = await ownedRecord(ctx, entry.id, `${path}.id`);
      const balanceCents = "unchanged" in entry ? null : signedCents(entry.balanceCents, `${path}.balanceCents`);
      const latest = await ctx.db
        .query("accountBalances")
        .withIndex("by_user_account_day", (q) => q.eq("userId", account.userId).eq("accountId", account._id))
        .order("desc")
        .first();
      const current = latest === null ? null : standFields(latest);
      if (!sameFields(current, entry.expected)) {
        conflicts.push({ entity: "accountStand", id: account._id, current });
        continue;
      }
      if (latest !== null && latest.day > day) throw editError("date_conflict", path);
      const value = balanceCents ?? latest?.balanceCents;
      if (value === undefined) throw invalid(`${path}.unchanged`);
      writes.push(() =>
        latest !== null && latest.day === day
          ? ctx.db.patch(latest._id, { balanceCents: value, recordedAt })
          : ctx.db.insert("accountBalances", { userId: account.userId, accountId: account._id, day, balanceCents: value, recordedAt }),
      );
    }

    for (const [index, entry] of lists.pockets.entries()) {
      const path = `pockets.${index}`;
      const pocket = await ownedRecord(ctx, entry.id, `${path}.id`);
      const balanceCents = "unchanged" in entry ? null : signedCents(entry.balanceCents, `${path}.balanceCents`);
      const latest = await ctx.db
        .query("pocketBalances")
        .withIndex("by_user_pocket_day", (q) => q.eq("userId", pocket.userId).eq("pocketId", pocket._id))
        .order("desc")
        .first();
      const current = latest === null ? null : standFields(latest);
      if (!sameFields(current, entry.expected)) {
        conflicts.push({ entity: "pocketStand", id: pocket._id, current });
        continue;
      }
      if (latest !== null && latest.day > day) throw editError("date_conflict", path);
      const value = balanceCents ?? latest?.balanceCents;
      if (value === undefined) throw invalid(`${path}.unchanged`);
      writes.push(() =>
        latest !== null && latest.day === day
          ? ctx.db.patch(latest._id, { balanceCents: value, recordedAt })
          : ctx.db.insert("pocketBalances", { userId: pocket.userId, pocketId: pocket._id, day, balanceCents: value, recordedAt }),
      );
    }

    for (const [index, entry] of lists.debts.entries()) {
      const path = `debts.${index}`;
      const debt = await ownedRecord(ctx, entry.id, `${path}.id`);
      const balanceCents = cents(entry.balanceCents, `${path}.balanceCents`);
      const payoffQuoteCents = optionalCents(entry.payoffQuoteCents, `${path}.payoffQuoteCents`);
      const latest = await ctx.db
        .query("debtBalances")
        .withIndex("by_user_debt_day", (q) => q.eq("userId", debt.userId).eq("debtId", debt._id))
        .order("desc")
        .first();
      const current = latest === null ? null : debtStandFields(latest);
      if (!sameFields(current, entry.expected)) {
        conflicts.push({ entity: "debtStand", id: debt._id, current });
        continue;
      }
      if (latest !== null && latest.day > day) throw editError("date_conflict", path);
      writes.push(() =>
        latest !== null && latest.day === day
          ? ctx.db.patch(latest._id, { balanceCents, payoffQuoteCents, recordedAt })
          : ctx.db.insert("debtBalances", { userId: debt.userId, debtId: debt._id, day, balanceCents, payoffQuoteCents, recordedAt }),
      );
    }

    if (conflicts.length > 0) throw conflictError(conflicts);
    for (const write of writes) await write();
    return { day, count: BigInt(writes.length) };
  },
});
