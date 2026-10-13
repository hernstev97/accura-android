import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ALLOWED_SUBJECT_ENV } from "../convex/access";
import { TODAY, anonymousInput } from "../convex/lib/fixtures";
import { buildHints } from "../convex/lib/hints";
import { seedFinanceInput } from "../convex/lib/seed";
import { toWire } from "../convex/lib/wire";
import { asOwner, newTest, OWNER, OWNER_TOKEN, STRANGER } from "./support";

const RECORDED_AT = Date.UTC(2026, 7, 8, 10, 0);

beforeEach(() => {
  vi.stubEnv(ALLOWED_SUBJECT_ENV, OWNER.subject);
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
  const itemId = (label: string) =>
    t.run(async (ctx) => {
      const items = await ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
      return items.find((entry) => entry.label === label)!._id;
    });
  return { t, as: asOwner(t), userId, input, itemId };
}

async function foreignItem(t: ReturnType<typeof newTest>): Promise<Id<"budgetItems">> {
  return await t.run(async (ctx) => {
    const other = await ctx.db.insert("users", { clerkTokenIdentifier: "https://x|andere", homeTimeZone: "UTC", createdAt: 0n });
    return await ctx.db.insert("budgetItems", {
      userId: other, label: "Fremdes Abo", monthlyAmountCents: 999n, necessity: "optional", kind: "expense", category: "Abo", order: 1n, active: true,
    });
  });
}

const withoutIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id").map(([key, entry]) => [key, withoutIds(entry)]));
  }
  return value;
};

const fitnessIn = (model: { hints: { type: string; items: { label: string; status: string }[] }[] }) =>
  model.hints.find((h) => h.type === "subscriptions")!.items.find((i) => i.label === "Fitness")!;

describe("views:hints", () => {
  it("entspricht dem Modell des Rechenkerns für dieselben Daten", async () => {
    const { as, input } = await seededOwner();
    expect(withoutIds(await as.query(api.views.hints, { today: TODAY }))).toEqual(withoutIds(toWire(buildHints(input))));
  });

  it("liefert alle Ganzzahlen als int64 und nirgends eine Kommazahl", async () => {
    const { as } = await seededOwner();
    const check = (value: unknown, path: string) => {
      expect(typeof value, path).not.toBe("number");
      if (Array.isArray(value)) value.forEach((entry, i) => check(entry, `${path}[${i}]`));
      else if (value !== null && typeof value === "object") Object.entries(value).forEach(([k, v]) => check(v, `${path}.${k}`));
    };
    const model = await as.query(api.views.hints, { today: TODAY });
    check(model, "hints");
    expect(model.hints[0]).toMatchObject({ type: "subscriptions", monthlyCents: 10_000n, yearlyCents: 120_000n });
  });

  it("liefert für einen Nutzer ohne Daten keine Hinweise", async () => {
    expect(await asOwner(newTest()).query(api.views.hints, { today: TODAY })).toEqual({ today: TODAY, hints: [] });
  });

  it("liest keine Posten anderer Nutzer", async () => {
    const { t, as } = await seededOwner();
    await foreignItem(t);
    const model = await as.query(api.views.hints, { today: TODAY });
    expect(model.hints.flatMap((h) => h.items.map((i) => i.label))).not.toContain("Fremdes Abo");
  });

  it("lehnt ein ungültiges Datum ab", async () => {
    const { as } = await seededOwner();
    await expect(as.query(api.views.hints, { today: "2026-02-31" })).rejects.toMatchObject({ data: { code: "invalid_argument", field: "today" } });
  });
});

describe("hints:setWaived", () => {
  it("blendet aus, bis sich der Posten ändert, und blendet wieder ein", async () => {
    const { t, as, itemId } = await seededOwner();
    const fitness = await itemId("Fitness");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-08T10:30:00Z"));

    expect(await as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: true })).toEqual({ waived: true });
    const row = await t.run((ctx) => ctx.db.get(fitness));
    expect(row!.waivedHintAt).toBe(BigInt(Date.UTC(2026, 7, 8, 10, 30)));
    expect(row!.waivedHintFingerprint).toEqual(expect.any(String));
    let model = await as.query(api.views.hints, { today: TODAY });
    expect(fitnessIn(model).status).toBe("waived");
    // 60,00 € Fitness zählen nicht mehr: bleiben 40,00 € Abos.
    expect(model.hints[0]).toMatchObject({ status: "open", monthlyCents: 4_000n });

    // Der Betrag ändert sich (später über die Bearbeiten-Funktion): der Hinweis ist wieder da.
    await t.run((ctx) => ctx.db.patch(fitness, { monthlyAmountCents: 6_500n }));
    model = await as.query(api.views.hints, { today: TODAY });
    expect(fitnessIn(model).status).toBe("reopened");
    expect(model.hints[0]).toMatchObject({ monthlyCents: 10_500n, yearlyCents: 126_000n });

    // Erneut „bewusst so“ gilt für den neuen Betrag.
    await as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: true });
    expect(fitnessIn(await as.query(api.views.hints, { today: TODAY })).status).toBe("waived");

    // Wieder einblenden entfernt beides.
    expect(await as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: false })).toEqual({ waived: false });
    const cleared = await t.run((ctx) => ctx.db.get(fitness));
    expect(cleared!.waivedHintAt).toBeUndefined();
    expect(cleared!.waivedHintFingerprint).toBeUndefined();
    expect(fitnessIn(await as.query(api.views.hints, { today: TODAY })).status).toBe("open");
  });

  it("ändert sonst nichts am Posten", async () => {
    const { t, as, itemId } = await seededOwner();
    const fitness = await itemId("Fitness");
    const before = await t.run((ctx) => ctx.db.get(fitness));
    await as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: true });
    await as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: false });
    expect(await t.run((ctx) => ctx.db.get(fitness))).toEqual(before);
  });

  it("weist einen Posten eines anderen Nutzers ab und schreibt nichts", async () => {
    const { t, as } = await seededOwner();
    const foreign = await foreignItem(t);
    await expect(as.mutation(api.hints.setWaived, { budgetItemId: foreign, waived: true })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "budgetItemId" },
    });
    expect((await t.run((ctx) => ctx.db.get(foreign)))!.waivedHintFingerprint).toBeUndefined();
  });

  it("weist einen gelöschten Posten mit demselben Fehler ab", async () => {
    const { t, as, itemId } = await seededOwner();
    const gone = await itemId("Abos");
    await t.run((ctx) => ctx.db.delete(gone));
    await expect(as.mutation(api.hints.setWaived, { budgetItemId: gone, waived: true })).rejects.toMatchObject({
      data: { code: "invalid_argument", field: "budgetItemId" },
    });
  });

  it("weist ab, solange es den Nutzer noch nicht gibt", async () => {
    const t = newTest();
    const foreign = await foreignItem(t);
    await expect(asOwner(t).mutation(api.hints.setWaived, { budgetItemId: foreign, waived: true })).rejects.toMatchObject({
      data: { code: "invalid_argument" },
    });
  });

  it("ohne Anmeldung und mit fremdem Clerk-Konto: abgewiesen, nichts geschrieben", async () => {
    const { t, itemId } = await seededOwner();
    const fitness = await itemId("Fitness");
    await expect(t.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: true })).rejects.toMatchObject({
      data: { code: "unauthenticated" },
    });
    const stranger = t.withIdentity({ ...STRANGER, tokenIdentifier: `${STRANGER.issuer}|${STRANGER.subject}` });
    await expect(stranger.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: true })).rejects.toMatchObject({
      data: { code: "forbidden" },
    });
    expect((await t.run((ctx) => ctx.db.get(fitness)))!.waivedHintFingerprint).toBeUndefined();
  });

  it("prüft die Argumente", async () => {
    const { t, as, itemId, userId } = await seededOwner();
    const fitness = await itemId("Fitness");
    const debt = await t.run(async (ctx) => (await ctx.db.query("debts").withIndex("by_user", (q) => q.eq("userId", userId)).first())!._id);
    // @ts-expect-error absichtlich falsch: kein Wahrheitswert
    await expect(as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: "ja" })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: fehlt
    await expect(as.mutation(api.hints.setWaived, { budgetItemId: fitness })).rejects.toThrow();
    // @ts-expect-error absichtlich falsch: Kennung eines Kredits
    await expect(as.mutation(api.hints.setWaived, { budgetItemId: debt, waived: true })).rejects.toThrow(/budgetItems/);
    // @ts-expect-error absichtlich falsch: unbekanntes Feld
    await expect(as.mutation(api.hints.setWaived, { budgetItemId: fitness, waived: true, at: 1n })).rejects.toThrow();
  });
});
