import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { ALLOWED_SUBJECT_ENV, wrappedPublicFunctions } from "../convex/access";
import { query } from "../convex/_generated/server";
import { asOwner, modules, newTest, OWNER, OWNER_TOKEN, STRANGER, type Client } from "./support";

type Registered = { isPublic?: boolean; isInternal?: boolean; isQuery?: boolean; isMutation?: boolean; isAction?: boolean };

/** Alle registrierten Convex-Funktionen aller Module, als "modul:name". */
async function allFunctions() {
  const found: { name: string; fn: Registered }[] = [];
  for (const [path, load] of Object.entries(modules)) {
    if (path.includes("/_generated/")) continue;
    const exports = (await load()) as Record<string, unknown>;
    for (const [exportName, value] of Object.entries(exports)) {
      const fn = value as Registered;
      if (typeof value === "function" && (fn.isQuery || fn.isMutation || fn.isAction)) {
        const moduleName = path.replace("../convex/", "").replace(/\.ts$/, "");
        found.push({ name: `${moduleName}:${exportName}`, fn });
      }
    }
  }
  return found;
}

describe("jede öffentliche Funktion läuft über den gemeinsamen Wrapper", () => {
  it("findet die erwarteten Funktionen (der Test ist nicht leer)", async () => {
    const names = (await allFunctions()).filter(({ fn }) => fn.isPublic).map(({ name }) => name).sort();
    expect(names).toEqual([
      "accounts:create",
      "accounts:setActive",
      "accounts:update",
      "budgetItems:create",
      "budgetItems:setActive",
      "budgetItems:update",
      "dataExport:all",
      "debts:create",
      "debts:setActive",
      "debts:update",
      "hints:setWaived",
      "household:create",
      "household:setActive",
      "household:update",
      "pockets:create",
      "pockets:setActive",
      "pockets:update",
      "records:list",
      "stands:record",
      "users:ensureUser",
      "users:updateSettings",
      "views:budget",
      "views:debtSchedule",
      "views:debts",
      "views:hints",
      "views:overview",
      "views:upcoming",
    ]);
  });

  it("hat keine öffentliche Funktion am Wrapper vorbei", async () => {
    const unwrapped = (await allFunctions())
      .filter(({ fn }) => fn.isPublic && !wrappedPublicFunctions.has(fn))
      .map(({ name }) => name);
    expect(unwrapped).toEqual([]);
  });

  it("kennt keine öffentlichen Actions und keine öffentlichen Funktionen außer Query und Mutation", async () => {
    const odd = (await allFunctions()).filter(({ fn }) => fn.isPublic && !fn.isQuery && !fn.isMutation).map(({ name }) => name);
    expect(odd).toEqual([]);
  });

  it("hält Wartung und Import intern", async () => {
    const internal = (await allFunctions()).filter(({ fn }) => fn.isInternal).map(({ name }) => name);
    expect(internal).toContain("maintenance:seedAnonymousData");
    const publicNames = (await allFunctions()).filter(({ fn }) => fn.isPublic).map(({ name }) => name);
    expect(publicNames.filter((name) => name.startsWith("maintenance:"))).toEqual([]);
  });

  it("erkennt eine ungeschützte Funktion (Gegenprobe)", () => {
    const unprotected = query({ handler: async () => 1 }) as unknown as Registered;
    expect(unprotected.isPublic).toBe(true);
    expect(wrappedPublicFunctions.has(unprotected)).toBe(false);
  });
});

const ownerUser = (t: Client) =>
  t.run((ctx) => ctx.db.insert("users", { clerkTokenIdentifier: OWNER_TOKEN, homeTimeZone: "Europe/Berlin", createdAt: 0n }));

const account = { name: "K", kind: "bank" as const, order: 1n, active: true };
const ownerAccount = async (t: Client) => {
  const userId = await ownerUser(t);
  return await t.run((ctx) => ctx.db.insert("accounts", { userId, ...account }));
};

const pocket = async (t: Client) => {
  const accountId = await ownerAccount(t);
  const fields = { accountId, name: "P", order: 1n, active: true };
  const id = await t.run(async (ctx) => {
    const owner = (await ctx.db.get(accountId))!.userId;
    return await ctx.db.insert("pockets", { userId: owner, ...fields });
  });
  return { id, fields };
};

const budgetItem = {
  label: "X", monthlyAmountCents: 1n, necessity: "optional" as const, kind: "expense" as const, category: "Abo", dueDay: null,
  contractType: null, contractEndDay: null, noticePeriodDays: null, noticePeriodMonths: null, note: null, order: 1n, active: true,
};
const ownerBudgetItem = async (t: Client) => {
  const userId = await ownerUser(t);
  return await t.run((ctx) =>
    ctx.db.insert("budgetItems", { userId, label: "X", monthlyAmountCents: 1n, necessity: "optional", kind: "expense", category: "Abo", order: 1n, active: true }),
  );
};

const debt = {
  lender: "X", kind: "loan" as const, principalCents: 1n, nominalRateBps: 0n, effectiveRateBps: 0n, monthlyPaymentCents: 1n,
  firstPaymentDay: "2026-01-01", paymentCount: 1n, finalPaymentCents: null, specialRepaymentYearlyCents: null, note: null, order: 1n, active: true,
};
const ownerDebt = async (t: Client) => {
  const userId = await ownerUser(t);
  return await t.run((ctx) =>
    ctx.db.insert("debts", {
      userId, lender: "X", kind: "loan", principalCents: 1n, nominalRateBps: 0n, effectiveRateBps: 0n,
      monthlyPaymentCents: 1n, firstPaymentDay: "2026-01-01", paymentCount: 1n, order: 1n, active: true,
    }),
  );
};

const member = { label: "Ich", dailyKcal: 2_000n, active: true };
const ownerMember = async (t: Client) => {
  const userId = await ownerUser(t);
  return await t.run((ctx) => ctx.db.insert("householdMembers", { userId, ...member }));
};

/** Stände brauchen einen Tag, der zur Uhr passt (höchstens ein Tag Abstand zum UTC-Datum). */
const todayUtc = () => new Date().toISOString().slice(0, 10);

const { active: _accountActive, ...accountValues } = account;
const { active: _itemActive, ...budgetItemValues } = budgetItem;
const { active: _debtActive, ...debtValues } = debt;

/** Gültige Argumente je öffentlicher Funktion. Neue Funktionen müssen hier ergänzt werden. */
const calls = {
  "views:overview": (t: Client) => t.query(api.views.overview, { today: "2026-08-08" }),
  "views:budget": (t: Client) => t.query(api.views.budget, { today: "2026-08-08" }),
  "views:debts": (t: Client) => t.query(api.views.debts, { today: "2026-08-08" }),
  "views:upcoming": (t: Client) => t.query(api.views.upcoming, { today: "2026-08-08" }),
  "views:debtSchedule": async (t: Client) => {
    const debtId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { clerkTokenIdentifier: OWNER_TOKEN, homeTimeZone: "Europe/Berlin", createdAt: 0n });
      return await ctx.db.insert("debts", {
        userId, lender: "X", kind: "loan", principalCents: 1n, nominalRateBps: 0n, effectiveRateBps: 0n,
        monthlyPaymentCents: 1n, firstPaymentDay: "2026-01-01", paymentCount: 1n, order: 1n, active: true,
      });
    });
    return t.query(api.views.debtSchedule, { today: "2026-08-08", debtId });
  },
  "views:hints": (t: Client) => t.query(api.views.hints, { today: "2026-08-08" }),
  "hints:setWaived": async (t: Client) => {
    const budgetItemId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { clerkTokenIdentifier: OWNER_TOKEN, homeTimeZone: "Europe/Berlin", createdAt: 0n });
      return await ctx.db.insert("budgetItems", {
        userId, label: "X", monthlyAmountCents: 1n, necessity: "optional", kind: "expense", category: "Abo", order: 1n, active: true,
      });
    });
    return t.mutation(api.hints.setWaived, { budgetItemId, waived: true });
  },
  "users:ensureUser": (t: Client) => t.mutation(api.users.ensureUser, {}),
  "users:updateSettings": async (t: Client) => {
    await ownerUser(t);
    const expected = { monthlyIncomeCents: null, salaryDay: null, homeTimeZone: "Europe/Berlin" };
    return t.mutation(api.users.updateSettings, { ...expected, monthlyIncomeCents: 1n, salaryDay: 1n, expected });
  },
  "accounts:create": async (t: Client) => {
    await ownerUser(t);
    return t.mutation(api.accounts.create, { name: "Konto", kind: "bank" });
  },
  "accounts:update": async (t: Client) =>
    t.mutation(api.accounts.update, { id: await ownerAccount(t), ...accountValues, name: "K2", expected: account }),
  "accounts:setActive": async (t: Client) =>
    t.mutation(api.accounts.setActive, { id: await ownerAccount(t), active: false, expected: account }),
  "pockets:create": async (t: Client) => t.mutation(api.pockets.create, { accountId: await ownerAccount(t), name: "Pocket" }),
  "pockets:update": async (t: Client) => {
    const { id, fields } = await pocket(t);
    return t.mutation(api.pockets.update, { id, accountId: fields.accountId, name: "P2", order: 1n, expected: fields });
  },
  "pockets:setActive": async (t: Client) => {
    const { id, fields } = await pocket(t);
    return t.mutation(api.pockets.setActive, { id, active: false, expected: fields });
  },
  "budgetItems:create": async (t: Client) => {
    await ownerUser(t);
    return t.mutation(api.budgetItems.create, { label: "Miete", monthlyAmountCents: 1n, necessity: "essential", kind: "expense", category: "Wohnen" });
  },
  "budgetItems:update": async (t: Client) =>
    t.mutation(api.budgetItems.update, { id: await ownerBudgetItem(t), ...budgetItemValues, label: "Y", expected: budgetItem }),
  "budgetItems:setActive": async (t: Client) =>
    t.mutation(api.budgetItems.setActive, { id: await ownerBudgetItem(t), active: false, expected: budgetItem }),
  "debts:create": async (t: Client) => {
    await ownerUser(t);
    const { active: _active, ...values } = debt;
    return t.mutation(api.debts.create, values);
  },
  "debts:update": async (t: Client) => t.mutation(api.debts.update, { id: await ownerDebt(t), ...debtValues, lender: "Y", expected: debt }),
  "debts:setActive": async (t: Client) => t.mutation(api.debts.setActive, { id: await ownerDebt(t), active: false, expected: debt }),
  "household:create": async (t: Client) => {
    await ownerUser(t);
    return t.mutation(api.household.create, { label: "Ich", dailyKcal: 2_000n });
  },
  "household:update": async (t: Client) =>
    t.mutation(api.household.update, { id: await ownerMember(t), label: "Ich", dailyKcal: 2_100n, expected: member }),
  "household:setActive": async (t: Client) =>
    t.mutation(api.household.setActive, { id: await ownerMember(t), active: false, expected: member }),
  "stands:record": async (t: Client) =>
    t.mutation(api.stands.record, { day: todayUtc(), accounts: [{ id: await ownerAccount(t), balanceCents: 1n, expected: null }] }),
  "records:list": (t: Client) => t.query(api.records.list, {}),
  "dataExport:all": (t: Client) => t.query(api.dataExport.all, {}),
} as const;

describe("Zugriff: angemeldet, nicht angemeldet, falsches Konto", () => {
  beforeEach(() => {
    vi.stubEnv(ALLOWED_SUBJECT_ENV, OWNER.subject);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deckt jede öffentliche Funktion ab", async () => {
    const publicNames = (await allFunctions()).filter(({ fn }) => fn.isPublic).map(({ name }) => name).sort();
    expect(Object.keys(calls).sort()).toEqual(publicNames);
  });

  describe.each(Object.entries(calls))("%s", (_name, call) => {
    it("weist Aufrufe ohne Anmeldung ab", async () => {
      await expect(call(newTest())).rejects.toMatchObject({ data: { code: "unauthenticated" } });
    });

    it("weist ein anderes Clerk-Konto ab", async () => {
      const stranger = newTest().withIdentity({ ...STRANGER, tokenIdentifier: `${STRANGER.issuer}|${STRANGER.subject}` });
      await expect(call(stranger)).rejects.toMatchObject({ data: { code: "forbidden" } });
    });

    it("weist alles ab, wenn die erlaubte Kennung nicht konfiguriert ist", async () => {
      vi.stubEnv(ALLOWED_SUBJECT_ENV, "");
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(call(asOwner(newTest()))).rejects.toMatchObject({ data: { code: "forbidden" } });
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it("lässt den Besitzer durch", async () => {
      await expect(call(asOwner(newTest()))).resolves.not.toThrow();
    });
  });

  it("vergleicht die Kennung, nicht den Aussteller: gleicher Aussteller reicht nicht", async () => {
    const sameIssuer = newTest().withIdentity({ subject: "user_other", issuer: OWNER.issuer, tokenIdentifier: `${OWNER.issuer}|user_other` });
    await expect(sameIssuer.query(api.views.overview, { today: "2026-08-08" })).rejects.toMatchObject({ data: { code: "forbidden" } });
  });

  it("liest und schreibt vor der Prüfung nichts: ein Fremder legt keinen Nutzer an", async () => {
    const t = newTest();
    const stranger = t.withIdentity({ ...STRANGER, tokenIdentifier: `${STRANGER.issuer}|${STRANGER.subject}` });
    await expect(stranger.mutation(api.users.ensureUser, {})).rejects.toBeDefined();
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
  });

  it("nennt in Fehlern keine Kennung und keine Daten", async () => {
    const stranger = newTest().withIdentity({ ...STRANGER, tokenIdentifier: `${STRANGER.issuer}|${STRANGER.subject}` });
    const error = await stranger.query(api.views.overview, { today: "2026-08-08" }).catch((e: unknown) => e);
    expect(JSON.stringify(error)).not.toContain(STRANGER.subject);
    expect(JSON.stringify(error)).not.toContain(OWNER.subject);
  });
});
