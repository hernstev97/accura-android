import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ALLOWED_SUBJECT_ENV } from "../convex/access";
import { MAX_AMOUNT_CENTS } from "../convex/editing";
import { TODAY, anonymousInput } from "../convex/lib/fixtures";
import { seedFinanceInput } from "../convex/lib/seed";
import { asOwner, newTest, OWNER, OWNER_TOKEN, type Client } from "./support";

const RECORDED_AT = Date.UTC(2026, 7, 8, 10, 0);

beforeEach(() => {
  vi.stubEnv(ALLOWED_SUBJECT_ENV, OWNER.subject);
  vi.useFakeTimers({ toFake: ["Date"] });
  // 8. August 2026, 12:30 Uhr in Berlin.
  vi.setSystemTime(new Date("2026-08-08T10:30:00Z"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function seededOwner() {
  const t = newTest();
  const input = anonymousInput();
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
  const as = asOwner(t);
  const records = await as.query(api.records.list, {});
  const account = (name: string) => records.accounts.find((entry) => entry.name === name)!;
  const pocket = (name: string) => records.pockets.find((entry) => entry.name === name)!;
  const debt = (lender: string) => records.debts.find((entry) => entry.lender === lender)!;
  return { t, as, userId, account, pocket, debt };
}

async function freshAccount() {
  const t = newTest();
  const as = asOwner(t);
  await as.mutation(api.users.ensureUser, {});
  const { id } = await as.mutation(api.accounts.create, { name: "Giro", kind: "bank" });
  return { t, as, id };
}

/** Alle gespeicherten Stände, um „nichts gespeichert“ zu prüfen. */
const allStands = (t: ReturnType<typeof newTest>) =>
  t.run(async (ctx) => ({
    accounts: await ctx.db.query("accountBalances").collect(),
    pockets: await ctx.db.query("pocketBalances").collect(),
    debts: await ctx.db.query("debtBalances").collect(),
  }));

const accountRows = (t: ReturnType<typeof newTest>, accountId: Id<"accounts">) =>
  t.run((ctx) => ctx.db.query("accountBalances").filter((q) => q.eq(q.field("accountId"), accountId)).collect());

const standOf = async (as: Client, id: string) => (await as.query(api.records.list, {})).accounts.find((entry) => entry.id === id)!.stand;

describe("Ein Stand je Kalendertag", () => {
  it("trägt den ersten Stand ein: Tag aus dem Argument, recordedAt ist der Zeitpunkt der Eintragung", async () => {
    const { t, as, id } = await freshAccount();
    expect(await as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 50_000n, expected: null }] })).toEqual({
      day: TODAY,
      count: 1n,
    });
    expect(await accountRows(t, id)).toEqual([
      expect.objectContaining({ day: TODAY, balanceCents: 50_000n, recordedAt: BigInt(Date.UTC(2026, 7, 8, 10, 30)) }),
    ]);
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts[0]!.stand).toMatchObject({ day: TODAY, cents: 50_000n, recordedDay: TODAY, ageDays: 0n });
    expect(overview.accountsTotal.value).toBe(50_000n);
  });

  it("ersetzt einen Stand vom selben Tag, statt einen zweiten anzulegen", async () => {
    const { t, as, id } = await freshAccount();
    await as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 50_000n, expected: null }] });
    vi.setSystemTime(new Date("2026-08-08T18:00:00Z"));
    await as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 48_000n, expected: { day: TODAY, balanceCents: 50_000n } }] });
    expect(await accountRows(t, id)).toEqual([
      expect.objectContaining({ day: TODAY, balanceCents: 48_000n, recordedAt: BigInt(Date.UTC(2026, 7, 8, 18, 0)) }),
    ]);
  });

  it("legt am nächsten Tag einen neuen Stand an; der ältere bleibt als Verlauf", async () => {
    const { t, as, id } = await freshAccount();
    await as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 50_000n, expected: null }] });
    vi.setSystemTime(new Date("2026-08-09T07:00:00Z"));
    await as.mutation(api.stands.record, { day: "2026-08-09", accounts: [{ id, balanceCents: 45_000n, expected: { day: TODAY, balanceCents: 50_000n } }] });
    expect((await accountRows(t, id)).map((row) => [row.day, row.balanceCents])).toEqual([
      [TODAY, 50_000n],
      ["2026-08-09", 45_000n],
    ]);
    expect((await as.query(api.views.overview, { today: TODAY })).accounts[0]!.stand!.cents).toBe(50_000n);
    expect((await as.query(api.views.overview, { today: "2026-08-09" })).accounts[0]!.stand!.cents).toBe(45_000n);
  });

  it("nimmt den Tag des Geräts, auch wenn das UTC-Datum noch ein anderes ist", async () => {
    const { t, as, id } = await freshAccount();
    // 8. August 23:30 UTC = 9. August 01:30 in Berlin.
    vi.setSystemTime(new Date("2026-08-08T23:30:00Z"));
    await as.mutation(api.stands.record, { day: "2026-08-09", accounts: [{ id, balanceCents: 1n, expected: null }] });
    expect((await accountRows(t, id))[0]).toMatchObject({ day: "2026-08-09" });
    expect((await as.query(api.views.overview, { today: "2026-08-09" })).accounts[0]!.stand!.recordedDay).toBe("2026-08-09");
  });

  it.each(["2026-08-06", "2026-08-10", "2027-08-08"])("lehnt den Tag %s ab, der mehr als einen Tag von der Uhr abweicht", async (day) => {
    const { t, as, id } = await freshAccount();
    await expect(as.mutation(api.stands.record, { day, accounts: [{ id, balanceCents: 1n, expected: null }] })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "day" },
    });
    expect(await accountRows(t, id)).toEqual([]);
  });

  it.each(["2026-08-07", "2026-08-09"])("nimmt den Nachbartag %s an (andere Zeitzone)", async (day) => {
    const { as, id } = await freshAccount();
    await expect(as.mutation(api.stands.record, { day, accounts: [{ id, balanceCents: 1n, expected: null }] })).resolves.toMatchObject({ count: 1n });
  });

  it.each(["", "heute", "2026-02-30", "2026-8-8", "08.08.2026"])("lehnt das Datum %j ab", async (day) => {
    const { as, id } = await freshAccount();
    await expect(as.mutation(api.stands.record, { day, accounts: [{ id, balanceCents: 1n, expected: null }] })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "day" },
    });
  });

  it("schreibt keinen Stand vor einen jüngeren (date_conflict)", async () => {
    const { t, as, id } = await freshAccount();
    vi.setSystemTime(new Date("2026-08-09T07:00:00Z"));
    await as.mutation(api.stands.record, { day: "2026-08-09", accounts: [{ id, balanceCents: 2n, expected: null }] });
    // Ein Gerät, dessen Datum noch auf dem 8. steht, kennt den Stand vom 9.
    await expect(
      as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 1n, expected: { day: "2026-08-09", balanceCents: 2n } }] }),
    ).rejects.toMatchObject({ data: { code: "date_conflict", field: "accounts.0" } });
    expect((await accountRows(t, id)).map((row) => row.day)).toEqual(["2026-08-09"]);
  });
});

describe("Unverändert", () => {
  it("übernimmt den letzten Wert als Stand von heute; das Datenalter beginnt neu", async () => {
    const { t, as, account } = await seededOwner();
    vi.setSystemTime(new Date("2026-08-12T08:00:00Z"));
    const giro = account("Alltagskonto");
    expect((await as.query(api.views.overview, { today: "2026-08-12" })).accounts[0]!.stand).toMatchObject({ day: TODAY, ageDays: 4n });

    await as.mutation(api.stands.record, { day: "2026-08-12", accounts: [{ id: giro.id, unchanged: true, expected: giro.stand! }] });
    expect(await standOf(as, giro.id)).toEqual({ day: "2026-08-12", balanceCents: 120_025n });
    expect((await as.query(api.views.overview, { today: "2026-08-12" })).accounts[0]!.stand).toMatchObject({ day: "2026-08-12", ageDays: 0n, cents: 120_025n });
    expect(await accountRows(t, giro.id as Id<"accounts">)).toHaveLength(2);
  });

  it("gilt auch für Pockets", async () => {
    const { as, pocket } = await seededOwner();
    const reise = pocket("Reise");
    vi.setSystemTime(new Date("2026-08-12T08:00:00Z"));
    await as.mutation(api.stands.record, { day: "2026-08-12", pockets: [{ id: reise.id, unchanged: true, expected: reise.stand! }] });
    expect((await as.query(api.records.list, {})).pockets.find((entry) => entry.id === reise.id)!.stand).toEqual({ day: "2026-08-12", balanceCents: 7_500n });
  });

  it("braucht einen gesehenen Stand und meldet einen Konflikt, wenn der letzte Wert inzwischen anders ist", async () => {
    const { as, account } = await seededOwner();
    const giro = account("Alltagskonto");
    // @ts-expect-error absichtlich falsch: „unverändert“ ohne gesehenen Stand
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: [{ id: giro.id, unchanged: true, expected: null }] })).rejects.toThrow();
    // Betrag und „unverändert“ zugleich: TypeScript lässt das bei Unions durch, der Validator nicht.
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: [{ id: giro.id, unchanged: true, balanceCents: 1n, expected: giro.stand! }] })).rejects.toThrow();

    await as.mutation(api.stands.record, { day: TODAY, accounts: [{ id: giro.id, balanceCents: 99n, expected: giro.stand! }] });
    await expect(
      as.mutation(api.stands.record, { day: TODAY, accounts: [{ id: giro.id, unchanged: true, expected: giro.stand! }] }),
    ).rejects.toMatchObject({
      data: { code: "conflict", conflicts: [{ entity: "accountStand", id: giro.id, current: { day: TODAY, balanceCents: 99n } }] },
    });
  });

  it("gibt es für Kredite nicht, weil ein alter Bankstand mit neuem Datum gezahlte Raten überginge", async () => {
    const { as, debt } = await seededOwner();
    const loan = debt("Ratenkredit");
    await expect(
      // @ts-expect-error absichtlich falsch: kein „unverändert“ für Kredite
      as.mutation(api.stands.record, { day: TODAY, debts: [{ id: loan.id, unchanged: true, expected: null }] }),
    ).rejects.toThrow();
  });
});

describe("Kredit-Bankstand", () => {
  it("speichert Restschuld und optionale Ablösesumme; die Schuldenansicht rechnet ab diesem Stand", async () => {
    const { as, debt } = await seededOwner();
    const loan = debt("Ratenkredit");
    expect(loan.stand).toBeNull();
    await as.mutation(api.stands.record, { day: TODAY, debts: [{ id: loan.id, balanceCents: 852_000n, payoffQuoteCents: 860_000n, expected: null }] });
    const updated = (await as.query(api.records.list, {})).debts.find((entry) => entry.id === loan.id)!;
    expect(updated.stand).toEqual({ day: TODAY, balanceCents: 852_000n, payoffQuoteCents: 860_000n });
    const view = (await as.query(api.views.debts, { today: TODAY })).debts.find((entry) => entry.lender === "Ratenkredit")!;
    expect(view.deviation).toMatchObject({ day: TODAY, bankCents: 852_000n });
    expect(view.payoff).toMatchObject({ source: "bank", balanceCents: 852_000n, maxCents: 860_000n });

    // Am selben Tag ohne Ablösesumme ersetzt: Die alte Ablösesumme verschwindet mit.
    await as.mutation(api.stands.record, { day: TODAY, debts: [{ id: loan.id, balanceCents: 851_000n, expected: updated.stand }] });
    expect((await as.query(api.records.list, {})).debts.find((entry) => entry.id === loan.id)!.stand).toEqual({
      day: TODAY, balanceCents: 851_000n, payoffQuoteCents: null,
    });
  });

  it.each([
    ["negative Restschuld", { balanceCents: -1n }, "debts.0.balanceCents"],
    ["negative Ablösesumme", { balanceCents: 1n, payoffQuoteCents: -1n }, "debts.0.payoffQuoteCents"],
    ["zu große Restschuld", { balanceCents: MAX_AMOUNT_CENTS + 1n }, "debts.0.balanceCents"],
  ])("lehnt %s ab", async (_label, change, field) => {
    const { t, as, debt } = await seededOwner();
    const before = await allStands(t);
    await expect(
      as.mutation(api.stands.record, { day: TODAY, debts: [{ id: debt("Ratenkredit").id, expected: null, ...change }] }),
    ).rejects.toMatchObject({ data: { code: "invalid_argument", field } });
    expect(await allStands(t)).toEqual(before);
  });
});

describe("Stände aktualisieren: ein Durchgang, ganz oder gar nicht", () => {
  it("speichert Konten, Pockets und Kredite in einer Mutation", async () => {
    const { as, account, pocket, debt } = await seededOwner();
    vi.setSystemTime(new Date("2026-08-12T08:00:00Z"));
    const giro = account("Alltagskonto");
    const wallet = account("Reise-Wallet");
    const result = await as.mutation(api.stands.record, {
      day: "2026-08-12",
      accounts: [
        { id: giro.id, balanceCents: -2_500n, expected: giro.stand }, // Dispo ist erlaubt
        { id: wallet.id, unchanged: true, expected: wallet.stand! },
      ],
      pockets: [{ id: pocket("Wohnen").id, balanceCents: 31_000n, expected: pocket("Wohnen").stand }],
      debts: [{ id: debt("Finanzierung A").id, balanceCents: 12_000n, expected: null }],
    });
    expect(result).toEqual({ day: "2026-08-12", count: 4n });
    const overview = await as.query(api.views.overview, { today: "2026-08-12" });
    expect(overview.accounts.map((entry) => [entry.name, entry.stand!.day, entry.stand!.cents])).toEqual([
      ["Alltagskonto", "2026-08-12", -2_500n],
      ["Reise-Wallet", "2026-08-12", 12_050n],
      ["Bargeld", TODAY, 3_000n],
    ]);
  });

  it("speichert nichts, wenn der letzte Stand im Durchgang ungültig ist", async () => {
    const { t, as, account, pocket, debt } = await seededOwner();
    const before = await allStands(t);
    await expect(
      as.mutation(api.stands.record, {
        day: TODAY,
        accounts: [{ id: account("Alltagskonto").id, balanceCents: 1n, expected: account("Alltagskonto").stand }],
        pockets: [{ id: pocket("Wohnen").id, balanceCents: 2n, expected: pocket("Wohnen").stand }],
        debts: [{ id: debt("Ratenkredit").id, balanceCents: -3n, expected: null }],
      }),
    ).rejects.toMatchObject({ data: { code: "invalid_argument", field: "debts.0.balanceCents" } });
    expect(await allStands(t)).toEqual(before);
  });

  it("speichert nichts, wenn ein Eintrag einem anderen Nutzer gehört", async () => {
    const { t, as, account } = await seededOwner();
    const foreign = await t.run(async (ctx) => {
      const other = await ctx.db.insert("users", { clerkTokenIdentifier: "https://x|andere", homeTimeZone: "UTC", createdAt: 0n });
      return await ctx.db.insert("accounts", { userId: other, name: "Fremd", kind: "bank", order: 1n, active: true });
    });
    const before = await allStands(t);
    await expect(
      as.mutation(api.stands.record, {
        day: TODAY,
        accounts: [
          { id: account("Alltagskonto").id, balanceCents: 1n, expected: account("Alltagskonto").stand },
          { id: foreign, balanceCents: 1n, expected: null },
        ],
      }),
    ).rejects.toMatchObject({ data: { code: "invalid_argument", field: "accounts.1.id" } });
    expect(await allStands(t)).toEqual(before);
  });

  it("speichert nichts und nennt alle Konflikte, wenn mehrere gesehene Stände veraltet sind", async () => {
    const { t, as, account, pocket } = await seededOwner();
    const giro = account("Alltagskonto");
    const wohnen = pocket("Wohnen");
    const bargeld = account("Bargeld");
    // Ein anderes Gerät hat Giro und Wohnen schon aktualisiert.
    await as.mutation(api.stands.record, {
      day: TODAY,
      accounts: [{ id: giro.id, balanceCents: 100_000n, expected: giro.stand }],
      pockets: [{ id: wohnen.id, balanceCents: 29_000n, expected: wohnen.stand }],
    });
    const before = await allStands(t);
    let error: { message: string; data: unknown } | undefined;
    try {
      await as.mutation(api.stands.record, {
        day: TODAY,
        accounts: [
          { id: bargeld.id, balanceCents: 2_000n, expected: bargeld.stand },
          { id: giro.id, balanceCents: 110_000n, expected: giro.stand },
        ],
        pockets: [{ id: wohnen.id, balanceCents: 31_000n, expected: wohnen.stand }],
      });
    } catch (thrown) {
      error = thrown as { message: string; data: unknown };
    }
    expect(error?.data).toEqual({
      code: "conflict",
      conflicts: [
        { entity: "accountStand", id: giro.id, current: { day: TODAY, balanceCents: 100_000n } },
        { entity: "pocketStand", id: wohnen.id, current: { day: TODAY, balanceCents: 29_000n } },
      ],
    });
    expect(error?.message).toBe("conflict");
    expect(await allStands(t)).toEqual(before);
  });

  it("meldet einen Konflikt, wenn die App „kein Stand“ gesehen hat, es aber inzwischen einen gibt", async () => {
    const { as, id } = await freshAccount();
    await as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 5n, expected: null }] });
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: [{ id, balanceCents: 6n, expected: null }] })).rejects.toMatchObject({
      data: { code: "conflict", conflicts: [{ entity: "accountStand", id, current: { day: TODAY, balanceCents: 5n } }] },
    });
  });

  it("lehnt doppelte Einträge, zu lange Listen und zu große Beträge ab", async () => {
    const { as, account } = await seededOwner();
    const giro = account("Alltagskonto");
    const entry = { id: giro.id, balanceCents: 1n, expected: giro.stand };
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: [entry, entry] })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "accounts.1.id" },
    });
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: Array.from({ length: 101 }, () => entry) })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "accounts" },
    });
    await expect(
      as.mutation(api.stands.record, { day: TODAY, accounts: [{ ...entry, balanceCents: -MAX_AMOUNT_CENTS - 1n }] }),
    ).rejects.toMatchObject({ data: { code: "invalid_argument", field: "accounts.0.balanceCents" } });
    // @ts-expect-error absichtlich falsch: Betrag als Kommazahl
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: [{ ...entry, balanceCents: 1.5 }] })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: Kennung eines Pockets in der Kontenliste
    await expect(as.mutation(api.stands.record, { day: TODAY, accounts: [{ ...entry, id: (await as.query(api.records.list, {})).pockets[0]!.id }] })).rejects.toThrow();
  });

  it("schreibt bei leeren Listen nichts", async () => {
    const { t, as } = await seededOwner();
    const before = await allStands(t);
    expect(await as.mutation(api.stands.record, { day: TODAY })).toEqual({ day: TODAY, count: 0n });
    expect(await allStands(t)).toEqual(before);
  });
});
