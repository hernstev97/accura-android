import { diffDays, type CalendarDay } from "./calendar";
import { aggregateDebts, deriveDebts, type DebtAggregates, type DebtState } from "./debts";
import { BALANCE_STALE_AFTER_DAYS, ageInDays, isStale } from "./freshness";
import { sortByOrder, type AccountInput, type FinanceInput, type PocketInput, type Stand } from "./input";
import { budgetTotals, type BudgetTotals } from "./budget";
import { metric, olderDay, steps, unavailable, type Metric, type Step } from "./metric";
import { floorDiv, floorMulDiv, sumCents } from "./money";
import { nextSalaryDay, upcomingPayments, type UpcomingPayment } from "./upcoming";

/** Ein Stand gilt nur, wenn sein Tag nicht nach heute liegt. */
export function usableStand(stand: Stand | null, today: CalendarDay): Stand | null {
  return stand !== null && stand.day <= today ? stand : null;
}

export type StandView = {
  day: CalendarDay;
  cents: number;
  recordedDay: CalendarDay | null;
  ageDays: number;
  stale: boolean;
};

export function standView(stand: Stand | null, today: CalendarDay): StandView | null {
  const usable = usableStand(stand, today);
  if (!usable) return null;
  return {
    day: usable.day,
    cents: usable.cents,
    recordedDay: usable.recordedDay,
    ageDays: ageInDays(usable.day, today),
    stale: isStale(usable.day, today, BALANCE_STALE_AFTER_DAYS),
  };
}

function standSum(
  key: string,
  entries: readonly { name: string; stand: Stand | null }[],
  emptyReason: string,
  today: CalendarDay,
  resultLabel: string,
): Metric {
  const base = { key, unit: "cents", kind: "actual" } as const;
  if (entries.length === 0) return unavailable(base, emptyReason, today);

  const known = entries.flatMap((entry) => {
    const stand = usableStand(entry.stand, today);
    return stand ? [{ name: entry.name, stand }] : [];
  });
  const missing = entries.filter((entry) => usableStand(entry.stand, today) === null);
  const oldest = known.reduce<CalendarDay | null>((day, entry) => olderDay(day, entry.stand.day), null);
  const listed: Step[] = known.map((entry) =>
    steps.plus(entry.name, { cents: entry.stand.cents, day: entry.stand.day }),
  );

  if (missing.length > 0) {
    return unavailable(
      { ...base, steps: [...listed, ...missing.map((entry) => steps.note(`Kein Stand: ${entry.name}`))] },
      missing.length === 1 ? "Für einen Eintrag fehlt ein Stand." : `Für ${missing.length} Einträge fehlt ein Stand.`,
      today,
    );
  }

  const total = sumCents(known.map((entry) => entry.stand.cents));
  const stale = oldest !== null && isStale(oldest, today, BALANCE_STALE_AFTER_DAYS);
  return metric(
    {
      ...base,
      value: total,
      status: stale ? "stale" : "ok",
      reason: stale ? `Der älteste Stand ist mehr als ${BALANCE_STALE_AFTER_DAYS} Tage alt.` : null,
      oldestDataDay: oldest,
      steps: [...listed, steps.result(resultLabel, { cents: total })],
    },
    today,
  );
}

export type Derived = {
  today: CalendarDay;
  accounts: AccountInput[];
  pockets: PocketInput[];
  budget: BudgetTotals;
  debts: DebtState[];
  debtAggregates: DebtAggregates;
  nextSalary: CalendarDay | null;
  daysUntilSalary: number | null;
  payments: UpcomingPayment[];
  pendingCents: number;
  metrics: {
    accountsTotal: Metric;
    pocketsTotal: Metric;
    pendingPayments: Metric;
    availableUntilSalary: Metric;
    dailyAllowance: Metric;
    freeMonthly: Metric;
    bufferMonths: Metric;
    netWorth: Metric;
  };
  /** Ausgaben, Raten, Rücklagen und frei als Anteil am Einkommen; `null` ohne Einkommen. */
  split: { expensesCents: number; ratesCents: number; reservesCents: number; freeCents: number } | null;
};

export function derive(input: FinanceInput): Derived {
  const { today } = input;
  const accounts = sortByOrder(input.accounts.filter((account) => account.active));
  const pockets = sortByOrder(input.pockets.filter((pocket) => pocket.active));
  const budget = budgetTotals(input.budgetItems);
  const debts = deriveDebts(input.debts, today);
  const debtAggregates = aggregateDebts(debts, today);

  const accountsTotal = standSum("accountsTotal", accounts, "Noch kein Konto erfasst.", today, "Auf den Konten");
  const pocketsTotal = standSum("pocketsTotal", pockets, "Noch kein Pocket erfasst.", today, "In den Pockets");

  const nextSalary = nextSalaryDay(today, input.salaryDay);
  const daysUntilSalary = nextSalary === null ? null : diffDays(today, nextSalary);
  const payments = upcomingPayments(today, nextSalary, budget.items, debts);
  const pendingCents = sumCents(payments.map((payment) => payment.cents));

  const pendingPayments =
    nextSalary === null
      ? unavailable({ key: "pendingPayments", unit: "cents", kind: "planned" }, "Der Gehaltstag fehlt.", today)
      : metric(
          {
            key: "pendingPayments",
            unit: "cents",
            kind: "planned",
            value: pendingCents,
            status: "ok",
            steps: [
              ...payments.map((payment) => steps.plus(payment.name, { cents: payment.cents, day: payment.dueDay })),
              steps.result("Fällig bis zum Gehalt", { cents: pendingCents }),
            ],
          },
          today,
        );

  const availableUntilSalary = (() => {
    const base = { key: "availableUntilSalary", unit: "cents", kind: "calculated" } as const;
    if (nextSalary === null) return unavailable(base, "Der Gehaltstag fehlt.", today);
    if (accountsTotal.value === null) return unavailable(base, accountsTotal.reason ?? "Kontostände fehlen.", today);
    const value = accountsTotal.value - pendingCents;
    return metric(
      {
        ...base,
        value,
        status: accountsTotal.status === "stale" ? "stale" : "ok",
        reason: accountsTotal.status === "stale" ? "Die Kontostände sind nicht mehr frisch." : null,
        oldestDataDay: accountsTotal.oldestDataDay,
        steps: [
          steps.start("Auf den Konten", { cents: accountsTotal.value }),
          ...payments.map((payment) => steps.minus(payment.name, { cents: payment.cents, day: payment.dueDay })),
          steps.note("Nächstes Gehalt", { day: nextSalary }),
          steps.result("Bis Gehalt verfügbar", { cents: value }),
        ],
      },
      today,
    );
  })();

  const dailyAllowance = (() => {
    const base = { key: "dailyAllowance", unit: "cents", kind: "calculated" } as const;
    if (availableUntilSalary.value === null) {
      return unavailable(base, availableUntilSalary.reason ?? "Nicht berechenbar.", today);
    }
    if (daysUntilSalary === null || daysUntilSalary < 1) {
      return unavailable(base, "Das Gehalt kommt heute, es bleibt kein Zeitraum zu verteilen.", today);
    }
    // Abgerundet, damit Tage × Tagesrahmen den verfügbaren Betrag nie übersteigen.
    const value = floorDiv(availableUntilSalary.value, daysUntilSalary);
    return metric(
      {
        ...base,
        value,
        status: availableUntilSalary.status,
        reason: availableUntilSalary.reason,
        oldestDataDay: availableUntilSalary.oldestDataDay,
        steps: [
          steps.start("Bis Gehalt verfügbar", { cents: availableUntilSalary.value }),
          steps.note("Tage bis zum Gehalt", { count: daysUntilSalary }),
          steps.result("Pro Tag, abgerundet", { cents: value }),
        ],
      },
      today,
    );
  })();

  const ratesCents = debtAggregates.monthlyRatesCents;
  const freeMonthly = (() => {
    const base = { key: "freeMonthly", unit: "cents", kind: "planned" } as const;
    if (input.incomeCents === null) return unavailable(base, "Das Monatseinkommen fehlt.", today);
    const value = input.incomeCents - budget.plannedCents - ratesCents;
    return metric(
      {
        ...base,
        value,
        status: "ok",
        steps: [
          steps.start("Monatseinkommen", { cents: input.incomeCents }),
          ...budget.expenseItems.map((item) => steps.minus(item.label, { cents: item.monthlyAmountCents })),
          ...debtAggregates.runningDebts.map((debt) =>
            steps.minus(`Rate ${debt.input.lender}`, { cents: debt.input.terms.monthlyPaymentCents }),
          ),
          ...budget.reserveItems.map((item) => steps.minus(`Rücklage ${item.label}`, { cents: item.monthlyAmountCents })),
          steps.result("Frei im Monat", { cents: value }),
        ],
      },
      today,
    );
  })();

  const split =
    input.incomeCents === null
      ? null
      : {
          expensesCents: budget.expensesCents,
          ratesCents,
          reservesCents: budget.reservesCents,
          freeCents: freeMonthly.value ?? 0,
        };

  const necessaryItems = budget.expenseItems.filter((item) => item.necessity === "essential" || item.necessity === "necessary");
  const necessaryCents = sumCents(necessaryItems.map((item) => item.monthlyAmountCents)) + ratesCents;
  const bufferMonths = (() => {
    const base = { key: "bufferMonths", unit: "monthsX100", kind: "calculated" } as const;
    if (accountsTotal.value === null) return unavailable(base, accountsTotal.reason ?? "Kontostände fehlen.", today);
    if (necessaryCents <= 0) return unavailable(base, "Keine notwendigen Kosten erfasst.", today);
    const value = floorMulDiv(accountsTotal.value, 100, necessaryCents);
    return metric(
      {
        ...base,
        value,
        status: accountsTotal.status === "stale" ? "stale" : "ok",
        reason: accountsTotal.status === "stale" ? "Die Kontostände sind nicht mehr frisch." : null,
        oldestDataDay: accountsTotal.oldestDataDay,
        steps: [
          steps.start("Auf den Konten", { cents: accountsTotal.value }),
          ...necessaryItems.map((item) => steps.note(item.label, { cents: item.monthlyAmountCents })),
          ...debtAggregates.runningDebts.map((debt) =>
            steps.note(`Rate ${debt.input.lender}`, { cents: debt.input.terms.monthlyPaymentCents }),
          ),
          steps.note("Notwendige Kosten pro Monat", { cents: necessaryCents }),
          steps.result("Monate (mal 100), abgerundet", { count: value }),
        ],
      },
      today,
    );
  })();

  const netWorth = (() => {
    const base = { key: "netWorth", unit: "cents", kind: "calculated" } as const;
    if (accountsTotal.value === null) return unavailable(base, accountsTotal.reason ?? "Kontostände fehlen.", today);
    if (debtAggregates.payoffMax.value === null) {
      return unavailable(base, debtAggregates.payoffMax.reason ?? "Schulden nicht berechenbar.", today);
    }
    const value = accountsTotal.value - debtAggregates.payoffMax.value;
    const stale = accountsTotal.status === "stale" || debtAggregates.payoffMax.status === "stale";
    return metric(
      {
        ...base,
        value,
        status: stale ? "stale" : "ok",
        reason: stale ? "Ein Stand hinter der Zahl ist nicht mehr frisch." : null,
        oldestDataDay: olderDay(accountsTotal.oldestDataDay, debtAggregates.payoffMax.oldestDataDay),
        steps: [
          steps.start("Auf den Konten", { cents: accountsTotal.value }),
          steps.minus("Ablösesumme höchstens", { cents: debtAggregates.payoffMax.value }),
          steps.result("Nettovermögen", { cents: value }),
        ],
      },
      today,
    );
  })();

  return {
    today,
    accounts,
    pockets,
    budget,
    debts,
    debtAggregates,
    nextSalary,
    daysUntilSalary,
    payments,
    pendingCents,
    metrics: {
      accountsTotal,
      pocketsTotal,
      pendingPayments,
      availableUntilSalary,
      dailyAllowance,
      freeMonthly,
      bufferMonths,
      netWorth,
    },
    split,
  };
}
