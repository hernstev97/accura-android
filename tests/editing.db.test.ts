import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ALLOWED_SUBJECT_ENV } from "../convex/access";
import { MAX_AMOUNT_CENTS } from "../convex/editing";
import { TODAY, anonymousInput } from "../convex/lib/fixtures";
import { seedFinanceInput } from "../convex/lib/seed";
import { asOwner, newTest, OWNER, OWNER_TOKEN, STRANGER, type Client } from "./support";

const RECORDED_AT = Date.UTC(2026, 7, 8, 10, 0);

beforeEach(() => {
  vi.stubEnv(ALLOWED_SUBJECT_ENV, OWNER.subject);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Besitzer mit den anonymen Testdaten. */
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
  return { t, as: asOwner(t), userId };
}

/** Besitzer, der sich angemeldet hat, aber noch nichts erfasst hat. */
async function freshOwner() {
  const t = newTest();
  const as = asOwner(t);
  await as.mutation(api.users.ensureUser, {});
  return { t, as };
}

async function foreignUser(t: ReturnType<typeof newTest>) {
  return await t.run((ctx) => ctx.db.insert("users", { clerkTokenIdentifier: "https://x|andere", homeTimeZone: "UTC", createdAt: 0n }));
}

/** Datensatz aus `records:list` ohne `id` und `stand`: genau das, was die App als `expected` schickt. */
function seen<T extends { id: unknown }>(record: T): Omit<T, "id" | "stand"> {
  const { id: _id, stand: _stand, ...rest } = record as T & { stand?: unknown };
  return rest;
}

/** Dieselben Felder ohne `active`: die neuen Werte für `update`. */
function editable<T extends { id: unknown; active: boolean }>(record: T): Omit<Omit<T, "id" | "stand">, "active"> {
  const { active: _active, ...rest } = seen(record);
  return rest;
}

async function listed(as: Client) {
  return await as.query(api.records.list, {});
}

async function errorOf(promise: Promise<unknown>): Promise<{ message: string; data: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    return error as { message: string; data: Record<string, unknown> };
  }
  throw new Error("Es kam kein Fehler.");
}

// ------------------------------------------------------------------ Konten

describe("Konten", () => {
  it("legt ein Konto ohne Stand an, hinten in der Reihenfolge, und die Übersicht zeigt es", async () => {
    const { as } = await seededOwner();
    const before = await listed(as);
    const { id } = await as.mutation(api.accounts.create, { name: "  Tagesgeld  ", kind: "bank" });
    const account = (await listed(as)).accounts.find((entry) => entry.id === id)!;
    expect(account).toEqual({
      id,
      name: "Tagesgeld",
      kind: "bank",
      order: before.accounts.reduce((max, entry) => (entry.order > max ? entry.order : max), 0n) + 1n,
      active: true,
      stand: null,
    });
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts.map((entry) => entry.name)).toContain("Tagesgeld");
    // Ein Konto ohne Stand macht die Summe ehrlich „nicht berechenbar“.
    expect(overview.accountsTotal).toMatchObject({ status: "unavailable", value: null });
  });

  it("übernimmt eine angegebene Reihenfolge", async () => {
    const { as } = await freshOwner();
    const { id } = await as.mutation(api.accounts.create, { name: "Bargeld", kind: "cash", order: 7n });
    expect((await listed(as)).accounts).toEqual([expect.objectContaining({ id, order: 7n })]);
  });

  it("verlangt einen angelegten Nutzer", async () => {
    await expect(asOwner(newTest()).mutation(api.accounts.create, { name: "Konto", kind: "bank" })).rejects.toMatchObject({
      data: { code: "user_missing" },
    });
  });

  it.each([
    ["leerer Name", { name: "   " }, "name"],
    ["zu langer Name", { name: "x".repeat(81) }, "name"],
    ["Zeilenumbruch im Namen", { name: "Giro\nkonto" }, "name"],
    ["Steuerzeichen im Namen", { name: "Giro\u0000" }, "name"],
    ["negative Reihenfolge", { order: -1n }, "order"],
    ["zu große Reihenfolge", { order: 1_000_001n }, "order"],
  ])("lehnt %s ab", async (_label, change, field) => {
    const { t, as } = await freshOwner();
    await expect(as.mutation(api.accounts.create, { name: "Konto", kind: "bank", ...change })).rejects.toMatchObject({
      data: { code: "invalid_argument", field },
    });
    expect(await t.run((ctx) => ctx.db.query("accounts").collect())).toEqual([]);
  });

  it("lehnt unbekannte Felder, falsche Typen und eine Besitzer-Angabe ab", async () => {
    const { as, t } = await freshOwner();
    const userId = await t.run(async (ctx) => (await ctx.db.query("users").first())!._id);
    // @ts-expect-error absichtlich falsch: keine Besitzer-Angabe vom Client
    await expect(as.mutation(api.accounts.create, { name: "Konto", kind: "bank", userId })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: unbekannte Art
    await expect(as.mutation(api.accounts.create, { name: "Konto", kind: "depot" })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: Reihenfolge als Kommazahl
    await expect(as.mutation(api.accounts.create, { name: "Konto", kind: "bank", order: 1.5 })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("accounts").collect())).toEqual([]);
  });

  it("ändert Name, Art und Reihenfolge, wenn der gesehene Stand stimmt", async () => {
    const { as } = await seededOwner();
    const account = (await listed(as)).accounts[0]!;
    await as.mutation(api.accounts.update, { id: account.id, name: "Giro", kind: "wallet", order: 9n, expected: seen(account) });
    expect((await listed(as)).accounts.find((entry) => entry.id === account.id)).toMatchObject({ name: "Giro", kind: "wallet", order: 9n });
  });

  it("lehnt eine Änderung auf veralteter Grundlage ab, liefert die aktuellen Werte und speichert nichts", async () => {
    const { as } = await seededOwner();
    const account = (await listed(as)).accounts[0]!;
    // Ein anderes Gerät ändert zuerst.
    await as.mutation(api.accounts.update, { id: account.id, name: "Anderes Gerät", kind: "bank", order: 1n, expected: seen(account) });
    const error = await errorOf(
      as.mutation(api.accounts.update, { id: account.id, name: "Dieses Gerät", kind: "bank", order: 1n, expected: seen(account) }),
    );
    expect(error.data).toEqual({
      code: "conflict",
      conflicts: [{ entity: "account", id: account.id, current: { name: "Anderes Gerät", kind: "bank", order: 1n, active: true } }],
    });
    expect((await listed(as)).accounts[0]!.name).toBe("Anderes Gerät");
  });

  it("archiviert ohne zu löschen: Ansichten lassen das Konto weg, die Liste zum Bearbeiten nicht", async () => {
    const { t, as } = await seededOwner();
    const account = (await listed(as)).accounts.find((entry) => entry.name === "Bargeld")!;
    const balancesBefore = await t.run((ctx) => ctx.db.query("accountBalances").collect());

    await as.mutation(api.accounts.setActive, { id: account.id, active: false, expected: seen(account) });
    let overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accounts.map((entry) => entry.name)).toEqual(["Alltagskonto", "Reise-Wallet"]);
    expect(overview.accountsTotal.value).toBe(135_075n - account.stand!.balanceCents);
    const archived = (await listed(as)).accounts.find((entry) => entry.id === account.id)!;
    expect(archived).toMatchObject({ active: false, stand: account.stand });
    expect(await t.run((ctx) => ctx.db.query("accountBalances").collect())).toEqual(balancesBefore);

    await as.mutation(api.accounts.setActive, { id: account.id, active: true, expected: seen(archived) });
    overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.accountsTotal.value).toBe(135_075n);
  });

  it("archiviert kein Konto mit aktiven Pockets", async () => {
    const { as } = await seededOwner();
    const records = await listed(as);
    const withPocket = records.accounts.find((entry) => records.pockets.some((pocket) => pocket.accountId === entry.id && pocket.active))!;
    await expect(
      as.mutation(api.accounts.setActive, { id: withPocket.id, active: false, expected: seen(withPocket) }),
    ).rejects.toMatchObject({ data: { code: "has_active_pockets" } });
    expect((await listed(as)).accounts.find((entry) => entry.id === withPocket.id)!.active).toBe(true);
  });

  it("weist ein fremdes Konto ab, ohne zu verraten, dass es existiert", async () => {
    const { t, as } = await seededOwner();
    const other = await foreignUser(t);
    const foreign = await t.run((ctx) => ctx.db.insert("accounts", { userId: other, name: "Fremd", kind: "bank", order: 1n, active: true }));
    const expected = { name: "Fremd", kind: "bank" as const, order: 1n, active: true };
    await expect(as.mutation(api.accounts.update, { id: foreign, name: "Meins", kind: "bank", order: 1n, expected })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "id" },
    });
    await expect(as.mutation(api.accounts.setActive, { id: foreign, active: false, expected })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "id" },
    });
    expect(await t.run((ctx) => ctx.db.get(foreign))).toMatchObject(expected);
  });

  it("schreibt ohne Anmeldung und mit fremdem Clerk-Konto nichts", async () => {
    const { t, as } = await seededOwner();
    const account = (await listed(as)).accounts[0]!;
    const args = { id: account.id, name: "Übernommen", kind: "bank" as const, order: 1n, expected: seen(account) };
    await expect(t.mutation(api.accounts.update, args)).rejects.toMatchObject({ data: { code: "unauthenticated" } });
    const stranger = t.withIdentity({ ...STRANGER, tokenIdentifier: `${STRANGER.issuer}|${STRANGER.subject}` });
    await expect(stranger.mutation(api.accounts.update, args)).rejects.toMatchObject({ data: { code: "forbidden" } });
    await expect(stranger.mutation(api.accounts.create, { name: "Neu", kind: "bank" })).rejects.toMatchObject({ data: { code: "forbidden" } });
    expect((await listed(as)).accounts[0]!.name).toBe(account.name);
    expect((await listed(as)).accounts).toHaveLength(4);
  });
});

// ------------------------------------------------------------------ Pockets

describe("Pockets", () => {
  async function setup() {
    const { t, as } = await freshOwner();
    const { id: accountId } = await as.mutation(api.accounts.create, { name: "Giro", kind: "bank" });
    const { id: otherAccountId } = await as.mutation(api.accounts.create, { name: "Spar", kind: "bank" });
    const { id: pocketId } = await as.mutation(api.pockets.create, { accountId, name: "Urlaub" });
    return { t, as, accountId, otherAccountId, pocketId };
  }

  it("legt an, zieht in ein anderes Konto um und archiviert", async () => {
    const { as, otherAccountId, pocketId } = await setup();
    let pocket = (await listed(as)).pockets[0]!;
    expect(pocket).toMatchObject({ id: pocketId, name: "Urlaub", order: 1n, active: true, stand: null });

    await as.mutation(api.pockets.update, { id: pocketId, accountId: otherAccountId, name: "Reisen", order: 2n, expected: seen(pocket) });
    pocket = (await listed(as)).pockets[0]!;
    expect(pocket).toMatchObject({ accountId: otherAccountId, name: "Reisen", order: 2n });

    await as.mutation(api.pockets.setActive, { id: pocketId, active: false, expected: seen(pocket) });
    expect((await listed(as)).pockets[0]!.active).toBe(false);
    expect((await as.query(api.views.overview, { today: TODAY })).pockets).toEqual([]);
  });

  it("hängt kein aktives Pocket an ein archiviertes Konto", async () => {
    const { as, accountId, otherAccountId, pocketId } = await setup();
    const other = (await listed(as)).accounts.find((entry) => entry.id === otherAccountId)!;
    await as.mutation(api.accounts.setActive, { id: otherAccountId, active: false, expected: seen(other) });

    await expect(as.mutation(api.pockets.create, { accountId: otherAccountId, name: "Neu" })).rejects.toMatchObject({
      data: { code: "account_archived", field: "accountId" },
    });
    const pocket = (await listed(as)).pockets[0]!;
    await expect(
      as.mutation(api.pockets.update, { id: pocketId, accountId: otherAccountId, name: "Urlaub", order: 1n, expected: seen(pocket) }),
    ).rejects.toMatchObject({ data: { code: "account_archived", field: "accountId" } });

    // Pocket archivieren, dann das Konto: Zurückholen geht erst, wenn das Konto wieder aktiv ist.
    await as.mutation(api.pockets.setActive, { id: pocketId, active: false, expected: seen(pocket) });
    const account = (await listed(as)).accounts.find((entry) => entry.id === accountId)!;
    await as.mutation(api.accounts.setActive, { id: accountId, active: false, expected: seen(account) });
    const archived = (await listed(as)).pockets[0]!;
    await expect(as.mutation(api.pockets.setActive, { id: pocketId, active: true, expected: seen(archived) })).rejects.toMatchObject({
      data: { code: "account_archived" },
    });
  });

  it("weist ein fremdes Konto als Ziel ab", async () => {
    const { t, as } = await setup();
    const other = await foreignUser(t);
    const foreign = await t.run((ctx) => ctx.db.insert("accounts", { userId: other, name: "Fremd", kind: "bank", order: 1n, active: true }));
    await expect(as.mutation(api.pockets.create, { accountId: foreign, name: "Neu" })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "accountId" },
    });
  });

  it("meldet einen Konflikt beim Archivieren, wenn das Pocket inzwischen anders heißt", async () => {
    const { as, pocketId } = await setup();
    const pocket = (await listed(as)).pockets[0]!;
    await as.mutation(api.pockets.update, { ...editable(pocket), id: pocketId, name: "Umbenannt", expected: seen(pocket) });
    await expect(as.mutation(api.pockets.setActive, { id: pocketId, active: false, expected: seen(pocket) })).rejects.toMatchObject({
      data: { code: "conflict", conflicts: [{ entity: "pocket", id: pocketId, current: { name: "Umbenannt", active: true } }] },
    });
    expect((await listed(as)).pockets[0]!.active).toBe(true);
  });
});

// -------------------------------------------------------------- Budgetposten

describe("Budgetposten", () => {
  const streaming = {
    label: "Streaming C",
    monthlyAmountCents: 1_299n,
    necessity: "optional" as const,
    kind: "expense" as const,
    category: "Abo",
    dueDay: 15n,
    contractType: "Streaming",
    contractEndDay: "2026-12-31",
    noticePeriodMonths: 1n,
    note: "Familienabo\nmit Werbung",
  };

  it("legt einen Posten mit Vertragsdaten an; Budget und Hinweise rechnen damit", async () => {
    const { as } = await seededOwner();
    const budgetBefore = await as.query(api.views.budget, { today: TODAY });
    const { id } = await as.mutation(api.budgetItems.create, streaming);
    const item = (await listed(as)).budgetItems.find((entry) => entry.id === id)!;
    expect(item).toMatchObject({ ...streaming, noticePeriodDays: null, active: true });

    const budget = await as.query(api.views.budget, { today: TODAY });
    expect(budget.expensesCents).toBe(budgetBefore.expensesCents + 1_299n);
    const hints = await as.query(api.views.hints, { today: TODAY });
    const hinted = hints.hints.find((hint) => hint.type === "subscriptions")!.items.find((entry) => entry.label === "Streaming C")!;
    expect(hinted.cancellation).toMatchObject({ state: "open", lastNoticeDay: "2026-11-30" });
  });

  it.each([
    ["negativer Betrag", { monthlyAmountCents: -1n }, "monthlyAmountCents"],
    ["zu großer Betrag", { monthlyAmountCents: MAX_AMOUNT_CENTS + 1n }, "monthlyAmountCents"],
    ["Fälligkeitstag 0", { dueDay: 0n }, "dueDay"],
    ["Fälligkeitstag 32", { dueDay: 32n }, "dueDay"],
    ["Vertragsende 31. Februar", { contractEndDay: "2026-02-31" }, "contractEndDay"],
    ["Frist in Tagen und Monaten", { noticePeriodDays: 30n }, "noticePeriodMonths"],
    ["Frist über zehn Jahre", { noticePeriodMonths: 121n }, "noticePeriodMonths"],
    ["negative Frist", { noticePeriodMonths: null, noticePeriodDays: -1n }, "noticePeriodDays"],
    ["leere Kategorie", { category: " " }, "category"],
    ["zu lange Kategorie", { category: "k".repeat(41) }, "category"],
    ["zu lange Art", { contractType: "a".repeat(41) }, "contractType"],
    ["zu lange Notiz", { note: "n".repeat(1_001) }, "note"],
    ["Steuerzeichen in der Notiz", { note: "a\u0007b" }, "note"],
  ])("lehnt %s ab", async (_label, change, field) => {
    const { t, as } = await freshOwner();
    await expect(as.mutation(api.budgetItems.create, { ...streaming, ...change })).rejects.toMatchObject({
      data: { code: "invalid_argument", field },
    });
    expect(await t.run((ctx) => ctx.db.query("budgetItems").collect())).toEqual([]);
  });

  it("ersetzt beim Ändern alle Felder; `null` und leerer Text löschen freiwillige Felder", async () => {
    const { t, as } = await freshOwner();
    const { id } = await as.mutation(api.budgetItems.create, streaming);
    const item = (await listed(as)).budgetItems[0]!;
    await as.mutation(api.budgetItems.update, {
      ...editable(item),
      id,
      monthlyAmountCents: 999n,
      contractType: null,
      contractEndDay: null,
      noticePeriodMonths: null,
      noticePeriodDays: 28n,
      note: "  ",
      expected: seen(item),
    });
    expect((await listed(as)).budgetItems[0]).toMatchObject({
      monthlyAmountCents: 999n,
      contractType: null,
      contractEndDay: null,
      noticePeriodDays: 28n,
      noticePeriodMonths: null,
      note: null,
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).not.toHaveProperty("contractType");
    expect(row).not.toHaveProperty("note");
  });

  it("holt einen „bewusst so“ ausgeblendeten Hinweis zurück, wenn der Betrag geändert wird", async () => {
    const { as } = await freshOwner();
    const { id } = await as.mutation(api.budgetItems.create, streaming);
    await as.mutation(api.hints.setWaived, { budgetItemId: id, waived: true });
    const status = async () => (await as.query(api.views.hints, { today: TODAY })).hints[0]!.items[0]!.status;
    expect(await status()).toBe("waived");
    // `waivedHint*` gehört nicht zu den bearbeitbaren Feldern: Ausblenden löst keinen Konflikt aus.
    const item = (await listed(as)).budgetItems[0]!;
    await as.mutation(api.budgetItems.update, { ...editable(item), id, monthlyAmountCents: 1_499n, expected: seen(item) });
    expect(await status()).toBe("reopened");
  });

  it("archiviert: Budget, Demnächst und Hinweise lassen den Posten weg", async () => {
    const { as } = await seededOwner();
    const text = (value: unknown) => JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry));
    // Versicherungen sind am 15. fällig und stehen deshalb unter „Demnächst“, Fitness steht in den Hinweisen.
    expect(text(await as.query(api.views.upcoming, { today: TODAY }))).toContain("Versicherungen");
    expect(text(await as.query(api.views.hints, { today: TODAY }))).toContain("Fitness");
    const budgetBefore = await as.query(api.views.budget, { today: TODAY });

    for (const label of ["Fitness", "Versicherungen"]) {
      const item = (await listed(as)).budgetItems.find((entry) => entry.label === label)!;
      await as.mutation(api.budgetItems.setActive, { id: item.id, active: false, expected: seen(item) });
      expect((await listed(as)).budgetItems.find((entry) => entry.id === item.id)!.active).toBe(false);
    }
    const budget = await as.query(api.views.budget, { today: TODAY });
    expect(budget.necessityGroups.flatMap((group) => group.items.map((entry) => entry.label))).not.toContain("Fitness");
    expect(budget.expensesCents).toBe(budgetBefore.expensesCents - 6_000n - 10_000n);
    expect(text(await as.query(api.views.hints, { today: TODAY }))).not.toContain("Fitness");
    expect(text(await as.query(api.views.upcoming, { today: TODAY }))).not.toContain("Versicherungen");
  });

  it("meldet einen Konflikt, wenn der Betrag inzwischen anders ist", async () => {
    const { as } = await freshOwner();
    const { id } = await as.mutation(api.budgetItems.create, streaming);
    const item = (await listed(as)).budgetItems[0]!;
    await as.mutation(api.budgetItems.update, { ...editable(item), id, monthlyAmountCents: 1_499n, expected: seen(item) });
    const error = await errorOf(as.mutation(api.budgetItems.update, { ...editable(item), id, label: "Neu", expected: seen(item) }));
    expect(error.data).toMatchObject({ code: "conflict", conflicts: [{ entity: "budgetItem", id, current: { monthlyAmountCents: 1_499n, label: "Streaming C" } }] });
    // Der Fehlertext (er landet in Logs) nennt keinen Betrag; die Werte stehen nur in `data`.
    expect(error.message).toBe("conflict");
    expect(error.message).not.toContain("1499");
  });
});

// ------------------------------------------------------------------ Kredite

describe("Kredite", () => {
  const loan = {
    lender: "Bank B",
    kind: "loan" as const,
    principalCents: 1_000_000n,
    nominalRateBps: 499n,
    effectiveRateBps: 510n,
    monthlyPaymentCents: 18_871n,
    firstPaymentDay: "2026-09-01",
    paymentCount: 60n,
    finalPaymentCents: 18_850n,
    specialRepaymentYearlyCents: 100_000n,
    note: "Sondertilgung jährlich",
  };

  it("legt einen Kredit mit allen Vertragsdaten an; die Schuldenansicht rechnet den Tilgungsplan", async () => {
    const { as } = await freshOwner();
    const { id } = await as.mutation(api.debts.create, loan);
    expect((await listed(as)).debts[0]).toEqual({ id, ...loan, order: 1n, active: true, stand: null });
    const debts = await as.query(api.views.debts, { today: TODAY });
    expect(debts.debts).toHaveLength(1);
    expect(debts.debts[0]).toMatchObject({ lender: "Bank B", state: "ok", terms: { paymentCount: 60n, nominalRateBps: 499n } });
  });

  it("legt einen Ratenkauf ohne Zins und ohne freiwillige Angaben an", async () => {
    const { as } = await freshOwner();
    await as.mutation(api.debts.create, {
      lender: "Händler", kind: "installment", principalCents: 120_000n, nominalRateBps: 0n, effectiveRateBps: 0n,
      monthlyPaymentCents: 10_000n, firstPaymentDay: "2026-09-15", paymentCount: 12n,
    });
    expect((await listed(as)).debts[0]).toMatchObject({ finalPaymentCents: null, specialRepaymentYearlyCents: null, note: null });
  });

  it.each([
    ["negativer Startbetrag", { principalCents: -1n }, "principalCents"],
    ["Sollzins über 100 %", { nominalRateBps: 10_001n }, "nominalRateBps"],
    ["negativer Effektivzins", { effectiveRateBps: -1n }, "effectiveRateBps"],
    ["negative Rate", { monthlyPaymentCents: -1n }, "monthlyPaymentCents"],
    ["erste Rate ohne gültigen Tag", { firstPaymentDay: "2026-09-31" }, "firstPaymentDay"],
    ["keine Rate", { paymentCount: 0n }, "paymentCount"],
    ["mehr als 600 Raten", { paymentCount: 601n }, "paymentCount"],
    ["negative Schlussrate", { finalPaymentCents: -1n }, "finalPaymentCents"],
    ["negative Sondertilgung", { specialRepaymentYearlyCents: -1n }, "specialRepaymentYearlyCents"],
    ["leerer Kreditgeber", { lender: "" }, "lender"],
  ])("lehnt %s ab", async (_label, change, field) => {
    const { t, as } = await freshOwner();
    await expect(as.mutation(api.debts.create, { ...loan, ...change })).rejects.toMatchObject({ data: { code: "invalid_argument", field } });
    expect(await t.run((ctx) => ctx.db.query("debts").collect())).toEqual([]);
  });

  it("ändert die Vertragsdaten und archiviert; die Schuldenansicht lässt den archivierten Kredit weg", async () => {
    const { as } = await seededOwner();
    const before = await as.query(api.views.debts, { today: TODAY });
    const debt = (await listed(as)).debts.find((entry) => entry.lender === "Ratenkredit")!;
    await as.mutation(api.debts.update, { ...editable(debt), id: debt.id, note: "Umgeschuldet", expected: seen(debt) });
    const changed = (await listed(as)).debts.find((entry) => entry.id === debt.id)!;
    expect(changed.note).toBe("Umgeschuldet");

    await as.mutation(api.debts.setActive, { id: debt.id, active: false, expected: seen(changed) });
    const after = await as.query(api.views.debts, { today: TODAY });
    expect(after.debts.map((entry) => entry.lender)).not.toContain("Ratenkredit");
    expect(after.debts).toHaveLength(before.debts.length - 1);
    expect(after.monthlyRatesCents).toBe(before.monthlyRatesCents - debt.monthlyPaymentCents);
  });

  it("meldet einen Konflikt, wenn die Rate inzwischen geändert wurde", async () => {
    const { as } = await freshOwner();
    const { id } = await as.mutation(api.debts.create, loan);
    const debt = (await listed(as)).debts[0]!;
    await as.mutation(api.debts.update, { ...editable(debt), id, monthlyPaymentCents: 19_000n, expected: seen(debt) });
    await expect(as.mutation(api.debts.setActive, { id, active: false, expected: seen(debt) })).rejects.toMatchObject({
      data: { code: "conflict", conflicts: [{ entity: "debt", id, current: { monthlyPaymentCents: 19_000n, active: true } }] },
    });
  });
});

// ------------------------------------------------------------------ Haushalt

describe("Haushalt", () => {
  it("speichert nur Bezeichnung und Kalorienziel", async () => {
    const { t, as } = await freshOwner();
    const { id } = await as.mutation(api.household.create, { label: "Person A", dailyKcal: 2_200n });
    expect((await listed(as)).householdMembers).toEqual([{ id, label: "Person A", dailyKcal: 2_200n, active: true }]);
    // @ts-expect-error absichtlich falsch: Körperdaten nimmt der Server nicht an
    await expect(as.mutation(api.household.create, { label: "Person B", dailyKcal: 1_800n, weightKg: 70n })).rejects.toThrow();
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(Object.keys(row!).sort()).toEqual(["_creationTime", "_id", "active", "dailyKcal", "label", "userId"]);
  });

  it.each([
    ["0 kcal", { dailyKcal: 0n }, "dailyKcal"],
    ["über 10.000 kcal", { dailyKcal: 10_001n }, "dailyKcal"],
    ["leere Bezeichnung", { label: "" }, "label"],
  ])("lehnt %s ab", async (_label, change, field) => {
    const { as } = await freshOwner();
    await expect(as.mutation(api.household.create, { label: "Person A", dailyKcal: 2_000n, ...change })).rejects.toMatchObject({
      data: { code: "invalid_argument", field },
    });
  });

  it("ändert, archiviert und meldet Konflikte", async () => {
    const { as } = await freshOwner();
    const { id } = await as.mutation(api.household.create, { label: "Person A", dailyKcal: 2_200n });
    const member = (await listed(as)).householdMembers[0]!;
    await as.mutation(api.household.update, { id, label: "Person A", dailyKcal: 2_000n, expected: seen(member) });
    await expect(as.mutation(api.household.setActive, { id, active: false, expected: seen(member) })).rejects.toMatchObject({
      data: { code: "conflict", conflicts: [{ entity: "householdMember", id, current: { dailyKcal: 2_000n } }] },
    });
    const current = (await listed(as)).householdMembers[0]!;
    await as.mutation(api.household.setActive, { id, active: false, expected: seen(current) });
    expect((await listed(as)).householdMembers[0]!.active).toBe(false);
  });
});

// ------------------------------------------------------------- Einstellungen

describe("Einkommen, Gehaltstag und Zeitzone", () => {
  const unset = { monthlyIncomeCents: null, salaryDay: null, homeTimeZone: "Europe/Berlin" };

  it("setzt die Werte; die Übersicht rechnet dann bis zum Gehaltstag", async () => {
    const { as } = await freshOwner();
    expect((await listed(as)).settings).toEqual(unset);
    expect((await as.query(api.views.overview, { today: TODAY })).salaryStatus).toBe("missing");

    await as.mutation(api.users.updateSettings, { monthlyIncomeCents: 300_000n, salaryDay: 25n, homeTimeZone: "Europe/Vienna", expected: unset });
    expect((await listed(as)).settings).toEqual({ monthlyIncomeCents: 300_000n, salaryDay: 25n, homeTimeZone: "Europe/Vienna" });
    const overview = await as.query(api.views.overview, { today: TODAY });
    expect(overview.salaryStatus).toBe("set");
  });

  it("löscht Einkommen und Gehaltstag mit `null`", async () => {
    const { t, as } = await seededOwner();
    const settings = (await listed(as)).settings!;
    await as.mutation(api.users.updateSettings, { ...settings, monthlyIncomeCents: null, salaryDay: null, expected: settings });
    const user = await t.run(async (ctx) => (await ctx.db.query("users").first())!);
    expect(user).not.toHaveProperty("monthlyIncomeCents");
    expect(user).not.toHaveProperty("salaryDay");
  });

  it.each([
    ["Gehaltstag 0", { salaryDay: 0n }, "salaryDay"],
    ["Gehaltstag 32", { salaryDay: 32n }, "salaryDay"],
    ["negatives Einkommen", { monthlyIncomeCents: -1n }, "monthlyIncomeCents"],
    ["unbekannte Zeitzone", { homeTimeZone: "Mars/Olympus" }, "homeTimeZone"],
    ["zu lange Zeitzone", { homeTimeZone: "Europe/" + "x".repeat(64) }, "homeTimeZone"],
  ])("lehnt %s ab", async (_label, change, field) => {
    const { as } = await freshOwner();
    await expect(as.mutation(api.users.updateSettings, { ...unset, ...change, expected: unset })).rejects.toMatchObject({
      data: { code: "invalid_argument", field },
    });
    expect((await listed(as)).settings).toEqual(unset);
  });

  it("meldet einen Konflikt, wenn das Einkommen inzwischen anders ist", async () => {
    const { as } = await freshOwner();
    await as.mutation(api.users.updateSettings, { ...unset, monthlyIncomeCents: 1_000n, expected: unset });
    await expect(as.mutation(api.users.updateSettings, { ...unset, salaryDay: 1n, expected: unset })).rejects.toMatchObject({
      data: { code: "conflict", conflicts: [{ entity: "settings", id: null, current: { ...unset, monthlyIncomeCents: 1_000n } }] },
    });
  });

  it("verlangt einen angelegten Nutzer", async () => {
    await expect(asOwner(newTest()).mutation(api.users.updateSettings, { ...unset, expected: unset })).rejects.toMatchObject({
      data: { code: "user_missing" },
    });
  });
});

// ---------------------------------------------------------- Liste zum Bearbeiten

describe("records:list", () => {
  it("liefert nur eigene Datensätze, auch archivierte, nach Reihenfolge", async () => {
    const { t, as } = await seededOwner();
    const other = await foreignUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("accounts", { userId: other, name: "Fremdes Konto", kind: "bank", order: 0n, active: true });
      await ctx.db.insert("householdMembers", { userId: other, label: "Fremd", dailyKcal: 1n, active: true });
    });
    const records = await listed(as);
    expect(records.accounts.map((entry) => entry.name)).toEqual(["Alltagskonto", "Reise-Wallet", "Bargeld", "Altes Konto"]);
    expect(records.accounts.find((entry) => entry.name === "Altes Konto")!.active).toBe(false);
    expect(records.householdMembers).toEqual([]);
  });

  it("ist für einen Nutzer ohne Datensatz leer", async () => {
    expect(await listed(asOwner(newTest()))).toEqual({
      settings: null, accounts: [], pockets: [], budgetItems: [], debts: [], householdMembers: [],
    });
  });

  it("nimmt bei Ständen den jüngsten gespeicherten, auch wenn er nach heute liegt", async () => {
    const { t, as, userId } = await seededOwner();
    const accountId = (await listed(as)).accounts[0]!.id as Id<"accounts">;
    await t.run((ctx) =>
      ctx.db.insert("accountBalances", { userId, accountId, day: "2026-09-01", balanceCents: 5n, recordedAt: BigInt(RECORDED_AT) }),
    );
    expect((await listed(as)).accounts[0]!.stand).toEqual({ day: "2026-09-01", balanceCents: 5n });
  });
});
