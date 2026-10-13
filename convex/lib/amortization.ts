import { addMonthsKeepingDay, isCalendarDay, type CalendarDay } from "./calendar";
import { mulDivRound, monthlyInterestCents, sumCents } from "./money";

/** Vertragsdaten eines Kredits oder Ratenkaufs. Alle Beträge in Cent. */
export type LoanTerms = {
  principalCents: number;
  /** Sollzins pro Jahr in Basispunkten (4,99 % = 499). 0 für Ratenkauf ohne Zins. */
  nominalRateBps: number;
  monthlyPaymentCents: number;
  firstPaymentDay: CalendarDay;
  paymentCount: number;
  /** Abweichende letzte Rate laut Vertrag. Ohne Angabe löst die letzte Rate den Rest ab. */
  finalPaymentCents: number | null;
  /** Höchstbetrag pro Jahr, den der Vertrag als Sondertilgung erlaubt. */
  specialRepaymentYearlyCents: number | null;
};

export const MAX_PAYMENT_COUNT = 600;

export type ScheduleWarning =
  /** Die Rate deckt den Zins einer Periode nicht: die Restschuld wächst. */
  | "payment_below_interest"
  /** Nach der letzten Rate bleibt ein Rest oder ein Überschuss: Vertragsdaten passen nicht zusammen. */
  | "unexpected_residual"
  /** Die berechnete letzte Rate ist mehr als doppelt so hoch wie die Monatsrate. */
  | "final_payment_far_from_rate";

export type ScheduleRow = {
  /** Laufende Nummer der Rate laut Vertrag, ab 1. */
  index: number;
  day: CalendarDay;
  paymentCents: number;
  interestCents: number;
  /** Tilgungsanteil der Rate (Rate minus Zins). */
  principalCents: number;
  /** Zusätzliche Sondertilgung nach dieser Rate, nur in der Beispielrechnung. */
  specialCents: number;
  balanceAfterCents: number;
};

export type Schedule = {
  rows: ScheduleRow[];
  totalInterestCents: number;
  totalPaidCents: number;
  /** Restschuld nach der letzten Zeile. 0, wenn der Plan aufgeht. */
  residualCents: number;
  warnings: ScheduleWarning[];
};

export function validateTerms(terms: LoanTerms): string[] {
  const issues: string[] = [];
  const nonNegative = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!nonNegative(terms.principalCents)) issues.push("Der Startbetrag muss eine ganze Zahl in Cent ab 0 sein.");
  if (!nonNegative(terms.nominalRateBps) || terms.nominalRateBps > 10_000) {
    issues.push("Der Sollzins muss zwischen 0 und 100 % liegen.");
  }
  if (!nonNegative(terms.monthlyPaymentCents)) issues.push("Die Monatsrate muss eine ganze Zahl in Cent ab 0 sein.");
  if (!isCalendarDay(terms.firstPaymentDay)) issues.push("Die erste Rate braucht einen gültigen Kalendertag.");
  if (!Number.isSafeInteger(terms.paymentCount) || terms.paymentCount < 1 || terms.paymentCount > MAX_PAYMENT_COUNT) {
    issues.push(`Die Anzahl der Raten muss zwischen 1 und ${MAX_PAYMENT_COUNT} liegen.`);
  }
  if (terms.finalPaymentCents !== null && !nonNegative(terms.finalPaymentCents)) {
    issues.push("Die Schlussrate muss eine ganze Zahl in Cent ab 0 sein.");
  }
  if (terms.specialRepaymentYearlyCents !== null && !nonNegative(terms.specialRepaymentYearlyCents)) {
    issues.push("Die Sondertilgung muss eine ganze Zahl in Cent ab 0 sein.");
  }
  return issues;
}

export type ScheduleOptions = {
  /** Zeilen bis einschließlich dieser Nummer gelten als bezahlt und werden nicht erzeugt. */
  startAfterIndex?: number;
  /** Restschuld nach `startAfterIndex`. Ohne Angabe der Startbetrag. */
  startBalanceCents?: number;
  /** Beispielrechnung: Sondertilgung nach jeder 12. Rate. Der Grundplan setzt 0. */
  specialRepaymentYearlyCents?: number;
};

/**
 * Tilgungsplan nach dem Vertrag.
 *
 * Regeln:
 * - Rate i ist am Tag des Monats der ersten Rate fällig, in kurzen Monaten am
 *   letzten Tag des Monats.
 * - Zins je Periode = Restschuld × Sollzins ÷ 12, auf ganze Cent gerundet
 *   (halbe Cent von null weg). Banken zählen Zinstage teils anders; die Abweichung
 *   zeigt `planDebt` gegenüber dem Bankstand.
 * - Jede Rate zahlt höchstens Restschuld plus Zins. Ist das früher erreicht,
 *   endet der Plan früher.
 * - Die letzte Rate ist die Schlussrate laut Vertrag, sonst Restschuld plus Zins.
 */
export function buildSchedule(terms: LoanTerms, options: ScheduleOptions = {}): Schedule {
  const startAfter = options.startAfterIndex ?? 0;
  const extra = options.specialRepaymentYearlyCents ?? 0;
  let balance = options.startBalanceCents ?? terms.principalCents;
  const rows: ScheduleRow[] = [];
  const warnings = new Set<ScheduleWarning>();

  for (let index = startAfter + 1; index <= terms.paymentCount; index += 1) {
    if (balance <= 0) break;
    const interest = monthlyInterestCents(balance, terms.nominalRateBps);
    const due = balance + interest;
    const isLast = index === terms.paymentCount;
    const payment = isLast ? (terms.finalPaymentCents ?? due) : Math.min(terms.monthlyPaymentCents, due);
    if (payment < interest) warnings.add("payment_below_interest");
    if (isLast && terms.finalPaymentCents === null && payment > terms.monthlyPaymentCents * 2) {
      warnings.add("final_payment_far_from_rate");
    }
    let balanceAfter = due - payment;
    let special = 0;
    if (extra > 0 && index % 12 === 0 && !isLast && balanceAfter > 0) {
      special = Math.min(extra, balanceAfter);
      balanceAfter -= special;
    }
    rows.push({
      index,
      day: addMonthsKeepingDay(terms.firstPaymentDay, index - 1),
      paymentCents: payment,
      interestCents: interest,
      principalCents: payment - interest,
      specialCents: special,
      balanceAfterCents: balanceAfter,
    });
    balance = balanceAfter;
  }

  const residual = balance;
  const last = rows[rows.length - 1];
  if (last && last.index === terms.paymentCount && residual !== 0) warnings.add("unexpected_residual");

  return {
    rows,
    totalInterestCents: sumCents(rows.map((row) => row.interestCents)),
    totalPaidCents: sumCents(rows.map((row) => row.paymentCents + row.specialCents)),
    residualCents: residual,
    warnings: [...warnings],
  };
}

/** Bankstand, den Steven eingetragen hat. Gilt nach allen Raten, die am Stichtag oder davor fällig waren. */
export type BankAnchor = {
  day: CalendarDay;
  balanceCents: number;
  payoffQuoteCents: number | null;
};

export type DebtPlan = {
  /** Plan vom Startbetrag, unabhängig vom Bankstand. */
  original: Schedule;
  /** Ab dem Bankstand (falls vorhanden) fortgeschriebener Plan; sonst gleich `original`. */
  forward: Schedule;
  anchor:
    | {
        day: CalendarDay;
        bankCents: number;
        /** Restschuld an diesem Tag nach dem ursprünglichen Plan. */
        planCents: number;
        /** Bankstand minus Plan: positiv heißt, die Bank sieht mehr Schuld. */
        differenceCents: number;
      }
    | null;
  /** Restschuld nach allen Raten bis einschließlich heute. */
  balanceTodayCents: number;
  /** Raten ab heute (inklusive heute), noch nicht bezahlt. */
  upcomingRows: ScheduleRow[];
  /** Raten nach dem Bankstand, die bis heute nach Plan bezahlt sind. */
  appliedSinceAnchorCount: number;
  remainingInterestCents: number;
  remainingPaymentsTotalCents: number;
  lastPaymentDay: CalendarDay | null;
};

export function planDebt(terms: LoanTerms, anchor: BankAnchor | null, today: CalendarDay): DebtPlan {
  const original = buildSchedule(terms);

  let startAfterIndex = 0;
  let startBalance = terms.principalCents;
  let anchorInfo: DebtPlan["anchor"] = null;

  if (anchor) {
    const elapsed = original.rows.filter((row) => row.day <= anchor.day);
    startAfterIndex = elapsed.length > 0 ? elapsed[elapsed.length - 1]!.index : 0;
    startBalance = anchor.balanceCents;
    const planCents = elapsed.length > 0 ? elapsed[elapsed.length - 1]!.balanceAfterCents : terms.principalCents;
    anchorInfo = {
      day: anchor.day,
      bankCents: anchor.balanceCents,
      planCents,
      differenceCents: anchor.balanceCents - planCents,
    };
  }

  const forward = anchor
    ? buildSchedule(terms, { startAfterIndex, startBalanceCents: startBalance })
    : original;

  const paid = forward.rows.filter((row) => row.day < today);
  const upcomingRows = forward.rows.filter((row) => row.day >= today);
  // Rate am heutigen Tag gilt als noch offen (Kontostand kann sie noch nicht enthalten).
  const lastPaid = paid[paid.length - 1];
  const balanceToday = lastPaid ? lastPaid.balanceAfterCents : startBalance;

  return {
    original,
    forward,
    anchor: anchorInfo,
    balanceTodayCents: balanceToday,
    upcomingRows,
    appliedSinceAnchorCount: paid.length,
    remainingInterestCents: sumCents(upcomingRows.map((row) => row.interestCents)),
    remainingPaymentsTotalCents: sumCents(upcomingRows.map((row) => row.paymentCents)),
    lastPaymentDay: upcomingRows.length > 0 ? upcomingRows[upcomingRows.length - 1]!.day : null,
  };
}

/** Obergrenze der Vorfälligkeitsentschädigung nach § 502 BGB: 1 % des abgelösten Betrags, 0,5 % bei höchstens 12 Monaten Restlaufzeit. */
export const PAYOFF_FEE_BPS_LONG = 100;
export const PAYOFF_FEE_BPS_SHORT = 50;
export const PAYOFF_SHORT_TERM_MONTHS = 12;

export type PayoffBound = {
  balanceCents: number;
  /** Höchstens fällige Entschädigung. */
  feeCapCents: number;
  /** Restschuld plus Entschädigungs-Obergrenze. */
  maxCents: number;
  feeBps: number;
  /** Gesetzliche Deckelung: nie mehr als die Zinsen bis zum planmäßigen Ende. */
  cappedByRemainingInterest: boolean;
};

export function payoffUpperBound(
  balanceCents: number,
  remainingPaymentCount: number,
  remainingInterestCents: number,
): PayoffBound {
  const feeBps = remainingPaymentCount > PAYOFF_SHORT_TERM_MONTHS ? PAYOFF_FEE_BPS_LONG : PAYOFF_FEE_BPS_SHORT;
  if (balanceCents <= 0) {
    return { balanceCents, feeCapCents: 0, maxCents: balanceCents, feeBps, cappedByRemainingInterest: false };
  }
  const byPercent = mulDivRound(balanceCents, feeBps, 10_000);
  const capped = byPercent > remainingInterestCents;
  const feeCapCents = capped ? remainingInterestCents : byPercent;
  return { balanceCents, feeCapCents, maxCents: balanceCents + feeCapCents, feeBps, cappedByRemainingInterest: capped };
}

