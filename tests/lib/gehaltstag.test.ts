import { describe, expect, it } from "vitest";
import { budgetFixture, installmentAFixture } from "../../convex/lib/fixtures";
import type { FinanceInput } from "../../convex/lib/input";
import { buildUpcoming } from "../../convex/lib/views";

/**
 * Zahlungen rund um den Gehaltstag (ACC-94, Punkt 3). Die Tests halten die HEUTIGE Regel fest,
 * sie ist noch nicht von Steven bestätigt. Regel: Das Fenster „bis Gehalt“ ist [heute, Gehaltstag).
 * Eine heute fällige Zahlung zählt mit, eine am Gehaltstag selbst nicht. Am Gehaltstag gibt es
 * kein Fenster und keinen Tagesrahmen. Beispielfälle: docs/backend/rechenregeln.md.
 *
 * Alle Fälle: ein Konto mit 1.000,00 €, eine Zahlung von 100,00 € je Monat, keine Kredite.
 */

const ACCOUNT_CENTS = 100_000;
const PAYMENT_CENTS = 10_000;

const scenario = (today: string, salaryDay: number, paymentDay: number): FinanceInput => ({
  today,
  incomeCents: 300_000,
  salaryDay,
  accounts: [{ id: "a", name: "Giro", kind: "bank", order: 1, active: true, stand: { day: today, cents: ACCOUNT_CENTS, recordedDay: today } }],
  pockets: [],
  budgetItems: [
    { ...budgetFixture[0]!, id: "payment", label: "Zahlung", dueDay: paymentDay, monthlyAmountCents: PAYMENT_CENTS },
  ],
  debts: [],
});

const run = (today: string, salaryDay: number, paymentDay: number) => {
  const model = buildUpcoming(scenario(today, salaryDay, paymentDay));
  return {
    salary: model.nextSalaryDay,
    due: model.payments.map((payment) => payment.dueDay),
    pending: model.pendingPayments.value,
    available: model.availableUntilSalary.value,
    allowance: model.dailyAllowance.value,
    allowanceStatus: model.dailyAllowance.status,
  };
};

describe("Zahlung rund um den Gehaltstag (Gehaltstag 25., heute 20. August 2026)", () => {
  it("Tag davor: eine Zahlung am 24. zählt mit", () => {
    expect(run("2026-08-20", 25, 24)).toEqual({
      salary: "2026-08-25",
      due: ["2026-08-24"],
      pending: 10_000,
      available: 90_000,
      allowance: 18_000, // 900,00 € auf 5 Tage
      allowanceStatus: "ok",
    });
  });

  it("am Gehaltstag selbst: eine Zahlung am 25. zählt nicht zum Zeitraum davor", () => {
    expect(run("2026-08-20", 25, 25)).toEqual({
      salary: "2026-08-25",
      due: [],
      pending: 0,
      available: 100_000,
      allowance: 20_000, // 1.000,00 € auf 5 Tage
      allowanceStatus: "ok",
    });
  });

  it("Tag danach: eine Zahlung am 26. liegt hinter dem Gehalt und zählt nicht", () => {
    expect(run("2026-08-20", 25, 26)).toMatchObject({ due: [], pending: 0, available: 100_000 });
  });

  it("heute ist der Gehaltstag: es gibt kein Fenster, keine Zahlung und keinen Tagesrahmen", () => {
    // Auch eine Zahlung, die heute fällig ist, taucht nicht auf.
    expect(run("2026-08-25", 25, 25)).toEqual({
      salary: "2026-08-25",
      due: [],
      pending: 0,
      available: 100_000,
      allowance: null,
      allowanceStatus: "unavailable",
    });
  });

  it("Tag nach dem Gehaltstag: die Zahlung vom 25. ist vorbei, die vom nächsten Monat liegt auf dem nächsten Gehaltstag", () => {
    // Folge der Regel: Eine Zahlung genau am Gehaltstag erscheint in keinem Zeitraum.
    expect(run("2026-08-26", 25, 25)).toMatchObject({ salary: "2026-09-25", due: [], pending: 0 });
  });

  it("eine heute fällige Zahlung zählt mit, wenn heute nicht der Gehaltstag ist", () => {
    expect(run("2026-08-20", 25, 20)).toMatchObject({ due: ["2026-08-20"], pending: 10_000, available: 90_000 });
  });
});

describe("Gehaltstag im kürzeren Monat", () => {
  it("Gehaltstag 31. im Februar 2026 ist der 28.; eine Zahlung am 30. oder 31. rutscht ebenfalls auf den 28. und zählt nicht", () => {
    expect(run("2026-02-20", 31, 30)).toMatchObject({ salary: "2026-02-28", due: [], pending: 0 });
    expect(run("2026-02-20", 31, 31)).toMatchObject({ salary: "2026-02-28", due: [], pending: 0 });
  });

  it("eine Zahlung am 27. liegt einen Tag davor und zählt", () => {
    expect(run("2026-02-20", 31, 27)).toMatchObject({ salary: "2026-02-28", due: ["2026-02-27"], pending: 10_000 });
  });

  it("im Schaltjahr 2028 ist der Gehaltstag 31. der 29. Februar; eine Zahlung am 29. zählt nicht, die am 28. schon", () => {
    expect(run("2028-02-20", 31, 29)).toMatchObject({ salary: "2028-02-29", due: [] });
    expect(run("2028-02-20", 31, 28)).toMatchObject({ salary: "2028-02-29", due: ["2028-02-28"] });
  });

  it("Gehaltstag 28. im Februar 2026 und eine Zahlung am 31. (rutscht auf den 28.): gleicher Tag, zählt nicht", () => {
    expect(run("2026-02-20", 28, 31)).toMatchObject({ salary: "2026-02-28", due: [] });
    // Im März liegt die Zahlung am 31. dagegen hinter dem Gehalt vom 28. und gehört zum nächsten Zeitraum.
    expect(run("2026-03-20", 28, 31)).toMatchObject({ salary: "2026-03-28", due: [] });
  });
});

describe("Gehaltstag auf dem Wochenende", () => {
  it("die Regel kennt keine Wochenenden: Der Gehaltstag bleibt der Kalendertag", () => {
    // 29. August 2026 ist ein Samstag. Die Regel verschiebt nichts auf den Freitag davor.
    expect(new Date(Date.UTC(2026, 7, 29)).getUTCDay()).toBe(6);
    expect(run("2026-08-20", 29, 28)).toMatchObject({ salary: "2026-08-29", due: ["2026-08-28"], pending: 10_000 });
    expect(run("2026-08-20", 29, 29)).toMatchObject({ salary: "2026-08-29", due: [] });
  });
});

describe("Zahlung am Monatsende", () => {
  it("Gehaltstag 5.: die Zahlung am 31. liegt im Zeitraum bis zum 5. des Folgemonats", () => {
    expect(run("2026-08-28", 5, 31)).toMatchObject({ salary: "2026-09-05", due: ["2026-08-31"], pending: 10_000 });
  });

  it("Gehaltstag 1.: die Zahlung am 31. ist der letzte Tag davor und zählt, die am 1. nicht", () => {
    expect(run("2026-08-30", 1, 31)).toMatchObject({ salary: "2026-09-01", due: ["2026-08-31"], pending: 10_000 });
    expect(run("2026-08-30", 1, 1)).toMatchObject({ salary: "2026-09-01", due: [], pending: 0 });
  });

  it("Gehaltstag 31.: die Zahlung am 31. fällt auf den Gehaltstag und zählt nicht", () => {
    expect(run("2026-08-20", 31, 31)).toMatchObject({ salary: "2026-08-31", due: [] });
  });
});

describe("Kreditrate am Gehaltstag", () => {
  const withRate = (today: string, salaryDay: number) => {
    const input = scenario(today, salaryDay, 1);
    input.budgetItems = [];
    input.debts = [installmentAFixture]; // Raten am 15. Juli, 15. August, 15. September 2026
    return buildUpcoming(input);
  };

  it("eine Rate am Gehaltstag (15.) zählt nicht, eine am Tag davor schon", () => {
    expect(withRate("2026-09-10", 15).payments).toEqual([]);
    expect(withRate("2026-09-10", 16).payments.map((payment) => payment.dueDay)).toEqual(["2026-09-15"]);
  });
});
