import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ALLOWED_SUBJECT_ENV } from "../convex/access";
import { EXPORT_FORMAT_VERSION } from "../convex/dataExport";
import { TODAY, anonymousInput } from "../convex/lib/fixtures";
import { seedFinanceInput } from "../convex/lib/seed";
import schema from "../convex/schema";
import { asOwner, newTest, OWNER, OWNER_TOKEN } from "./support";

const RECORDED_AT = Date.UTC(2026, 7, 8, 10, 0);

beforeEach(() => {
  vi.stubEnv(ALLOWED_SUBJECT_ENV, OWNER.subject);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Tabelle in der Datenbank → Liste im Export. `users` wird zu `settings`. */
const EXPORT_KEYS = {
  accounts: "accounts",
  accountBalances: "accountBalances",
  pockets: "pockets",
  pocketBalances: "pocketBalances",
  budgetItems: "budgetItems",
  debts: "debts",
  debtBalances: "debtBalances",
  householdMembers: "householdMembers",
} as const;

/** Besitzer mit Testdaten, in denen jedes optionale Feld mindestens einmal gesetzt ist. */
async function fullOwner() {
  const t = newTest();
  const input = anonymousInput();
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      clerkTokenIdentifier: OWNER_TOKEN,
      homeTimeZone: "Europe/Berlin",
      monthlyIncomeCents: 300_000n,
      salaryDay: 25n,
      createdAt: 1n,
    });
    await seedFinanceInput(ctx.db, id, input, RECORDED_AT);
    const debt = (await ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", id)).first())!;
    await ctx.db.patch(debt._id, { finalPaymentCents: 1n, specialRepaymentYearlyCents: 2n, note: "Notiz" });
    await ctx.db.insert("debtBalances", { userId: id, debtId: debt._id, day: "2026-07-20", balanceCents: 3n, payoffQuoteCents: 4n, recordedAt: 5n });
    const item = (await ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", id)).first())!;
    await ctx.db.patch(item._id, {
      contractType: "Art", noticePeriodDays: 30n, note: "Notiz", waivedHintAt: 6n, waivedHintFingerprint: "f",
    });
    await ctx.db.insert("householdMembers", { userId: id, label: "Person A", dailyKcal: 2_000n, active: true });
    await ctx.db.insert("householdMembers", { userId: id, label: "Person B", dailyKcal: 1_800n, active: false });
    return id;
  });
  return { t, as: asOwner(t), userId };
}

/** Ein zweiter Nutzer mit einem Eintrag in jeder Tabelle. */
async function foreignData(t: ReturnType<typeof newTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { clerkTokenIdentifier: "https://x|andere", homeTimeZone: "UTC", createdAt: 0n, monthlyIncomeCents: 777_777n });
    const accountId = await ctx.db.insert("accounts", { userId, name: "Fremdes Konto", kind: "bank", order: 1n, active: true });
    await ctx.db.insert("accountBalances", { userId, accountId, day: TODAY, balanceCents: 555_555n, recordedAt: 0n });
    const pocketId = await ctx.db.insert("pockets", { userId, accountId, name: "Fremdes Pocket", order: 1n, active: true });
    await ctx.db.insert("pocketBalances", { userId, pocketId, day: TODAY, balanceCents: 444_444n, recordedAt: 0n });
    const itemId = await ctx.db.insert("budgetItems", {
      userId, label: "Fremder Posten", monthlyAmountCents: 1n, necessity: "optional", kind: "expense", category: "Fremd", order: 1n, active: true,
    });
    const debtId = await ctx.db.insert("debts", {
      userId, lender: "Fremde Bank", kind: "loan", principalCents: 1n, nominalRateBps: 0n, effectiveRateBps: 0n,
      monthlyPaymentCents: 1n, firstPaymentDay: "2026-01-01", paymentCount: 1n, order: 1n, active: true,
    });
    await ctx.db.insert("debtBalances", { userId, debtId, day: TODAY, balanceCents: 333_333n, recordedAt: 0n });
    const memberId = await ctx.db.insert("householdMembers", { userId, label: "Fremde Person", dailyKcal: 1n, active: true });
    return [userId, accountId, pocketId, itemId, debtId, memberId] as string[];
  });
}

const json = (value: unknown) => JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? `${entry}n` : entry));

describe("dataExport:all", () => {
  it("liefert alle eigenen Daten mit Versionsfeld, auch archivierte Datensätze und den Verlauf der Stände", async () => {
    const { as } = await fullOwner();
    const exported = await as.query(api.dataExport.all, {});
    expect(exported.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(EXPORT_FORMAT_VERSION).toBe(1n);
    expect(exported.settings).toEqual({ monthlyIncomeCents: 300_000n, salaryDay: 25n, homeTimeZone: "Europe/Berlin", createdAt: 1n });
    expect(exported.accounts.map((entry) => [entry.name, entry.active])).toEqual([
      ["Alltagskonto", true], ["Reise-Wallet", true], ["Bargeld", true], ["Altes Konto", false],
    ]);
    expect(exported.accountBalances).toHaveLength(4);
    expect(exported.pockets).toHaveLength(5);
    expect(exported.budgetItems).toHaveLength(10);
    expect(exported.debts).toHaveLength(3);
    expect(exported.debtBalances).toEqual([
      expect.objectContaining({ day: "2026-07-20", balanceCents: 3n, payoffQuoteCents: 4n, recordedAt: 5n }),
    ]);
    expect(exported.householdMembers.map((entry) => [entry.label, entry.active])).toEqual([["Person A", true], ["Person B", false]]);
  });

  it("enthält nur eigene Daten", async () => {
    const { t, as } = await fullOwner();
    const foreignIds = await foreignData(t);
    const text = json(await as.query(api.dataExport.all, {}));
    for (const id of foreignIds) expect(text).not.toContain(id);
    for (const value of ["Fremd", "777777", "555555", "444444", "333333"]) expect(text).not.toContain(value);
  });

  it("deckt jede Tabelle und jedes gespeicherte Feld ab", async () => {
    const { t, as, userId } = await fullOwner();
    const exported = (await as.query(api.dataExport.all, {})) as unknown as Record<string, Record<string, unknown>[]>;
    const tables = Object.keys(schema.tables).filter((table) => table !== "users");
    expect(tables.sort()).toEqual(Object.keys(EXPORT_KEYS).sort());

    for (const table of tables) {
      const rows = await t.run((ctx) => ctx.db.query(table as keyof typeof EXPORT_KEYS).collect());
      const exportedRows = exported[EXPORT_KEYS[table as keyof typeof EXPORT_KEYS]]!;
      expect(exportedRows, table).toHaveLength(rows.length);
      for (const row of rows) {
        expect(row.userId).toBe(userId);
        const stored = Object.keys(row).filter((key) => !["_id", "_creationTime", "userId"].includes(key));
        // Datensätze tragen ihre Kennung als `id`, Stände sind über Tag und Bezug eindeutig.
        const match = exportedRows.find((entry) => (entry.id === undefined ? stored.every((key) => json(entry[key]) === json(row[key as keyof typeof row])) : entry.id === row._id));
        expect(match, `${table} ${row._id}`).toBeDefined();
        for (const key of stored) expect(json(match![key]), `${table}.${key}`).toBe(json(row[key as keyof typeof row]));
      }
    }
    const user = await t.run((ctx) => ctx.db.get(userId as Id<"users">));
    for (const key of Object.keys(user!).filter((key) => !["_id", "_creationTime", "clerkTokenIdentifier"].includes(key))) {
      expect(exported.settings as unknown as Record<string, unknown>, `users.${key}`).toHaveProperty(key);
    }
  });

  it("ist JSON-tauglich: nur Text, Wahrheitswerte, null und int64, keine Kennung von Nutzer oder Clerk", async () => {
    const { as } = await fullOwner();
    const exported = await as.query(api.dataExport.all, {});
    const check = (value: unknown, path: string) => {
      expect(["string", "boolean", "bigint", "object"], path).toContain(typeof value);
      if (Array.isArray(value)) value.forEach((entry, i) => check(entry, `${path}[${i}]`));
      else if (value !== null && typeof value === "object") Object.entries(value).forEach(([k, v]) => check(v, `${path}.${k}`));
    };
    check(exported, "export");
    const text = json(exported);
    expect(text).not.toContain("userId");
    expect(text).not.toContain("_creationTime");
    expect(text).not.toContain(OWNER.subject);
  });

  it("liefert für einen Nutzer ohne Datensatz ein leeres Modell mit Version", async () => {
    expect(await asOwner(newTest()).query(api.dataExport.all, {})).toEqual({
      formatVersion: 1n,
      settings: null,
      accounts: [],
      accountBalances: [],
      pockets: [],
      pocketBalances: [],
      budgetItems: [],
      debts: [],
      debtBalances: [],
      householdMembers: [],
    });
  });
});
