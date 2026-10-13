import { describe, expect, it } from "vitest";
import { installmentAFixture, loanFixture, anonymousInput, budgetFixture, TODAY } from "../../convex/lib/fixtures";
import type { FinanceInput } from "../../convex/lib/input";
import { nextSalaryDay, isShortlyBeforeSalary } from "../../convex/lib/upcoming";
import { buildBudget, buildDebtSchedule, buildDebts, buildOverview, buildUpcoming } from "../../convex/lib/views";
import { toWire } from "../../convex/lib/wire";

const base = anonymousInput;
const withToday = (today: string, change: (input: FinanceInput) => void = () => {}): FinanceInput => {
  const input = base();
  input.today = today;
  change(input);
  return input;
};
const accountsOnly = (input: FinanceInput, cents: number, day = input.today) => {
  input.accounts = [{ id: "a", name: "Giro", kind: "bank", order: 1, active: true, stand: { day, cents, recordedDay: day } }];
  input.pockets = [];
};

describe("Vertrag mit der App: keine Kommazahlen in Antworten", () => {
  it("wandelt jedes Modell ohne Fehler in int64", () => {
    const input = base();
    input.debts[0]!.anchor = { day: "2026-07-25", balanceCents: 852_500, payoffQuoteCents: 860_000, recordedDay: "2026-07-26" };
    for (const build of [buildOverview, buildBudget, buildDebts, buildUpcoming]) {
      expect(() => toWire(build(input))).not.toThrow();
      expect(() => toWire(build(withToday("2026-02-28", (i) => (i.salaryDay = 31))))).not.toThrow();
    }
    expect(() => toWire(buildDebtSchedule(input, "primary-loan"))).not.toThrow();
  });
});

describe("Demnächst", () => {
  it("listet Zahlungen von heute bis vor dem Gehalt, chronologisch, mit Raten aus dem Tilgungsplan", () => {
    const model = buildUpcoming(base());
    expect(model.nextSalaryDay).toBe("2026-08-25");
    expect(model.daysUntilSalary).toBe(17);
    expect(model.payments.map((p) => [p.name, p.dueDay, p.cents, p.source])).toEqual([
      ["Finanzierung A", "2026-08-15", 12_000, "debt"],
      ["Versicherungen", "2026-08-15", 10_000, "budget"],
      ["Ratenkredit", "2026-08-20", 22_645, "debt"],
    ]);
    expect(model.payments.map((p) => p.isShortlyBeforeSalary)).toEqual([false, false, true]);
    expect(model.pendingPayments.value).toBe(44_645);
  });

  it("zieht die offenen Zahlungen vom Kontostand ab: bis Gehalt verfügbar und Tagesrahmen", () => {
    const model = buildUpcoming(base());
    expect(model.accountsTotal.value).toBe(135_075);
    expect(model.availableUntilSalary.value).toBe(90_430);
    expect(model.availableUntilSalary.status).toBe("ok");
    // 17 Tage; 90.430 ÷ 17 = 5.319,41 → abgerundet, damit 17 Tage nie mehr als verfügbar sind
    expect(model.dailyAllowance.value).toBe(5_319);
    expect(model.dailyAllowance.value! * 17).toBeLessThanOrEqual(90_430);
  });

  it("legt den Rechenweg offen: Kontostand, jede Zahlung, Ergebnis", () => {
    const { steps } = buildUpcoming(base()).availableUntilSalary;
    expect(steps.map((s) => [s.op, s.label, s.cents])).toEqual([
      ["start", "Auf den Konten", 135_075],
      ["minus", "Finanzierung A", 12_000],
      ["minus", "Versicherungen", 10_000],
      ["minus", "Ratenkredit", 22_645],
      ["note", "Nächstes Gehalt", null],
      ["result", "Bis Gehalt verfügbar", 90_430],
    ]);
  });

  it("zählt eine Zahlung am Gehaltstag nicht zum Zeitraum davor", () => {
    const input = base();
    input.budgetItems.push({ ...budgetFixture[0]!, id: "same-day", label: "Am Gehaltstag", dueDay: 25, order: 99 });
    expect(buildUpcoming(input).payments.some((p) => p.id === "same-day")).toBe(false);
  });

  it("zählt eine heute fällige Zahlung mit und eine von gestern nicht", () => {
    expect(buildUpcoming(withToday("2026-08-15")).payments.some((p) => p.id === "insurance")).toBe(true);
    expect(buildUpcoming(withToday("2026-08-16")).payments.some((p) => p.id === "insurance")).toBe(false);
  });

  it("zählt am Gehaltstag selbst nichts und legt keinen Tagesrahmen an", () => {
    const model = buildUpcoming(withToday("2026-08-25"));
    expect(model.nextSalaryDay).toBe("2026-08-25");
    expect(model.daysUntilSalary).toBe(0);
    expect(model.payments).toEqual([]);
    expect(model.availableUntilSalary.value).toBe(135_075);
    expect(model.dailyAllowance.status).toBe("unavailable");
  });

  it("wechselt nach dem Gehaltstag auf den nächsten Monat", () => {
    const model = buildUpcoming(withToday("2026-08-26"));
    expect(model.nextSalaryDay).toBe("2026-09-25");
    expect(model.daysUntilSalary).toBe(30);
    // Fenster 26.08. bis 24.09.: Versicherung 15.09., Wohnen 01.09., Lebensmittel 05.09., Rate A 15.09., Raten B 31.08. und 30.09. (nicht), Ratenkredit 20.09., B am 31.08.
    const names = model.payments.map((p) => `${p.dueDay} ${p.name}`);
    expect(names).toEqual([
      "2026-08-31 Finanzierung B",
      "2026-09-01 Wohnen",
      "2026-09-05 Lebensmittel",
      "2026-09-15 Finanzierung A",
      "2026-09-15 Versicherungen",
      "2026-09-20 Ratenkredit",
    ]);
  });

  it("rutscht ein Gehaltstag 31 im Februar auf den 28., im Schaltjahr auf den 29.", () => {
    expect(nextSalaryDay("2026-02-10", 31)).toBe("2026-02-28");
    expect(nextSalaryDay("2028-02-10", 31)).toBe("2028-02-29");
    expect(nextSalaryDay("2026-02-28", 31)).toBe("2026-02-28");
    expect(nextSalaryDay("2026-03-01", 31)).toBe("2026-03-31");
    expect(nextSalaryDay("2026-08-10", null)).toBeNull();
    expect(nextSalaryDay("2026-08-10", 32)).toBeNull();
  });

  it("zählt eine Fälligkeit am 31. im Februar am 28. und danach wieder am 31.", () => {
    const input = withToday("2026-02-20", (i) => {
      i.salaryDay = 5;
      i.budgetItems = [{ ...budgetFixture[0]!, id: "x", label: "Beitrag", dueDay: 31, monthlyAmountCents: 1_000 }];
      i.debts = [];
    });
    expect(buildUpcoming(input).payments.map((p) => p.dueDay)).toEqual(["2026-02-28"]);
    const march = withToday("2026-03-20", (i) => {
      i.salaryDay = 5;
      i.budgetItems = [{ ...budgetFixture[0]!, id: "x", label: "Beitrag", dueDay: 31, monthlyAmountCents: 1_000 }];
      i.debts = [];
    });
    expect(buildUpcoming(march).payments.map((p) => p.dueDay)).toEqual(["2026-03-31"]);
  });

  it("findet Zahlungen über den Jahreswechsel", () => {
    const input = withToday("2026-12-28", (i) => {
      i.salaryDay = 10;
      i.budgetItems = [{ ...budgetFixture[0]!, id: "x", label: "Neujahr", dueDay: 1, monthlyAmountCents: 1_000 }];
      i.debts = [];
    });
    const model = buildUpcoming(input);
    expect(model.nextSalaryDay).toBe("2027-01-10");
    expect(model.payments.map((p) => p.dueDay)).toEqual(["2027-01-01"]);
  });

  it("beendet Budgetposten mit Vertragsende ab dem Ende", () => {
    const run = (end: string) =>
      buildUpcoming(withToday(TODAY, (i) => {
        i.budgetItems = [{ ...budgetFixture[5]!, contractEndDay: end }];
        i.debts = [];
      })).payments.length;
    expect(run("2026-08-15")).toBe(1); // am Vertragsende wird noch gezahlt
    expect(run("2026-08-14")).toBe(0);
  });

  it("ignoriert inaktive Posten und Kredite", () => {
    const input = base();
    input.budgetItems.find((i) => i.id === "insurance")!.active = false;
    input.debts[0]!.active = false;
    expect(buildUpcoming(input).payments.map((p) => p.name)).toEqual(["Finanzierung A"]);
  });

  it("nimmt die abweichende Schlussrate in den Zahlungen", () => {
    const input = withToday("2026-09-10", (i) => {
      i.debts = [{ ...installmentAFixture, terms: { ...installmentAFixture.terms, finalPaymentCents: 12_345 } }];
    });
    expect(buildUpcoming(input).payments[0]).toMatchObject({ name: "Finanzierung A", dueDay: "2026-09-15", cents: 12_345 });
  });

  it("erkennt „kurz vor Gehalt“ nur 1 bis 7 Tage davor", () => {
    expect(isShortlyBeforeSalary("2026-08-18", "2026-08-25")).toBe(true);
    expect(isShortlyBeforeSalary("2026-08-24", "2026-08-25")).toBe(true);
    expect(isShortlyBeforeSalary("2026-08-25", "2026-08-25")).toBe(false);
    expect(isShortlyBeforeSalary("2026-08-17", "2026-08-25")).toBe(false);
    expect(isShortlyBeforeSalary("2026-02-23", "2026-03-02")).toBe(true);
    expect(isShortlyBeforeSalary("2026-02-22", "2026-03-02")).toBe(false);
  });

  it("lässt den negativen Betrag negativ", () => {
    const input = base();
    accountsOnly(input, 20_000);
    const model = buildUpcoming(input);
    expect(model.availableUntilSalary.value).toBe(20_000 - 44_645);
    expect(model.dailyAllowance.value).toBe(Math.floor((20_000 - 44_645) / 17));
    expect(model.dailyAllowance.value).toBe(-1_450); // −24.645 ÷ 17 = −1.449,7 → abgerundet −1.450
  });

  it("macht ohne Gehaltstag keine Rechnung auf und sagt, dass der Gehaltstag fehlt", () => {
    const model = buildUpcoming(withToday(TODAY, (i) => (i.salaryDay = null)));
    expect(model.salaryStatus).toBe("missing");
    expect(model.nextSalaryDay).toBeNull();
    expect(model.daysUntilSalary).toBeNull();
    expect(model.payments).toEqual([]);
    expect(model.accountsTotal.value).toBe(135_075);
    // Kein Kontostand als „sicher verfügbar“: weder Zahl noch Tagesrahmen, dafür Grund und Rechenweg-Hinweis.
    for (const metric of [model.pendingPayments, model.availableUntilSalary, model.dailyAllowance]) {
      expect(metric).toMatchObject({ status: "unavailable", value: null, reason: "Der Gehaltstag fehlt." });
      expect(metric.steps).toHaveLength(1);
      expect(metric.steps[0]).toMatchObject({ op: "note", cents: null });
      expect(metric.steps[0]!.label).toContain("Gehaltstag");
    }
  });

  it("meldet den Gehaltstag in Übersicht und Demnächst als gesetzt, wenn er da ist", () => {
    expect(buildUpcoming(base()).salaryStatus).toBe("set");
    expect(buildOverview(base()).salaryStatus).toBe("set");
    expect(buildUpcoming(base()).availableUntilSalary.steps[0]).toMatchObject({ op: "start" });
  });

  it("zeigt in der Übersicht ohne Gehaltstag keine Zahl bis Gehalt, die übrigen Kennzahlen bleiben", () => {
    const overview = buildOverview(withToday(TODAY, (i) => (i.salaryDay = null)));
    expect(overview.salaryStatus).toBe("missing");
    expect(overview.availableUntilSalary).toMatchObject({ status: "unavailable", value: null, reason: "Der Gehaltstag fehlt." });
    expect(overview.dailyAllowance).toMatchObject({ status: "unavailable", value: null });
    expect(overview.accountsTotal.value).toBe(135_075);
    expect(overview.freeMonthly.value).toBe(14_355);
  });

  it("zählt einen ungültigen Gehaltstag wie einen fehlenden", () => {
    const model = buildUpcoming(withToday(TODAY, (i) => (i.salaryDay = 32)));
    expect(model.salaryStatus).toBe("missing");
    expect(model.availableUntilSalary.value).toBeNull();
  });
});

describe("Datenalter und veraltete Stände", () => {
  it("markiert die Zahl als veraltet, wenn der älteste Stand mehr als 7 Tage alt ist", () => {
    const input = base();
    accountsOnly(input, 100_000, "2026-08-01");
    const fresh = buildUpcoming(input).accountsTotal;
    expect(fresh).toMatchObject({ status: "ok", dataAgeDays: 7, oldestDataDay: "2026-08-01" });

    const stale = buildUpcoming({ ...input, today: "2026-08-09" });
    expect(stale.accountsTotal).toMatchObject({ status: "stale", dataAgeDays: 8 });
    expect(stale.availableUntilSalary.status).toBe("stale");
    expect(stale.dailyAllowance.status).toBe("stale");
    expect(stale.availableUntilSalary.value).not.toBeNull(); // veraltet heißt: trotzdem zeigen, aber gekennzeichnet
  });

  it("nimmt für eine Summe den Stand der ältesten Quelle", () => {
    const input = base();
    input.accounts[0]!.stand = { day: "2026-08-08", cents: 120_025, recordedDay: "2026-08-08" };
    input.accounts[1]!.stand = { day: "2026-06-01", cents: 12_050, recordedDay: "2026-06-02" };
    const total = buildOverview(input).accountsTotal;
    expect(total).toMatchObject({ status: "stale", oldestDataDay: "2026-06-01", dataAgeDays: 68 });
    const overview = buildOverview(input);
    expect(overview.dataAge).toMatchObject({ oldestDay: "2026-06-01", oldestAgeDays: 68, staleCount: 1 });
    expect(overview.accounts[1]!.stand).toMatchObject({ ageDays: 68, stale: true, recordedDay: "2026-06-02" });
  });

  it("ignoriert Stände nach heute", () => {
    const input = base();
    input.accounts[0]!.stand = { day: "2026-08-09", cents: 999_999, recordedDay: "2026-08-09" };
    const total = buildOverview(input).accountsTotal;
    expect(total).toMatchObject({ status: "unavailable", value: null });
  });

  it("rechnet nicht, wenn ein aktives Konto keinen Stand hat, und sagt welches fehlt", () => {
    const input = base();
    input.accounts[2]!.stand = null;
    const total = buildOverview(input).accountsTotal;
    expect(total).toMatchObject({ status: "unavailable", value: null, reason: "Für einen Eintrag fehlt ein Stand." });
    expect(total.steps.map((s) => s.label)).toContain("Kein Stand: Bargeld");
    expect(buildUpcoming(input).availableUntilSalary.status).toBe("unavailable");
    expect(buildOverview(input).bufferMonths.status).toBe("unavailable");
    expect(buildOverview(input).netWorth.status).toBe("unavailable");
  });

  it("zählt inaktive Konten nicht und braucht von ihnen keinen Stand", () => {
    const input = base();
    expect(buildOverview(input).accountsTotal.value).toBe(135_075);
    expect(buildOverview(input).accounts.map((a) => a.id)).not.toContain("old-account");
  });

  it("sieht Pockets als zweite Sicht und addiert sie nie zu den Konten", () => {
    const overview = buildOverview(base());
    expect(overview.pocketsTotal.value).toBe(55_025);
    expect(overview.accountsTotal.value).toBe(135_075);
    expect(overview.availableUntilSalary.value).toBe(135_075 - 44_645);
  });

  it("ordnet die Altersliste nach dem ältesten zuerst", () => {
    const input = base();
    input.accounts[1]!.stand = { day: "2026-07-01", cents: 12_050, recordedDay: "2026-07-01" };
    input.debts[0]!.anchor = { day: "2026-04-01", balanceCents: 900_000, payoffQuoteCents: null, recordedDay: "2026-04-02" };
    const { items } = buildOverview(input).dataAge;
    expect(items[0]).toMatchObject({ kind: "debt", name: "Ratenkredit", ageDays: 129, stale: true });
    expect(items[1]).toMatchObject({ kind: "account", name: "Reise-Wallet", ageDays: 38, stale: true });
  });
});

describe("Leere Daten", () => {
  const empty = (): FinanceInput => ({
    today: TODAY,
    incomeCents: null,
    salaryDay: null,
    accounts: [],
    pockets: [],
    budgetItems: [],
    debts: [],
  });

  it("liefert in jeder Ansicht einen ehrlichen Leerzustand ohne erfundene Zahlen", () => {
    const overview = buildOverview(empty());
    expect(overview.isEmpty).toBe(true);
    for (const metric of [
      overview.accountsTotal,
      overview.pocketsTotal,
      overview.availableUntilSalary,
      overview.dailyAllowance,
      overview.freeMonthly,
      overview.bufferMonths,
      overview.netWorth,
    ]) {
      expect(metric.status).toBe("unavailable");
      expect(metric.value).toBeNull();
      expect(metric.reason).toBeTruthy();
    }
    expect(overview.incomeSplit).toBeNull();
    expect(overview.nextRelief).toBeNull();
    expect(overview.dataAge).toEqual({ oldestDay: null, oldestAgeDays: null, staleCount: 0, items: [] });
    expect(overview.debtRemaining).toMatchObject({ value: 0, status: "ok" });
    expect(overview.debtFreeDay).toMatchObject({ day: null, status: "ok", reason: "Keine laufenden Schulden." });

    const budget = buildBudget(empty());
    expect(budget.status).toBe("empty");
    expect(budget.utilizationBps).toBeNull();
    expect(budget.necessityGroups.map((g) => g.totalCents)).toEqual([0, 0, 0, 0, 0]);

    const debts = buildDebts(empty());
    expect(debts.debts).toEqual([]);
    expect(debts.trajectory).toEqual([{ day: TODAY, month: "2026-08", balanceCents: 0 }]);

    const upcoming = buildUpcoming(empty());
    expect(upcoming.payments).toEqual([]);
    expect(upcoming.nextSalaryDay).toBeNull();
  });

  it("ist nicht leer, sobald irgendetwas erfasst ist", () => {
    expect(buildOverview({ ...empty(), incomeCents: 100 }).isEmpty).toBe(false);
  });

  it("meldet bei nur einem Konto ohne notwendige Kosten keinen Puffer", () => {
    const input = empty();
    accountsOnly(input, 50_000);
    expect(buildOverview(input).bufferMonths).toMatchObject({ status: "unavailable", reason: "Keine notwendigen Kosten erfasst." });
  });
});

describe("Frei im Monat, Aufteilung, Puffer, Nettovermögen", () => {
  const overview = buildOverview(base());

  it("zieht Ausgaben, Raten und Rücklagen vom Einkommen ab", () => {
    // 3.000,00 − 2.150,00 Ausgaben − 300,00 Rücklage − (226,45 + 120,00 + 60,00) Raten = 143,55
    expect(overview.freeMonthly.value).toBe(14_355);
    const { steps } = overview.freeMonthly;
    expect(steps[0]).toMatchObject({ op: "start", label: "Monatseinkommen", cents: 300_000 });
    expect(steps.filter((s) => s.op === "minus")).toHaveLength(10 + 3);
    expect(steps.at(-1)).toMatchObject({ op: "result", cents: 14_355 });
    expect(steps.slice(1, -1).reduce((sum, s) => sum - (s.cents ?? 0), 300_000)).toBe(14_355);
  });

  it("teilt das Einkommen auf; die Anteile summieren sich exakt auf 100 %", () => {
    // Einzeln gerundet wären es 7.167 + 1.355 + 1.000 + 479 = 10.001. Der Rest (−1) geht an den größten Anteil.
    expect(overview.incomeSplit).toEqual({
      incomeCents: 300_000,
      parts: [
        { key: "expenses", cents: 215_000, shareBps: 7_166 },
        { key: "rates", cents: 40_645, shareBps: 1_355 },
        { key: "reserves", cents: 30_000, shareBps: 1_000 },
        { key: "free", cents: 14_355, shareBps: 479 },
      ],
    });
    const cents = overview.incomeSplit!.parts.reduce((sum, part) => sum + part.cents, 0);
    expect(cents).toBe(300_000); // in Cent geht es genau auf
    expect(overview.incomeSplit!.parts.reduce((sum, part) => sum + part.shareBps!, 0)).toBe(10_000);
  });

  it("rechnet den Puffer in Hundertstel Monaten, abgerundet, ohne Rücklagen und freiwillige Posten", () => {
    // notwendig: 1.000 + 500 + 200 + 150 + 100 + 50 = 2.000,00 plus Raten 406,45 = 2.406,45; Konten 1.350,75
    expect(overview.bufferMonths.value).toBe(56); // 0,56 Monate
    expect(overview.bufferMonths.unit).toBe("monthsX100");
  });

  it("zieht von den Konten die höchste Ablösesumme aller Schulden ab", () => {
    // 1.350,75 − (8.603,89 + 240,00 + 180,00)
    expect(overview.netWorth.value).toBe(135_075 - 902_389);
    expect(overview.netWorth.value).toBeLessThan(0);
  });

  it("zeigt die nächste Entlastung und was danach frei bleibt", () => {
    expect(overview.nextRelief).toMatchObject({
      freeFromMonth: "2026-10",
      monthlyReliefCents: 12_000,
      freeAfterCents: 14_355 + 12_000,
    });
    expect(overview.nextRelief?.events).toEqual([
      { debtId: "installment-a", lender: "Finanzierung A", lastPaymentDay: "2026-09-15", monthlyReliefCents: 12_000 },
    ]);
  });

  it("rechnet ohne Einkommen kein Frei im Monat", () => {
    const o = buildOverview(withToday(TODAY, (i) => (i.incomeCents = null)));
    expect(o.freeMonthly).toMatchObject({ status: "unavailable", reason: "Das Monatseinkommen fehlt." });
    expect(o.incomeSplit).toBeNull();
    expect(o.nextRelief?.freeAfterCents).toBeNull();
  });
});

describe("Budget", () => {
  it("fasst Posten nach Notwendigkeit und Kategorie zusammen", () => {
    const budget = buildBudget(base());
    expect(budget.necessityGroups.map((g) => [g.necessity, g.totalCents])).toEqual([
      ["essential", 160_000],
      ["necessary", 40_000],
      ["worthwhile", 30_000],
      ["optional", 10_000],
      ["unnecessary", 5_000],
    ]);
    expect(budget.necessityGroups[0]!.items.map((i) => i.label)).toEqual(["Wohnen", "Lebensmittel", "Versicherungen"]);
    expect(budget.categories[0]).toEqual({ category: "Wohnen", totalCents: 125_000, shareBps: 4_167 });
    // Abo und Versicherung haben je 100,00 €: bei Gleichstand entscheidet die Schreibweise
    expect(budget.categories.map((c) => c.category)).toEqual(["Wohnen", "Lebensmittel", "Rücklage", "Mobilität", "Abo", "Versicherung", "Freizeit"]);
    expect(budget.expensesCents).toBe(215_000);
    expect(budget.reservesCents).toBe(30_000);
    expect(budget.ratesCents).toBe(40_645);
    expect(budget.plannedCents).toBe(285_645);
    expect(budget.utilizationBps).toBe(9_522);
    expect(budget.status).toBe("within_budget");
    expect(budget.deficitCents).toBeNull();
  });

  const noDebts = (change: (i: FinanceInput) => void) => buildBudget(withToday(TODAY, (i) => { i.debts = []; change(i); }));

  it("unterscheidet leer, im Rahmen, genau aufgegangen und überplant", () => {
    expect(noDebts((i) => (i.budgetItems = []))).toMatchObject({ status: "empty", utilizationBps: 0, plannedCents: 0 });
    expect(noDebts((i) => (i.incomeCents = 259_132))).toMatchObject({ status: "within_budget", plannedCents: 245_000, utilizationBps: 9_455 });
    expect(noDebts((i) => (i.incomeCents = 245_000))).toMatchObject({ status: "within_budget", utilizationBps: 10_000 });
    expect(noDebts((i) => (i.incomeCents = 245_000)).freeMonthly.value).toBe(0);
    const over = noDebts((i) => (i.incomeCents = 100_000));
    expect(over).toMatchObject({ status: "overdrawn", deficitCents: 145_000, utilizationBps: 24_500 });
    expect(over.freeMonthly.value).toBe(-145_000);
  });

  it("erfindet keinen Anteil ohne positives Einkommen", () => {
    expect(noDebts((i) => (i.incomeCents = 0))).toMatchObject({ status: "overdrawn", utilizationBps: null });
    const negativeEmpty = noDebts((i) => {
      i.incomeCents = -12_345;
      i.budgetItems = [];
    });
    expect(negativeEmpty).toMatchObject({ status: "empty", utilizationBps: null });
    expect(negativeEmpty.freeMonthly.value).toBe(-12_345);
    expect(noDebts((i) => (i.incomeCents = null))).toMatchObject({ status: "income_missing", utilizationBps: null });
  });

  it("rechnet große Beträge ohne Rundungsfehler", () => {
    const large = noDebts((i) => {
      i.incomeCents = 9_000_000_000_000_000;
      i.budgetItems = [{ ...budgetFixture[0]!, monthlyAmountCents: 4_500_000_000_000_000 }];
    });
    expect(large.utilizationBps).toBe(5_000);
  });

  it("zählt inaktive Posten nicht", () => {
    const budget = noDebts((i) => i.budgetItems.forEach((item) => (item.active = item.id === "housing")));
    expect(budget.plannedCents).toBe(100_000);
  });
});

describe("Schulden", () => {
  const debts = buildDebts(base());

  it("fasst die Schulden zusammen", () => {
    expect(debts.remaining.value).toBe(851_870 + 24_000 + 18_000);
    expect(debts.interestToEnd.value).toBe(76_608);
    expect(debts.payoffMax.value).toBe(860_389 + 24_000 + 18_000);
    expect(debts.extraCostVsPayoff.value).toBe(970_478 - 902_389);
    expect(debts.debtFreeDay).toMatchObject({ day: "2029-12-20", status: "ok" });
    expect(debts.monthlyRatesCents).toBe(40_645);
  });

  it("rechnet pro Kredit: Restschuld, nächste Rate, Ende, Obergrenze der Ablösung", () => {
    const loan = debts.debts[0]!;
    expect(loan).toMatchObject({
      id: "primary-loan",
      state: "ok",
      nextPayment: { day: "2026-08-20", cents: 22_645 },
      lastPaymentDay: "2029-12-20",
      remainingPaymentCount: 41,
      remainingTotalCents: 928_478,
      interestToEndCents: 76_608,
      deviation: null,
      payoff: { balanceCents: 851_870, feeCapCents: 8_519, maxCents: 860_389, feeBps: 100, source: "estimated" },
    });
    expect(loan.balance).toMatchObject({ kind: "calculated", value: 851_870, status: "ok", oldestDataDay: null });
    expect(loan.balance.reason).toContain("Noch kein Bankstand");

    const b = debts.debts[2]!;
    expect(b).toMatchObject({ lender: "Finanzierung B", nextPayment: { day: "2026-08-31", cents: 6_000 }, lastPaymentDay: "2026-10-31", remainingPaymentCount: 3 });
    expect(b.payoff).toMatchObject({ feeCapCents: 0, maxCents: 18_000 });
  });

  it("gruppiert Entlastungen nach Monat und zeigt, was dann frei bleibt", () => {
    expect(debts.relief.map((r) => [r.freeFromMonth, r.monthlyReliefCents, r.freeAfterCents])).toEqual([
      ["2026-10", 12_000, 26_355],
      ["2026-11", 6_000, 32_355],
      ["2030-01", 22_645, 55_000],
    ]);
  });

  it("fasst gleiche Monate zusammen", () => {
    const input = base();
    input.debts[2]!.terms = { ...input.debts[2]!.terms, firstPaymentDay: "2026-08-15", paymentCount: 2, monthlyPaymentCents: 18_000 };
    const relief = buildDebts(input).relief[0]!;
    expect(relief).toMatchObject({ freeFromMonth: "2026-10", monthlyReliefCents: 30_000 });
    expect(relief.events.map((e) => e.lender)).toEqual(["Finanzierung A", "Finanzierung B"]);
  });

  it("lässt den Verlauf der Gesamtrestschuld monatlich fallen", () => {
    const { trajectory } = debts;
    expect(trajectory[0]).toEqual({ day: TODAY, month: "2026-08", balanceCents: 893_870 });
    expect(trajectory[1]).toMatchObject({ month: "2026-08", day: null });
    expect(trajectory[1]!.balanceCents).toBe(893_870 - 22_645 + 3_549 - 12_000 - 6_000);
    expect(trajectory.at(-1)).toEqual({ day: null, month: "2029-12", balanceCents: 0 });
    for (let i = 1; i < trajectory.length; i += 1) {
      expect(trajectory[i]!.balanceCents).toBeLessThan(trajectory[i - 1]!.balanceCents);
    }
    expect(new Set(trajectory.slice(1).map((p) => p.month)).size).toBe(trajectory.length - 1);
  });

  it("zeigt den Tilgungsplan eines Kredits mit bezahlten und offenen Raten", () => {
    const schedule = buildDebtSchedule(base(), "primary-loan")!;
    expect(schedule.rows).toHaveLength(60);
    expect(schedule.rows.filter((r) => r.state === "paid")).toHaveLength(19);
    expect(schedule.rows[19]).toMatchObject({ state: "upcoming", day: "2026-08-20" });
    expect(schedule.residualCents).toBe(0);
    expect(buildDebtSchedule(base(), "gibt-es-nicht")).toBeNull();
  });

  it("nimmt den Bankstand als Ausgangspunkt, zeigt die Abweichung und die Bank-Ablösesumme", () => {
    const input = base();
    input.debts[0]!.anchor = { day: "2026-07-25", balanceCents: 852_500, payoffQuoteCents: 861_000, recordedDay: "2026-07-26" };
    const loan = buildDebts(input).debts[0]!;
    expect(loan.deviation).toEqual({ day: "2026-07-25", bankCents: 852_500, planCents: 851_870, differenceCents: 630, ageDays: 14, stale: false });
    expect(loan.balance).toMatchObject({ kind: "actual", value: 852_500, status: "ok", oldestDataDay: "2026-07-25", dataAgeDays: 14 });
    expect(loan.interestToEndCents).toBe(76_725);
    expect(loan.payoff).toMatchObject({ source: "bank", maxCents: 861_000, feeCapCents: 8_500, balanceCents: 852_500 });
  });

  it("verwirft die Bank-Ablösesumme, sobald seither Raten bezahlt sind", () => {
    const input = withToday("2026-09-01", (i) => {
      i.debts[0]!.anchor = { day: "2026-07-25", balanceCents: 852_500, payoffQuoteCents: 861_000, recordedDay: "2026-07-26" };
    });
    const loan = buildDebts(input).debts[0]!;
    expect(loan.payoff?.source).toBe("estimated");
    expect(loan.balance.kind).toBe("calculated");
    expect(loan.balance.value).toBe(833_407);
  });

  it("markiert einen Bankstand ab 91 Tagen als alt", () => {
    const run = (today: string) => buildDebts(withToday(today, (i) => {
      i.debts = [{ ...loanFixture, anchor: { day: "2026-05-01", balanceCents: 900_000, payoffQuoteCents: null, recordedDay: "2026-05-01" } }];
    }));
    expect(run("2026-07-30").remaining.status).toBe("ok"); // 90 Tage
    expect(run("2026-07-31").remaining).toMatchObject({ status: "stale", reason: "Ein Bankstand ist älter als 90 Tage." });
  });

  it("ändert nichts am Grundplan, rechnet die Sondertilgung aber als Beispiel", () => {
    const input = base();
    input.debts[0]!.terms = { ...input.debts[0]!.terms, specialRepaymentYearlyCents: 120_000 };
    const loan = buildDebts(input).debts[0]!;
    expect(loan.interestToEndCents).toBe(76_608);
    expect(loan.specialRepaymentExample).toEqual({
      yearlyCents: 120_000,
      endDay: "2028-12-20",
      remainingInterestCents: 50_653,
      interestSavedCents: 25_955,
      paymentsSaved: 12,
    });
    expect(buildDebts(base()).debts[0]!.specialRepaymentExample).toBeNull();
  });

  it("kennzeichnet ungültige Vertragsdaten, statt falsch zu rechnen", () => {
    const input = base();
    input.debts[1]!.terms = { ...input.debts[1]!.terms, firstPaymentDay: "2026-02-31" };
    const model = buildDebts(input);
    expect(model.debts[1]).toMatchObject({ state: "invalid", nextPayment: null });
    expect(model.debts[1]!.issues.length).toBeGreaterThan(0);
    expect(model.remaining.status).toBe("unavailable");
    expect(model.debtFreeDay.status).toBe("unavailable");
    expect(buildOverview(input).netWorth.status).toBe("unavailable");
  });

  it("zählt Schulden, die laut Bank noch offen sind, obwohl der Plan abgelaufen ist", () => {
    const input = withToday("2030-02-01", (i) => {
      i.debts = [{ ...loanFixture, anchor: { day: "2030-01-10", balanceCents: 12_000, payoffQuoteCents: null, recordedDay: "2030-01-10" } }];
    });
    const model = buildDebts(input);
    expect(model.remaining.value).toBe(12_000);
    expect(model.debtFreeDay.status).toBe("unavailable");
    expect(model.monthlyRatesCents).toBe(0);
  });

  it("meldet nach dem letzten Kredit keine Schulden mehr", () => {
    const model = buildDebts(withToday("2031-01-01"));
    expect(model.remaining.value).toBe(0);
    expect(model.debtFreeDay).toMatchObject({ day: null, status: "ok" });
    expect(model.relief).toEqual([]);
  });
});
