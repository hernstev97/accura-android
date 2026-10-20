import {
  buildSchedule,
  payoffUpperBound,
  planDebt,
  validateTerms,
  type DebtPlan,
  type PayoffBound,
} from "./amortization";
import {
  addMonthsToMonth,
  monthOf,
  type CalendarDay,
} from "./calendar";
import { DEBT_ANCHOR_STALE_AFTER_DAYS, isStale } from "./freshness";
import { sortByOrder, type DebtInput } from "./input";
import { metric, olderDay, steps, unavailable, type Metric, type Step } from "./metric";
import { sumCents } from "./money";

export type PayoffSource = "bank" | "estimated";

export type SpecialRepaymentExample = {
  yearlyCents: number;
  endDay: CalendarDay | null;
  remainingInterestCents: number;
  interestSavedCents: number;
  paymentsSaved: number;
};

export type DebtState = {
  input: DebtInput;
  /** Probleme in den Vertragsdaten; dann gibt es keinen Plan. */
  issues: string[];
  plan: DebtPlan | null;
  /** Hat noch Raten ab heute. */
  running: boolean;
  /** Noch Schuld offen: laufend oder laut Bankstand nicht null. */
  outstanding: boolean;
  balanceTodayCents: number;
  payoff: (PayoffBound & { source: PayoffSource }) | null;
  specialExample: SpecialRepaymentExample | null;
  anchorStale: boolean;
};

export function deriveDebt(input: DebtInput, today: CalendarDay): DebtState {
  const issues = validateTerms(input.terms);
  if (issues.length > 0) {
    return {
      input,
      issues,
      plan: null,
      running: false,
      outstanding: false,
      balanceTodayCents: 0,
      payoff: null,
      specialExample: null,
      anchorStale: false,
    };
  }

  const anchor = input.anchor && input.anchor.day <= today ? input.anchor : null;
  const plan = planDebt(input.terms, anchor, today);
  const running = plan.upcomingRows.length > 0;
  const balance = plan.balanceTodayCents;

  const bound = payoffUpperBound(balance, plan.upcomingRows.length, plan.remainingInterestCents);
  const useBankQuote = anchor !== null && anchor.payoffQuoteCents !== null && plan.appliedSinceAnchorCount === 0;
  const payoff: DebtState["payoff"] = useBankQuote
    ? {
        ...bound,
        feeCapCents: anchor!.payoffQuoteCents! - balance,
        maxCents: anchor!.payoffQuoteCents!,
        cappedByRemainingInterest: false,
        source: "bank",
      }
    : { ...bound, source: "estimated" };

  let specialExample: SpecialRepaymentExample | null = null;
  const yearly = input.terms.specialRepaymentYearlyCents;
  const first = plan.upcomingRows[0];
  if (yearly !== null && yearly > 0 && first) {
    const example = buildSchedule(input.terms, {
      startAfterIndex: first.index - 1,
      startBalanceCents: balance,
      specialRepaymentYearlyCents: yearly,
    });
    const lastRow = example.rows[example.rows.length - 1];
    specialExample = {
      yearlyCents: yearly,
      endDay: lastRow ? lastRow.day : null,
      remainingInterestCents: example.totalInterestCents,
      interestSavedCents: plan.remainingInterestCents - example.totalInterestCents,
      paymentsSaved: plan.upcomingRows.length - example.rows.length,
    };
  }

  return {
    input,
    issues,
    plan,
    running,
    outstanding: running || balance > 0,
    balanceTodayCents: balance,
    payoff,
    specialExample,
    anchorStale: anchor !== null && isStale(anchor.day, today, DEBT_ANCHOR_STALE_AFTER_DAYS),
  };
}

export function deriveDebts(inputs: readonly DebtInput[], today: CalendarDay): DebtState[] {
  return sortByOrder(inputs.filter((debt) => debt.active)).map((debt) => deriveDebt(debt, today));
}

export type DebtAggregates = {
  remaining: Metric;
  payoffMax: Metric;
  interestToEnd: Metric;
  extraCostVsPayoff: Metric;
  debtFreeDay: Metric;
  /** Summe der Monatsraten laufender Kredite. */
  monthlyRatesCents: number;
  runningDebts: DebtState[];
  relief: ReliefGroup[];
  trajectory: { day: CalendarDay | null; month: string; balanceCents: number }[];
};

export type ReliefGroup = {
  /** Erster Monat ohne diese Rate, "YYYY-MM". */
  freeFromMonth: string;
  monthlyReliefCents: number;
  events: { debtId: string; lender: string; lastPaymentDay: CalendarDay; monthlyReliefCents: number }[];
};

export function aggregateDebts(states: readonly DebtState[], today: CalendarDay): DebtAggregates {
  const included = states.filter((state) => state.outstanding);
  const running = states.filter((state) => state.running);
  const invalid = states.filter((state) => state.issues.length > 0);
  const oldestAnchor = states.reduce<CalendarDay | null>(
    (oldest, state) => olderDay(oldest, state.plan?.anchor?.day ?? null),
    null,
  );
  const anyStale = included.some((state) => state.anchorStale);

  const base = (key: string, unit: "cents" | "day", kind: "calculated" | "estimated") => ({ key, unit, kind }) as const;
  const blocked = (key: string, unit: "cents" | "day", kind: "calculated" | "estimated"): Metric | null =>
    invalid.length > 0
      ? unavailable(base(key, unit, kind), `Bei ${invalid.length} Kredit(en) sind die Vertragsdaten unvollständig oder ungültig.`, today)
      : null;

  const status = anyStale ? "stale" : "ok";
  const staleReason = anyStale ? "Ein Bankstand ist älter als 90 Tage." : null;
  const noAnchorNote = states.some((state) => state.input.anchor === null)
    ? steps.note("Für Kredite ohne Bankstand folgt der Wert dem Vertrag.")
    : null;
  const withNote = (list: Step[]) => (noAnchorNote ? [...list, noAnchorNote] : list);

  const remainingTotal = sumCents(included.map((state) => state.balanceTodayCents));
  const remaining =
    blocked("debtRemaining", "cents", "calculated") ??
    metric(
      {
        ...base("debtRemaining", "cents", "calculated"),
        value: remainingTotal,
        status,
        reason: staleReason,
        oldestDataDay: oldestAnchor,
        steps: withNote([
          ...included.map((state) => steps.plus(state.input.lender, { cents: state.balanceTodayCents })),
          steps.result("Restschuld nach Plan", { cents: remainingTotal }),
        ]),
      },
      today,
    );

  const payoffTotal = sumCents(included.map((state) => state.payoff?.maxCents ?? 0));
  const payoffMax =
    blocked("payoffMax", "cents", "estimated") ??
    metric(
      {
        ...base("payoffMax", "cents", "estimated"),
        value: payoffTotal,
        status,
        reason: staleReason,
        oldestDataDay: oldestAnchor,
        steps: withNote([
          ...included.flatMap((state) => [
            steps.plus(`${state.input.lender}: Restschuld`, { cents: state.balanceTodayCents }),
            ...(state.payoff && state.payoff.feeCapCents !== 0
              ? [
                  steps.plus(
                    state.payoff.source === "bank"
                      ? `${state.input.lender}: Entschädigung laut Bank`
                      : `${state.input.lender}: Entschädigung höchstens`,
                    { cents: state.payoff.feeCapCents },
                  ),
                ]
              : []),
          ]),
          steps.result("Ablösesumme höchstens", { cents: payoffTotal }),
        ]),
      },
      today,
    );

  const interestTotal = sumCents(running.map((state) => state.plan!.remainingInterestCents));
  const interestToEnd =
    blocked("interestToEnd", "cents", "calculated") ??
    metric(
      {
        ...base("interestToEnd", "cents", "calculated"),
        value: interestTotal,
        status,
        reason: staleReason,
        oldestDataDay: oldestAnchor,
        steps: [
          ...running.map((state) => steps.plus(state.input.lender, { cents: state.plan!.remainingInterestCents })),
          steps.result("Zinsen bis Laufzeitende", { cents: interestTotal }),
        ],
      },
      today,
    );

  const scheduledTotal = sumCents(running.map((state) => state.plan!.remainingPaymentsTotalCents));
  const runningPayoff = sumCents(running.map((state) => state.payoff?.maxCents ?? 0));
  const extra = scheduledTotal - runningPayoff;
  const extraCostVsPayoff =
    blocked("extraCostVsPayoff", "cents", "estimated") ??
    metric(
      {
        ...base("extraCostVsPayoff", "cents", "estimated"),
        value: extra,
        status,
        reason: staleReason,
        oldestDataDay: oldestAnchor,
        steps: [
          steps.start("Noch planmäßig zu zahlen", { cents: scheduledTotal }),
          steps.minus("Ablösesumme höchstens", { cents: runningPayoff }),
          steps.result("Mehrkosten gegenüber sofortiger Ablösung", { cents: extra }),
        ],
      },
      today,
    );

  const lastDays = running.map((state) => state.plan!.lastPaymentDay!);
  const stuck = included.filter((state) => !state.running);
  const debtFree = lastDays.length > 0 ? lastDays.reduce((max, day) => (day > max ? day : max)) : null;
  const debtFreeDay =
    blocked("debtFreeDay", "day", "calculated") ??
    (stuck.length > 0
      ? unavailable(
          base("debtFreeDay", "day", "calculated"),
          "Laut Bankstand ist noch Schuld offen, der Plan sieht aber keine Rate mehr vor.",
          today,
        )
      : metric(
          {
            ...base("debtFreeDay", "day", "calculated"),
            day: debtFree,
            status,
            reason: debtFree === null ? "Keine laufenden Schulden." : staleReason,
            oldestDataDay: oldestAnchor,
            steps: [
              ...running.map((state) => steps.note(state.input.lender, { day: state.plan!.lastPaymentDay })),
              ...(debtFree ? [steps.result("Letzte Rate aller Kredite", { day: debtFree })] : []),
            ],
          },
          today,
        ));

  const monthlyRatesCents = sumCents(running.map((state) => state.input.terms.monthlyPaymentCents));

  const events = running
    .map((state) => ({
      debtId: state.input.id,
      lender: state.input.lender,
      lastPaymentDay: state.plan!.lastPaymentDay!,
      monthlyReliefCents: state.input.terms.monthlyPaymentCents,
    }))
    .sort((a, b) => (a.lastPaymentDay < b.lastPaymentDay ? -1 : a.lastPaymentDay > b.lastPaymentDay ? 1 : a.lender < b.lender ? -1 : 1));
  const groups = new Map<string, ReliefGroup>();
  for (const event of events) {
    const freeFromMonth = addMonthsToMonth(monthOf(event.lastPaymentDay), 1);
    const group = groups.get(freeFromMonth);
    if (group) {
      group.monthlyReliefCents += event.monthlyReliefCents;
      group.events.push(event);
    } else {
      groups.set(freeFromMonth, { freeFromMonth, monthlyReliefCents: event.monthlyReliefCents, events: [event] });
    }
  }

  return {
    remaining,
    payoffMax,
    interestToEnd,
    extraCostVsPayoff,
    debtFreeDay,
    monthlyRatesCents,
    runningDebts: running,
    relief: [...groups.values()],
    trajectory: trajectory(included, today),
  };
}

/** Gesamte Restschuld heute und danach am Ende jedes Monats mit mindestens einer Rate. */
function trajectory(states: readonly DebtState[], today: CalendarDay): DebtAggregates["trajectory"] {
  const months = new Set<string>();
  for (const state of states) for (const row of state.plan?.upcomingRows ?? []) months.add(monthOf(row.day));
  const points: DebtAggregates["trajectory"] = [
    { day: today, month: monthOf(today), balanceCents: sumCents(states.map((state) => state.balanceTodayCents)) },
  ];
  for (const month of [...months].sort()) {
    const total = sumCents(
      states.map((state) => {
        const rows = (state.plan?.upcomingRows ?? []).filter((row) => monthOf(row.day) <= month);
        const last = rows[rows.length - 1];
        return last ? last.balanceAfterCents : state.balanceTodayCents;
      }),
    );
    points.push({ day: null, month, balanceCents: total });
  }
  return points;
}
