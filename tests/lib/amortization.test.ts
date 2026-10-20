import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  payoffUpperBound,
  planDebt,
  validateTerms,
  type LoanTerms,
} from "../../convex/lib/amortization";
import { loanFixture } from "../../convex/lib/fixtures";

const terms = (overrides: Partial<LoanTerms> = {}): LoanTerms => ({
  principalCents: 100_000,
  nominalRateBps: 1_200,
  monthlyPaymentCents: 34_002,
  firstPaymentDay: "2026-01-15",
  paymentCount: 3,
  finalPaymentCents: null,
  specialRepaymentYearlyCents: null,
  ...overrides,
});

describe("Tilgungsplan, von Hand nachrechenbar", () => {
  // 1.000 €, 12 % im Jahr = 1 % im Monat, drei Raten à 340,02 €.
  it("rechnet Zins und Tilgung je Rate und löst mit der letzten Rate den Rest ab", () => {
    const schedule = buildSchedule(terms());
    expect(schedule.rows.map((row) => [row.day, row.paymentCents, row.interestCents, row.balanceAfterCents])).toEqual([
      ["2026-01-15", 34_002, 1_000, 66_998], // 1.000,00 € × 1 % = 10,00 €
      ["2026-02-15", 34_002, 670, 33_666], // 669,98 € → 6,70 €
      ["2026-03-15", 34_003, 337, 0], // 336,66 € → 3,37 €; letzte Rate 340,03 €
    ]);
    expect(schedule.totalInterestCents).toBe(2_007);
    expect(schedule.totalPaidCents).toBe(102_007);
    expect(schedule.residualCents).toBe(0);
    expect(schedule.warnings).toEqual([]);
  });

  it("teilt jede Rate in Zins und Tilgung, die Tilgungen ergeben den Startbetrag", () => {
    const schedule = buildSchedule(terms());
    expect(schedule.rows.map((row) => row.principalCents)).toEqual([33_002, 33_332, 33_666]);
    expect(schedule.rows.reduce((sum, row) => sum + row.principalCents, 0)).toBe(100_000);
  });

  it("rechnet ohne Zins (Ratenkauf) glatt", () => {
    const schedule = buildSchedule(terms({ principalCents: 36_000, nominalRateBps: 0, monthlyPaymentCents: 12_000 }));
    expect(schedule.rows.map((row) => row.balanceAfterCents)).toEqual([24_000, 12_000, 0]);
    expect(schedule.totalInterestCents).toBe(0);
  });

  it("nimmt eine abweichende Schlussrate aus dem Vertrag", () => {
    const schedule = buildSchedule(terms({ finalPaymentCents: 34_003 }));
    expect(schedule.rows.at(-1)?.paymentCents).toBe(34_003);
    expect(schedule.residualCents).toBe(0);
    expect(schedule.warnings).toEqual([]);
  });

  it("meldet einen Rest, wenn die Schlussrate laut Vertrag nicht aufgeht", () => {
    const schedule = buildSchedule(terms({ finalPaymentCents: 30_000 }));
    expect(schedule.residualCents).toBe(4_003);
    expect(schedule.warnings).toContain("unexpected_residual");

    const overpaid = buildSchedule(terms({ finalPaymentCents: 40_000 }));
    expect(overpaid.residualCents).toBe(-5_997);
    expect(overpaid.warnings).toContain("unexpected_residual");
  });

  it("warnt, wenn die Rate den Zins nicht deckt", () => {
    const schedule = buildSchedule(terms({ monthlyPaymentCents: 500 }));
    expect(schedule.warnings).toContain("payment_below_interest");
    expect(schedule.rows[0]?.balanceAfterCents).toBe(100_500); // die Schuld wächst, wird nicht schöngerechnet
  });

  it("warnt, wenn die abgeleitete letzte Rate weit von der Monatsrate entfernt ist", () => {
    const schedule = buildSchedule(terms({ monthlyPaymentCents: 10_000 }));
    expect(schedule.warnings).toContain("final_payment_far_from_rate");
    expect(schedule.rows.at(-1)?.balanceAfterCents).toBe(0);
  });

  it("endet früher, wenn die Schuld vor der letzten Rate getilgt ist", () => {
    const schedule = buildSchedule(terms({ principalCents: 50_000, monthlyPaymentCents: 34_002, paymentCount: 6 }));
    expect(schedule.rows).toHaveLength(2);
    expect(schedule.rows.at(-1)?.balanceAfterCents).toBe(0);
    expect(schedule.rows.at(-1)?.paymentCents).toBeLessThan(34_002);
    expect(schedule.residualCents).toBe(0);
  });

  it("verträgt einen Startbetrag von 0", () => {
    const schedule = buildSchedule(terms({ principalCents: 0 }));
    expect(schedule.rows).toEqual([]);
    expect(schedule.residualCents).toBe(0);
  });

  it("rundet Zinsen auf ganze Cent von null weg, ohne dass Cents verloren gehen", () => {
    // 1,00 € Restschuld bei 6 % → 0,005 € Monatszins → genau eine halbe Cent
    const half = buildSchedule(terms({ principalCents: 100, nominalRateBps: 600, monthlyPaymentCents: 50, paymentCount: 2 }));
    expect(half.rows[0]?.interestCents).toBe(1);
    const sum = half.rows.reduce((acc, row) => acc + row.paymentCents, 0);
    expect(sum).toBe(100 + half.totalInterestCents);
  });
});

describe("Fälligkeitstage der Raten", () => {
  it("hält den Tag des Monats und rutscht in kurzen Monaten auf den letzten Tag", () => {
    const schedule = buildSchedule(
      terms({ principalCents: 40_000, nominalRateBps: 0, monthlyPaymentCents: 10_000, firstPaymentDay: "2026-01-31", paymentCount: 4 }),
    );
    expect(schedule.rows.map((row) => row.day)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("kennt den 29. Februar im Schaltjahr und den Jahreswechsel", () => {
    const leap = buildSchedule(
      terms({ principalCents: 30_000, nominalRateBps: 0, monthlyPaymentCents: 10_000, firstPaymentDay: "2028-01-31", paymentCount: 3 }),
    );
    expect(leap.rows.map((row) => row.day)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);

    const year = buildSchedule(
      terms({ principalCents: 30_000, nominalRateBps: 0, monthlyPaymentCents: 10_000, firstPaymentDay: "2026-11-30", paymentCount: 3 }),
    );
    expect(year.rows.map((row) => row.day)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30"]);
  });
});

describe("Kredit aus den Testdaten (12.000 € zu 5 %, 60 Raten)", () => {
  // Gegengerechnet mit einer unabhängigen Python-Rechnung derselben Regeln.
  const schedule = buildSchedule(loanFixture.terms);

  it("hat 60 Raten, die letzte löst den Rest ab", () => {
    expect(schedule.rows).toHaveLength(60);
    expect(schedule.rows[0]).toMatchObject({ day: "2025-01-20", paymentCents: 22_645, interestCents: 5_000, balanceAfterCents: 1_182_355 });
    expect(schedule.rows[18]).toMatchObject({ day: "2026-07-20", interestCents: 3_629, balanceAfterCents: 851_870 });
    expect(schedule.rows[59]).toMatchObject({ day: "2029-12-20", paymentCents: 22_678, interestCents: 94, balanceAfterCents: 0 });
    expect(schedule.totalInterestCents).toBe(158_733);
    expect(schedule.totalPaidCents).toBe(1_358_733);
    expect(schedule.warnings).toEqual([]);
  });

  it("zahlt insgesamt Startbetrag plus Zinsen", () => {
    expect(schedule.totalPaidCents).toBe(loanFixture.terms.principalCents + schedule.totalInterestCents);
  });
});

describe("Sondertilgung als Beispielrechnung", () => {
  it("verkürzt die Laufzeit und spart Zinsen, wenn jedes Jahr die erlaubte Summe gezahlt wird", () => {
    const base = planDebt(loanFixture.terms, null, "2026-08-08");
    const first = base.upcomingRows[0]!;
    const example = buildSchedule(loanFixture.terms, {
      startAfterIndex: first.index - 1,
      startBalanceCents: base.balanceTodayCents,
      specialRepaymentYearlyCents: 120_000,
    });
    expect(example.rows).toHaveLength(29);
    expect(example.rows.at(-1)).toMatchObject({ index: 48, day: "2028-12-20", specialCents: 5_818, balanceAfterCents: 0 });
    expect(example.totalInterestCents).toBe(50_653);
    expect(base.remainingInterestCents - example.totalInterestCents).toBe(25_955);
  });

  it("ändert den Grundplan nicht", () => {
    expect(buildSchedule({ ...loanFixture.terms, specialRepaymentYearlyCents: 120_000 }).totalInterestCents).toBe(158_733);
  });

  it("begrenzt die Sondertilgung auf die Restschuld", () => {
    const schedule = buildSchedule(
      terms({ principalCents: 60_000, nominalRateBps: 0, monthlyPaymentCents: 1_000, paymentCount: 24 }),
      { specialRepaymentYearlyCents: 1_000_000 },
    );
    expect(schedule.rows.at(-1)?.index).toBe(12);
    expect(schedule.rows.at(-1)?.balanceAfterCents).toBe(0);
    expect(schedule.rows.at(-1)?.specialCents).toBe(60_000 - 12 * 1_000);
  });
});

describe("Plan heute und Abweichung vom Bankstand", () => {
  it("zählt Raten vor heute als bezahlt und die Rate am heutigen Tag als offen", () => {
    const plan = planDebt(loanFixture.terms, null, "2026-08-08");
    expect(plan.balanceTodayCents).toBe(851_870);
    expect(plan.upcomingRows).toHaveLength(41);
    expect(plan.upcomingRows[0]?.day).toBe("2026-08-20");
    expect(plan.remainingInterestCents).toBe(76_608);
    expect(plan.remainingPaymentsTotalCents).toBe(928_478);
    expect(plan.lastPaymentDay).toBe("2029-12-20");
    expect(plan.anchor).toBeNull();

    const onDueDay = planDebt(loanFixture.terms, null, "2026-08-20");
    expect(onDueDay.upcomingRows[0]?.day).toBe("2026-08-20");
    expect(onDueDay.balanceTodayCents).toBe(851_870);
    const dayAfter = planDebt(loanFixture.terms, null, "2026-08-21");
    expect(dayAfter.upcomingRows[0]?.day).toBe("2026-09-20");
    expect(dayAfter.balanceTodayCents).toBe(832_774);
  });

  it("zeigt vor der ersten Rate den Startbetrag und nach der letzten null", () => {
    expect(planDebt(loanFixture.terms, null, "2024-12-31").balanceTodayCents).toBe(1_200_000);
    expect(planDebt(loanFixture.terms, null, "2024-12-31").upcomingRows).toHaveLength(60);
    const done = planDebt(loanFixture.terms, null, "2030-01-01");
    expect(done.balanceTodayCents).toBe(0);
    expect(done.upcomingRows).toEqual([]);
    expect(done.lastPaymentDay).toBeNull();
  });

  it("macht den eingetragenen Bankstand zum neuen Ausgangspunkt und zeigt die Abweichung", () => {
    // Die Bank nennt nach der Rate vom 20.07.2026 852.500 € statt 851.870 € nach Plan.
    const plan = planDebt(loanFixture.terms, { day: "2026-07-25", balanceCents: 852_500, payoffQuoteCents: null }, "2026-08-08");
    expect(plan.anchor).toEqual({ day: "2026-07-25", bankCents: 852_500, planCents: 851_870, differenceCents: 630 });
    expect(plan.balanceTodayCents).toBe(852_500);
    expect(plan.appliedSinceAnchorCount).toBe(0);
    expect(plan.upcomingRows).toHaveLength(41);
    expect(plan.upcomingRows[0]).toMatchObject({ index: 20, day: "2026-08-20", interestCents: 3_552, balanceAfterCents: 833_407 });
    expect(plan.upcomingRows.at(-1)).toMatchObject({ index: 60, paymentCents: 23_425, balanceAfterCents: 0 });
    expect(plan.remainingInterestCents).toBe(76_725);
  });

  it("rechnet nach dem Bankstand weiter, wenn seither Raten fällig waren", () => {
    const plan = planDebt(loanFixture.terms, { day: "2026-07-25", balanceCents: 852_500, payoffQuoteCents: null }, "2026-09-01");
    expect(plan.appliedSinceAnchorCount).toBe(1);
    expect(plan.balanceTodayCents).toBe(833_407);
  });

  it("zeigt negative Abweichung, wenn die Bank weniger Schuld nennt", () => {
    const plan = planDebt(loanFixture.terms, { day: "2026-07-25", balanceCents: 850_000, payoffQuoteCents: null }, "2026-08-08");
    expect(plan.anchor?.differenceCents).toBe(-1_870);
  });

  it("nimmt bei einem Bankstand vor der ersten Rate den Startbetrag als Plan", () => {
    const plan = planDebt(loanFixture.terms, { day: "2024-12-01", balanceCents: 1_200_000, payoffQuoteCents: null }, "2024-12-15");
    expect(plan.anchor).toMatchObject({ planCents: 1_200_000, differenceCents: 0 });
    expect(plan.upcomingRows).toHaveLength(60);
  });

  it("lässt eine Restschuld laut Bank stehen, obwohl der Plan abgelaufen ist", () => {
    const plan = planDebt(loanFixture.terms, { day: "2030-01-10", balanceCents: 12_000, payoffQuoteCents: null }, "2030-02-01");
    expect(plan.anchor).toMatchObject({ planCents: 0, differenceCents: 12_000 });
    expect(plan.upcomingRows).toEqual([]);
    expect(plan.balanceTodayCents).toBe(12_000);
  });
});

describe("Ablösesumme: Obergrenze der Entschädigung", () => {
  it("rechnet 1 % bei mehr als 12 Monaten Restlaufzeit", () => {
    expect(payoffUpperBound(851_870, 41, 76_608)).toMatchObject({ feeBps: 100, feeCapCents: 8_519, maxCents: 860_389, cappedByRemainingInterest: false });
  });

  it("rechnet 0,5 % bei höchstens 12 verbleibenden Raten, 13 Raten sind noch 1 %", () => {
    expect(payoffUpperBound(100_000, 12, 50_000)).toMatchObject({ feeBps: 50, feeCapCents: 500 });
    expect(payoffUpperBound(100_000, 13, 50_000)).toMatchObject({ feeBps: 100, feeCapCents: 1_000 });
  });

  it("deckelt auf die Zinsen bis zum planmäßigen Ende", () => {
    expect(payoffUpperBound(100_000, 20, 300)).toMatchObject({ feeCapCents: 300, maxCents: 100_300, cappedByRemainingInterest: true });
  });

  it("verlangt bei zinslosen Krediten keine Entschädigung", () => {
    expect(payoffUpperBound(24_000, 2, 0)).toMatchObject({ feeCapCents: 0, maxCents: 24_000 });
  });

  it("verlangt nichts, wenn nichts offen ist", () => {
    expect(payoffUpperBound(0, 0, 0)).toMatchObject({ feeCapCents: 0, maxCents: 0 });
  });
});

describe("Vertragsdaten prüfen", () => {
  it("akzeptiert gültige Daten", () => {
    expect(validateTerms(loanFixture.terms)).toEqual([]);
  });

  it("meldet jedes Problem", () => {
    expect(validateTerms(terms({ principalCents: -1 }))).toHaveLength(1);
    expect(validateTerms(terms({ principalCents: 1.5 }))).toHaveLength(1);
    expect(validateTerms(terms({ nominalRateBps: 10_001 }))).toHaveLength(1);
    expect(validateTerms(terms({ monthlyPaymentCents: -5 }))).toHaveLength(1);
    expect(validateTerms(terms({ firstPaymentDay: "2026-02-31" }))).toHaveLength(1);
    expect(validateTerms(terms({ paymentCount: 0 }))).toHaveLength(1);
    expect(validateTerms(terms({ paymentCount: 601 }))).toHaveLength(1);
    expect(validateTerms(terms({ finalPaymentCents: -1 }))).toHaveLength(1);
    expect(validateTerms(terms({ specialRepaymentYearlyCents: -1 }))).toHaveLength(1);
  });
});
