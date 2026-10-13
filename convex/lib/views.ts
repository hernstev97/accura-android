import type { DebtPlan, ScheduleRow, ScheduleWarning } from "./amortization";
import type { CalendarDay } from "./calendar";
import { derive, standView, type Derived, type SalaryStatus, type StandView } from "./derive";
import type { DebtState, SpecialRepaymentExample } from "./debts";
import { DEBT_ANCHOR_STALE_AFTER_DAYS, ageInDays, isStale } from "./freshness";
import type { AccountKind, DebtKind, FinanceInput, Necessity } from "./input";
import { metric, steps, unavailable, type Metric } from "./metric";
import { ratioBps, splitBps } from "./money";
import type { UpcomingPayment } from "./upcoming";

/**
 * Fertige Modelle je Ansicht. Reine Funktionen auf `FinanceInput`; die
 * Convex-Abfragen laden nur Daten, übergeben sie hierher und wandeln das
 * Ergebnis mit `toWire` für den Client.
 */

// ---------------------------------------------------------------- Übersicht

export type DataAgeItem = {
  kind: "account" | "pocket" | "debt";
  id: string;
  name: string;
  day: CalendarDay;
  ageDays: number;
  stale: boolean;
};

export type OverviewModel = {
  today: CalendarDay;
  /** `missing`: Es ist kein Gehaltstag gesetzt, „Bis Gehalt“ und Tagesrahmen haben keine Zahl. */
  salaryStatus: SalaryStatus;
  /** Es ist noch gar nichts erfasst. */
  isEmpty: boolean;
  accounts: { id: string; name: string; kind: AccountKind; stand: StandView | null }[];
  pockets: { id: string; accountId: string; name: string; stand: StandView | null }[];
  accountsTotal: Metric;
  /** Pockets sind eine zweite Sicht auf dasselbe Geld und werden nie zu den Konten addiert. */
  pocketsTotal: Metric;
  availableUntilSalary: Metric;
  dailyAllowance: Metric;
  freeMonthly: Metric;
  bufferMonths: Metric;
  netWorth: Metric;
  debtRemaining: Metric;
  debtFreeDay: Metric;
  incomeSplit: {
    incomeCents: number;
    parts: { key: "expenses" | "rates" | "reserves" | "free"; cents: number; shareBps: number | null }[];
  } | null;
  nextRelief: {
    freeFromMonth: string;
    monthlyReliefCents: number;
    /** Frei im Monat nach dieser Entlastung; `null`, wenn der Spielraum heute nicht berechenbar ist. */
    freeAfterCents: number | null;
    events: { debtId: string; lender: string; lastPaymentDay: CalendarDay; monthlyReliefCents: number }[];
  } | null;
  dataAge: {
    oldestDay: CalendarDay | null;
    oldestAgeDays: number | null;
    staleCount: number;
    items: DataAgeItem[];
  };
};

export function dataAgeItems(derived: Derived): DataAgeItem[] {
  const { today } = derived;
  const items: DataAgeItem[] = [];
  for (const account of derived.accounts) {
    const stand = standView(account.stand, today);
    if (stand) items.push({ kind: "account", id: account.id, name: account.name, day: stand.day, ageDays: stand.ageDays, stale: stand.stale });
  }
  for (const pocket of derived.pockets) {
    const stand = standView(pocket.stand, today);
    if (stand) items.push({ kind: "pocket", id: pocket.id, name: pocket.name, day: stand.day, ageDays: stand.ageDays, stale: stand.stale });
  }
  for (const debt of derived.debts) {
    const anchor = debt.plan?.anchor;
    if (anchor) {
      items.push({
        kind: "debt",
        id: debt.input.id,
        name: debt.input.lender,
        day: anchor.day,
        ageDays: ageInDays(anchor.day, today),
        stale: isStale(anchor.day, today, DEBT_ANCHOR_STALE_AFTER_DAYS),
      });
    }
  }
  return items.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.name < b.name ? -1 : 1));
}

export function buildOverview(input: FinanceInput): OverviewModel {
  const d = derive(input);
  const { today } = d;
  const items = dataAgeItems(d);

  const incomeSplit =
    d.split === null || input.incomeCents === null
      ? null
      : (() => {
          const parts = [
            { key: "expenses" as const, cents: d.split.expensesCents },
            { key: "rates" as const, cents: d.split.ratesCents },
            { key: "reserves" as const, cents: d.split.reservesCents },
            { key: "free" as const, cents: d.split.freeCents },
          ];
          // Der Ring summiert exakt auf 100 %: Der Rest nach dem Runden geht an den größten Anteil.
          const shares = splitBps(parts.map((part) => part.cents), input.incomeCents);
          return {
            incomeCents: input.incomeCents,
            parts: parts.map((part, index) => ({ ...part, shareBps: shares[index] ?? null })),
          };
        })();

  const relief = d.debtAggregates.relief[0];
  return {
    today,
    salaryStatus: d.salaryStatus,
    isEmpty:
      input.accounts.length === 0 &&
      input.budgetItems.length === 0 &&
      input.debts.length === 0 &&
      input.incomeCents === null,
    accounts: d.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      stand: standView(account.stand, today),
    })),
    pockets: d.pockets.map((pocket) => ({
      id: pocket.id,
      accountId: pocket.accountId,
      name: pocket.name,
      stand: standView(pocket.stand, today),
    })),
    accountsTotal: d.metrics.accountsTotal,
    pocketsTotal: d.metrics.pocketsTotal,
    availableUntilSalary: d.metrics.availableUntilSalary,
    dailyAllowance: d.metrics.dailyAllowance,
    freeMonthly: d.metrics.freeMonthly,
    bufferMonths: d.metrics.bufferMonths,
    netWorth: d.metrics.netWorth,
    debtRemaining: d.debtAggregates.remaining,
    debtFreeDay: d.debtAggregates.debtFreeDay,
    incomeSplit,
    nextRelief: relief
      ? {
          freeFromMonth: relief.freeFromMonth,
          monthlyReliefCents: relief.monthlyReliefCents,
          freeAfterCents:
            d.metrics.freeMonthly.value === null ? null : d.metrics.freeMonthly.value + relief.monthlyReliefCents,
          events: relief.events,
        }
      : null,
    dataAge: {
      oldestDay: items.length > 0 ? items[0]!.day : null,
      oldestAgeDays: items.length > 0 ? items[0]!.ageDays : null,
      staleCount: items.filter((item) => item.stale).length,
      items,
    },
  };
}

// ------------------------------------------------------------------- Budget

export type BudgetStatusKind = "empty" | "income_missing" | "within_budget" | "overdrawn";

export type BudgetModel = {
  today: CalendarDay;
  status: BudgetStatusKind;
  incomeCents: number | null;
  /** Ausgaben plus Rücklagen plus Raten. */
  plannedCents: number;
  expensesCents: number;
  reservesCents: number;
  ratesCents: number;
  freeMonthly: Metric;
  /** Fehlbetrag, nur wenn überplant. */
  deficitCents: number | null;
  /** Geplantes in Prozent des Einkommens, in Basispunkten; `null` ohne positives Einkommen. */
  utilizationBps: number | null;
  necessityGroups: {
    necessity: Necessity;
    totalCents: number;
    shareBps: number | null;
    items: {
      id: string;
      label: string;
      kind: "expense" | "reserve";
      category: string;
      monthlyAmountCents: number;
      dueDay: number | null;
    }[];
  }[];
  categories: { category: string; totalCents: number; shareBps: number | null }[];
  rates: { debtId: string; lender: string; monthlyPaymentCents: number }[];
};

export function buildBudget(input: FinanceInput): BudgetModel {
  const d = derive(input);
  const income = input.incomeCents;
  const ratesCents = d.debtAggregates.monthlyRatesCents;
  const plannedCents = d.budget.plannedCents + ratesCents;
  const free = d.metrics.freeMonthly.value;

  let status: BudgetStatusKind;
  if (d.budget.items.length === 0 && ratesCents === 0) status = "empty";
  else if (income === null || free === null) status = "income_missing";
  else status = free < 0 ? "overdrawn" : "within_budget";

  const share = (cents: number) => (income === null ? null : ratioBps(cents, income));
  return {
    today: d.today,
    status,
    incomeCents: income,
    plannedCents,
    expensesCents: d.budget.expensesCents,
    reservesCents: d.budget.reservesCents,
    ratesCents,
    freeMonthly: d.metrics.freeMonthly,
    deficitCents: free !== null && free < 0 ? -free : null,
    utilizationBps: share(plannedCents),
    necessityGroups: d.budget.byNecessity.map(({ necessity, totalCents }) => ({
      necessity,
      totalCents,
      shareBps: share(totalCents),
      items: d.budget.items
        .filter((item) => item.necessity === necessity)
        .map((item) => ({
          id: item.id,
          label: item.label,
          kind: item.kind,
          category: item.category,
          monthlyAmountCents: item.monthlyAmountCents,
          dueDay: item.dueDay,
        })),
    })),
    categories: d.budget.byCategory.map(({ category, totalCents }) => ({ category, totalCents, shareBps: share(totalCents) })),
    rates: d.debtAggregates.runningDebts.map((debt) => ({
      debtId: debt.input.id,
      lender: debt.input.lender,
      monthlyPaymentCents: debt.input.terms.monthlyPaymentCents,
    })),
  };
}

// ----------------------------------------------------------------- Schulden

export type DebtView = {
  id: string;
  lender: string;
  kind: DebtKind;
  note: string | null;
  /** invalid: Vertragsdaten sind unvollständig, es gibt keine Rechnung. */
  state: "ok" | "invalid";
  issues: string[];
  balance: Metric;
  terms: {
    principalCents: number;
    nominalRateBps: number;
    effectiveRateBps: number;
    monthlyPaymentCents: number;
    firstPaymentDay: CalendarDay;
    paymentCount: number;
    finalPaymentCents: number | null;
    specialRepaymentYearlyCents: number | null;
  };
  nextPayment: { day: CalendarDay; cents: number } | null;
  lastPaymentDay: CalendarDay | null;
  remainingPaymentCount: number;
  remainingTotalCents: number;
  interestToEndCents: number;
  payoff:
    | {
        balanceCents: number;
        feeCapCents: number;
        maxCents: number;
        feeBps: number;
        source: "bank" | "estimated";
        cappedByRemainingInterest: boolean;
      }
    | null;
  /** Abweichung des Plans vom zuletzt eingetragenen Bankstand. */
  deviation: {
    day: CalendarDay;
    bankCents: number;
    planCents: number;
    differenceCents: number;
    ageDays: number;
    stale: boolean;
  } | null;
  specialRepaymentExample: SpecialRepaymentExample | null;
  warnings: ScheduleWarning[];
};

export type DebtsModel = {
  today: CalendarDay;
  debts: DebtView[];
  remaining: Metric;
  payoffMax: Metric;
  interestToEnd: Metric;
  extraCostVsPayoff: Metric;
  debtFreeDay: Metric;
  monthlyRatesCents: number;
  relief: {
    freeFromMonth: string;
    monthlyReliefCents: number;
    freeAfterCents: number | null;
    events: { debtId: string; lender: string; lastPaymentDay: CalendarDay; monthlyReliefCents: number }[];
  }[];
  /** Gesamtrestschuld heute und am Ende jedes Monats mit mindestens einer Rate. */
  trajectory: { day: CalendarDay | null; month: string; balanceCents: number }[];
};

function debtBalanceMetric(state: DebtState, today: CalendarDay): Metric {
  const base = { key: "debtBalance", unit: "cents", kind: "calculated" } as const;
  const { plan } = state;
  if (!plan) return unavailable(base, state.issues[0] ?? "Vertragsdaten fehlen.", today);
  const anchor = plan.anchor;
  const pure = anchor !== null && plan.appliedSinceAnchorCount === 0;
  return metric(
    {
      ...base,
      kind: pure ? "actual" : "calculated",
      value: state.balanceTodayCents,
      status: state.anchorStale ? "stale" : "ok",
      reason: state.anchorStale
        ? "Der Bankstand ist älter als 90 Tage."
        : anchor === null
          ? "Noch kein Bankstand eingetragen, der Wert folgt dem Vertrag."
          : null,
      oldestDataDay: anchor?.day ?? null,
      steps: [
        anchor
          ? steps.start("Bankstand", { cents: anchor.bankCents, day: anchor.day })
          : steps.start("Startbetrag laut Vertrag", { cents: state.input.terms.principalCents }),
        steps.note("Raten seit dem Ausgangspunkt nach Plan", { count: plan.appliedSinceAnchorCount }),
        steps.result("Restschuld nach Plan", { cents: state.balanceTodayCents }),
      ],
    },
    today,
  );
}

function debtView(state: DebtState, today: CalendarDay): DebtView {
  const { input, plan } = state;
  const next = plan?.upcomingRows[0] ?? null;
  return {
    id: input.id,
    lender: input.lender,
    kind: input.kind,
    note: input.note,
    state: plan ? "ok" : "invalid",
    issues: state.issues,
    balance: debtBalanceMetric(state, today),
    terms: {
      principalCents: input.terms.principalCents,
      nominalRateBps: input.terms.nominalRateBps,
      effectiveRateBps: input.effectiveRateBps,
      monthlyPaymentCents: input.terms.monthlyPaymentCents,
      firstPaymentDay: input.terms.firstPaymentDay,
      paymentCount: input.terms.paymentCount,
      finalPaymentCents: input.terms.finalPaymentCents,
      specialRepaymentYearlyCents: input.terms.specialRepaymentYearlyCents,
    },
    nextPayment: next ? { day: next.day, cents: next.paymentCents } : null,
    lastPaymentDay: plan?.lastPaymentDay ?? null,
    remainingPaymentCount: plan?.upcomingRows.length ?? 0,
    remainingTotalCents: plan?.remainingPaymentsTotalCents ?? 0,
    interestToEndCents: plan?.remainingInterestCents ?? 0,
    payoff: state.payoff
      ? {
          balanceCents: state.payoff.balanceCents,
          feeCapCents: state.payoff.feeCapCents,
          maxCents: state.payoff.maxCents,
          feeBps: state.payoff.feeBps,
          source: state.payoff.source,
          cappedByRemainingInterest: state.payoff.cappedByRemainingInterest,
        }
      : null,
    deviation: plan?.anchor
      ? {
          day: plan.anchor.day,
          bankCents: plan.anchor.bankCents,
          planCents: plan.anchor.planCents,
          differenceCents: plan.anchor.differenceCents,
          ageDays: ageInDays(plan.anchor.day, today),
          stale: state.anchorStale,
        }
      : null,
    specialRepaymentExample: state.specialExample,
    warnings: plan ? [...new Set([...plan.original.warnings, ...plan.forward.warnings])] : [],
  };
}

export function buildDebts(input: FinanceInput): DebtsModel {
  const d = derive(input);
  const agg = d.debtAggregates;
  const free = d.metrics.freeMonthly.value;
  let cumulative = 0;
  return {
    today: d.today,
    debts: d.debts.map((state) => debtView(state, d.today)),
    remaining: agg.remaining,
    payoffMax: agg.payoffMax,
    interestToEnd: agg.interestToEnd,
    extraCostVsPayoff: agg.extraCostVsPayoff,
    debtFreeDay: agg.debtFreeDay,
    monthlyRatesCents: agg.monthlyRatesCents,
    relief: agg.relief.map((group) => {
      cumulative += group.monthlyReliefCents;
      return { ...group, freeAfterCents: free === null ? null : free + cumulative };
    }),
    trajectory: agg.trajectory,
  };
}

export type DebtScheduleModel = {
  today: CalendarDay;
  debtId: string;
  lender: string;
  /** Raten nach dem Bankstand (falls vorhanden) bis zum Ende. */
  rows: (ScheduleRow & { state: "paid" | "upcoming" })[];
  residualCents: number;
  totalInterestCents: number;
  warnings: ScheduleWarning[];
};

export function buildDebtSchedule(input: FinanceInput, debtId: string): DebtScheduleModel | null {
  const state = derive(input).debts.find((debt) => debt.input.id === debtId);
  const plan: DebtPlan | null = state?.plan ?? null;
  if (!state || !plan) return null;
  return {
    today: input.today,
    debtId,
    lender: state.input.lender,
    rows: plan.forward.rows.map((row) => ({ ...row, state: row.day < input.today ? ("paid" as const) : ("upcoming" as const) })),
    residualCents: plan.forward.residualCents,
    totalInterestCents: plan.forward.totalInterestCents,
    warnings: plan.forward.warnings,
  };
}

// ---------------------------------------------------------------- Demnächst

export type UpcomingModel = {
  today: CalendarDay;
  /** `missing`: Es ist kein Gehaltstag gesetzt, „Bis Gehalt“ und Tagesrahmen haben keine Zahl. */
  salaryStatus: SalaryStatus;
  nextSalaryDay: CalendarDay | null;
  daysUntilSalary: number | null;
  payments: UpcomingPayment[];
  pendingPayments: Metric;
  accountsTotal: Metric;
  availableUntilSalary: Metric;
  dailyAllowance: Metric;
};

export function buildUpcoming(input: FinanceInput): UpcomingModel {
  const d = derive(input);
  return {
    today: d.today,
    salaryStatus: d.salaryStatus,
    nextSalaryDay: d.nextSalary,
    daysUntilSalary: d.daysUntilSalary,
    payments: d.payments,
    pendingPayments: d.metrics.pendingPayments,
    accountsTotal: d.metrics.accountsTotal,
    availableUntilSalary: d.metrics.availableUntilSalary,
    dailyAllowance: d.metrics.dailyAllowance,
  };
}
