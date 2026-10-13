import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { ALLOWED_SUBJECT_ENV } from "../convex/access";
import { TODAY, anonymousInput } from "../convex/lib/fixtures";
import { seedFinanceInput } from "../convex/lib/seed";
import { buildBudget, buildDebts, buildOverview, buildUpcoming } from "../convex/lib/views";
import { toWire } from "../convex/lib/wire";
import { asOwner, newTest, OWNER, OWNER_TOKEN } from "./support";

// 8. August 2026, 12:00 Uhr in Berlin: der Eintragetag ist derselbe Kalendertag.
const RECORDED_AT = Date.UTC(2026, 7, 8, 10, 0);

beforeEach(() => {
  vi.stubEnv(ALLOWED_SUBJECT_ENV, OWNER.subject);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function seededOwner(change: (input: ReturnType<typeof anonymousInput>) => void = () => {}) {
  const t = newTest();
  const input = anonymousInput();
  change(input);
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      clerkTokenIdentifier: OWNER_TOKEN,
      homeTimeZone: "Europe/Berlin",
      monthlyIncomeCents: BigInt(input.incomeCents ?? 0),
      salaryDay: BigInt(input.salaryDay ?? 1),
      createdAt: 0n,
    });
    await seedFinanceInput(ctx.db, id, input, RECORDED_AT);
    return id;
  });
  return { t, as: asOwner(t), userId, input };
}

/** Entfernt Datenbank-Kennungen, damit Antworten mit den Modellen der Rechenfunktionen vergleichbar sind. */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["id", "accountId", "debtId"].includes(key))
        .map(([key, entry]) => [key, withoutIds(entry)]),
    );
  }
  return value;
}

describe("Ansichten liefern fertige Modelle aus der Datenbank", () => {
  it("entsprechen den Modellen des Rechenkerns für dieselben Daten", async () => {
    const { as, input } = await seededOwner();
    expect(withoutIds(await as.query(api.views.overview, { today: TODAY }))).toEqual(withoutIds(toWire(buildOverview(input))));
    expect(withoutIds(await as.query(api.views.budget, { today: TODAY }))).toEqual(withoutIds(toWire(buildBudget(input))));
    expect(withoutIds(await as.query(api.views.debts, { today: TODAY }))).toEqual(withoutIds(toWire(buildDebts(input))));
    expect(withoutIds(await as.query(api.views.upcoming, { today: TODAY }))).toEqual(withoutIds(toWire(buildUpcoming(input))));
  });

  it("liefert alle Ganzzahlen als int64 und nirgends eine Kommazahl", async () => {
    const { as } = await seededOwner();
    const check = (value: unknown, path: string) => {
      expect(typeof value, path).not.toBe("number");
      if (Array.isArray(value)) value.forEach((entry, i) => check(entry, `${path}[${i}]`));
      else if (value !== null && typeof value === "object") Object.entries(value).forEach(([k, v]) => check(v, `${path}.${k}`));
    };
    for (const name of ["overview", "budget", "debts", "upcoming"] as const) {
      check(await as.query(api.views[name], { today: TODAY }), name);
    }
  });

  it("zeigt die Kennzahlen mit Wert, Rechenweg, Alter und Status", async () => {
    const { as } = await seededOwner();
    const upcoming = await as.query(api.views.upcoming, { today: TODAY });
    expect(upcoming.availableUntilSalary).toMatchObject({
      key: "availableUntilSalary",
      unit: "cents",
      kind: "calculated",
      value: 90_430n,
      status: "ok",
      dataAgeDays: 0n,
      oldestDataDay: TODAY,
    });
    expect(upcoming.availableUntilSalary.steps.length).toBeGreaterThan(3);
    expect(upcoming.dailyAllowance.value).toBe(5_319n);
  });

  it("meldet einen leeren Nutzer als leer, ohne zu schreiben", async () => {
    const t = newTest();
    const overview = await asOwner(t).query(api.views.overview, { today: TODAY });
    expect(overview.isEmpty).toBe(true);
    expect(overview.accountsTotal).toMatchObject({ status: "unavailable", value: null });
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
  });
});

describe("Auswahl der Stände", () => {
  it("nimmt je Konto den jüngsten Stand bis heute und ignoriert spätere und ältere", async () => {
    const { t, as, userId } = await seededOwner();
    await t.run(async (ctx) => {
      const account = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).first();
      const insert = (day: string, cents: bigint) =>
        ctx.db.insert("accountBalances", { userId, accountId: account!._id, day, balanceCents: cents, recordedAt: BigInt(RECORDED_AT) });
      await insert("2026-07-31", 110_000n); // älter als der Stand vom 8.8.
      await insert("2026-08-09", 999_999n); // nach heute
      await insert("2026-09-01", 888_888n);
    });
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts[0]!.stand).toMatchObject({ day: TODAY, cents: 120_025n });
    expect(overview.accountsTotal.value).toBe(135_075n);

    // Einen Tag später gilt der Stand vom 9.8., aber nicht der vom 1.9.
    const later = await as.query(api.views.overview, { today: "2026-08-09" });
    expect(later.accounts[0]!.stand).toMatchObject({ day: "2026-08-09", cents: 999_999n });
    // Vor dem Stichtag gilt der ältere Stand
    const earlier = await as.query(api.views.overview, { today: "2026-08-05" });
    expect(earlier.accounts[0]!.stand).toMatchObject({ day: "2026-07-31", cents: 110_000n, ageDays: 5n });
  });

  it("nimmt bei mehreren Ständen am selben Tag den zuletzt angelegten", async () => {
    const { t, as, userId } = await seededOwner();
    await t.run(async (ctx) => {
      const account = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).first();
      await ctx.db.insert("accountBalances", { userId, accountId: account!._id, day: TODAY, balanceCents: 130_000n, recordedAt: BigInt(RECORDED_AT + 1) });
    });
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts[0]!.stand!.cents).toBe(130_000n);
  });

  it("rechnet den Eintragetag in Stevens Zeitzone", async () => {
    const { t, as, userId } = await seededOwner();
    await t.run(async (ctx) => {
      const account = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).first();
      // 8. August, 22:30 UTC = 9. August, 00:30 in Berlin
      await ctx.db.insert("accountBalances", { userId, accountId: account!._id, day: TODAY, balanceCents: 1n, recordedAt: BigInt(Date.UTC(2026, 7, 8, 22, 30)) });
    });
    expect((await as.query(api.views.overview, { today: TODAY })).accounts[0]!.stand!.recordedDay).toBe("2026-08-09");
  });

  it("nimmt den jüngsten bestätigten Kreditstand als Ausgangspunkt", async () => {
    const { t, as, userId } = await seededOwner();
    await t.run(async (ctx) => {
      const debt = (await ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", userId)).collect()).find((d) => d.lender === "Ratenkredit")!;
      const insert = (day: string, cents: bigint) =>
        ctx.db.insert("debtBalances", { userId, debtId: debt._id, day, balanceCents: cents, recordedAt: BigInt(RECORDED_AT) });
      await insert("2026-06-20", 880_000n);
      await insert("2026-07-25", 852_500n);
      await insert("2026-09-30", 700_000n); // nach heute
    });
    const debts = await as.query(api.views.debts, { today: TODAY });
    const loan = debts.debts.find((d) => d.lender === "Ratenkredit")!;
    expect(loan.deviation).toMatchObject({ day: "2026-07-25", bankCents: 852_500n, differenceCents: 630n });
    expect(loan.balance.value).toBe(852_500n);
  });

  it("ignoriert inaktive Konten ohne Stand", async () => {
    const { as } = await seededOwner();
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts.map((a) => a.name)).toEqual(["Alltagskonto", "Reise-Wallet", "Bargeld"]);
  });
});

describe("Trennung nach Besitzer", () => {
  it("liest nur Daten des angemeldeten Nutzers", async () => {
    const { t, as } = await seededOwner();
    await t.run(async (ctx) => {
      const other = await ctx.db.insert("users", { clerkTokenIdentifier: "https://x|andere", homeTimeZone: "UTC", createdAt: 0n });
      const account = await ctx.db.insert("accounts", { userId: other, name: "Fremdes Konto", kind: "bank", order: 9n, active: true });
      await ctx.db.insert("accountBalances", { userId: other, accountId: account, day: TODAY, balanceCents: 5_000_000n, recordedAt: 0n });
    });
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts.map((a) => a.name)).not.toContain("Fremdes Konto");
    expect(overview.accountsTotal.value).toBe(135_075n);
  });

  it("gibt den Tilgungsplan eines fremden Kredits nicht heraus", async () => {
    const { t, as } = await seededOwner();
    const foreignDebt = await t.run(async (ctx) => {
      const other = await ctx.db.insert("users", { clerkTokenIdentifier: "https://x|andere", homeTimeZone: "UTC", createdAt: 0n });
      return await ctx.db.insert("debts", {
        userId: other, lender: "Fremd", kind: "loan", principalCents: 100n, nominalRateBps: 0n, effectiveRateBps: 0n,
        monthlyPaymentCents: 10n, firstPaymentDay: "2026-01-01", paymentCount: 10n, order: 1n, active: true,
      });
    });
    expect(await as.query(api.views.debtSchedule, { today: TODAY, debtId: foreignDebt })).toBeNull();
  });

  it("liefert den Tilgungsplan des eigenen Kredits", async () => {
    const { t, as, userId } = await seededOwner();
    const debtId = await t.run(async (ctx) => {
      const debts = await ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
      return debts.find((d) => d.lender === "Ratenkredit")!._id;
    });
    const schedule = await as.query(api.views.debtSchedule, { today: TODAY, debtId });
    expect(schedule!.rows).toHaveLength(60);
    expect(schedule!.rows[19]).toMatchObject({ state: "upcoming", day: "2026-08-20", paymentCents: 22_645n });
    expect(schedule!.residualCents).toBe(0n);
  });
});

describe("Argumente werden vom Server geprüft", () => {
  it.each(["", "heute", "2026-02-31", "2026-8-8", "08.08.2026", "2026-08-08T10:00:00Z", "2026-13-01"])(
    "lehnt das Datum %j ab",
    async (today) => {
      const { as } = await seededOwner();
      for (const name of ["overview", "budget", "debts", "upcoming"] as const) {
        await expect(as.query(api.views[name], { today })).rejects.toMatchObject({ data: { code: "invalid_argument", field: "today" } });
      }
    },
  );

  it("lehnt falsche Typen und fehlende Argumente ab", async () => {
    const { as } = await seededOwner();
    // @ts-expect-error absichtlich falsch
    await expect(as.query(api.views.overview, { today: 20260808 })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch
    await expect(as.query(api.views.overview, {})).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: unbekanntes Feld
    await expect(as.query(api.views.overview, { today: TODAY, userId: "x" })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: keine Kennung eines Kredits
    await expect(as.query(api.views.debtSchedule, { today: TODAY, debtId: "kein-id" })).rejects.toThrow();
  });

  it("rechnet mit dem übergebenen Tag und hat keine eigene Uhr", async () => {
    const { as } = await seededOwner();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
      const a = await as.query(api.views.upcoming, { today: TODAY });
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const b = await as.query(api.views.upcoming, { today: TODAY });
      expect(a).toEqual(b);
      expect(a.nextSalaryDay).toBe("2026-08-25");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Nutzer anlegen", () => {
  it("legt den Datensatz einmal an, mit Heimatzeitzone und ohne erfundenes Einkommen", async () => {
    const t = newTest();
    const as = asOwner(t);
    expect(await as.mutation(api.users.ensureUser, {})).toEqual({ created: true });
    expect(await as.mutation(api.users.ensureUser, {})).toEqual({ created: false });
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ clerkTokenIdentifier: OWNER_TOKEN, homeTimeZone: "Europe/Berlin" });
    expect(users[0]!.monthlyIncomeCents).toBeUndefined();
    expect(users[0]!.salaryDay).toBeUndefined();
  });

  it("lehnt eine unbekannte Zeitzone ab", async () => {
    await expect(asOwner(newTest()).mutation(api.users.ensureUser, { homeTimeZone: "Mars/Olympus" })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "homeTimeZone" },
    });
  });

  it("zeigt nach dem Anlegen weiter einen Leerzustand", async () => {
    const as = asOwner(newTest());
    await as.mutation(api.users.ensureUser, {});
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.isEmpty).toBe(true);
    expect(overview.freeMonthly).toMatchObject({ status: "unavailable", reason: "Das Monatseinkommen fehlt." });
  });
});

describe("Wartung: Testdaten einspielen (intern)", () => {
  it("verweigert ohne ALLOW_DEMO_SEED", async () => {
    const { internal } = await import("../convex/_generated/api");
    await expect(newTest().mutation(internal.maintenance.seedAnonymousData, { tokenIdentifier: OWNER_TOKEN })).rejects.toThrow(/ALLOW_DEMO_SEED/);
  });

  it("spielt die anonymen Testdaten einmal ein und die Ansicht stimmt mit dem Rechenkern überein", async () => {
    vi.stubEnv("ALLOW_DEMO_SEED", "true");
    const { internal } = await import("../convex/_generated/api");
    const t = newTest();
    await t.mutation(internal.maintenance.seedAnonymousData, { tokenIdentifier: OWNER_TOKEN });
    await expect(t.mutation(internal.maintenance.seedAnonymousData, { tokenIdentifier: OWNER_TOKEN })).rejects.toThrow();
    const overview = await asOwner(t).query(api.views.overview, { today: TODAY });
    expect(overview.accountsTotal.value).toBe(135_075n);
    expect(overview.freeMonthly.value).toBe(14_355n);
  });
});

