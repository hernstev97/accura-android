import { diffDays, type CalendarDay } from "./calendar";

/**
 * Jede Kennzahl kommt als Paket: Wert, Rechenweg, Alter der ältesten
 * verwendeten Daten und ein Status (Plan, Abschnitt „Rechnen und Erkenntnisse“).
 */

/** cents = Cent, bps = Basispunkte, monthsX100 = Monate mal 100, days = Tage, count = Anzahl, day = Kalendertag (in `day`). */
export type MetricUnit = "cents" | "bps" | "monthsX100" | "days" | "count" | "day";

/** actual = eingetragen, planned = geplant (Vertrag, Budget), estimated = geschätzt, calculated = berechnet. */
export type MetricKind = "actual" | "planned" | "estimated" | "calculated";

/** ok = belastbar, stale = beruht auf alten Daten, unavailable = mangels Daten nicht berechenbar. */
export type MetricStatus = "ok" | "stale" | "unavailable";

export type StepOp = "start" | "plus" | "minus" | "result" | "note";

/** Eine Zeile des Rechenwegs („So gerechnet“). Genau höchstens eines der Wertfelder ist gesetzt. */
export type Step = {
  op: StepOp;
  label: string;
  cents: number | null;
  bps: number | null;
  count: number | null;
  day: CalendarDay | null;
};

const step = (op: StepOp, label: string, values: Partial<Pick<Step, "cents" | "bps" | "count" | "day">> = {}): Step => ({
  op,
  label,
  cents: values.cents ?? null,
  bps: values.bps ?? null,
  count: values.count ?? null,
  day: values.day ?? null,
});

export const steps = {
  start: (label: string, values?: Parameters<typeof step>[2]) => step("start", label, values),
  plus: (label: string, values?: Parameters<typeof step>[2]) => step("plus", label, values),
  minus: (label: string, values?: Parameters<typeof step>[2]) => step("minus", label, values),
  result: (label: string, values?: Parameters<typeof step>[2]) => step("result", label, values),
  note: (label: string, values?: Parameters<typeof step>[2]) => step("note", label, values),
};

export type Metric = {
  key: string;
  unit: MetricUnit;
  kind: MetricKind;
  /** Zahlenwert in der Einheit `unit`; `null`, wenn nicht berechenbar oder `unit` = "day". */
  value: number | null;
  /** Kalendertag, wenn `unit` = "day". */
  day: CalendarDay | null;
  status: MetricStatus;
  /** Warum der Wert fehlt oder mit Vorsicht zu lesen ist. */
  reason: string | null;
  /** Alter des ältesten verwendeten Standes in Tagen bis heute; `null` ohne datierte Stände. */
  dataAgeDays: number | null;
  oldestDataDay: CalendarDay | null;
  steps: Step[];
};

type MetricInit = {
  key: string;
  unit: MetricUnit;
  kind: MetricKind;
  value?: number | null;
  day?: CalendarDay | null;
  status: MetricStatus;
  reason?: string | null;
  oldestDataDay?: CalendarDay | null;
  steps?: Step[];
};

export function metric(init: MetricInit, today: CalendarDay): Metric {
  const oldest = init.oldestDataDay ?? null;
  return {
    key: init.key,
    unit: init.unit,
    kind: init.kind,
    value: init.value ?? null,
    day: init.day ?? null,
    status: init.status,
    reason: init.reason ?? null,
    dataAgeDays: oldest === null ? null : Math.max(0, diffDays(oldest, today)),
    oldestDataDay: oldest,
    steps: init.steps ?? [],
  };
}

export function unavailable(
  init: Pick<MetricInit, "key" | "unit" | "kind"> & { steps?: Step[] },
  reason: string,
  today: CalendarDay,
): Metric {
  return metric({ ...init, status: "unavailable", reason }, today);
}

/** Der ältere von zwei Tagen (`null` zählt nicht). */
export function olderDay(a: CalendarDay | null, b: CalendarDay | null): CalendarDay | null {
  if (a === null) return b;
  if (b === null) return a;
  return a <= b ? a : b;
}
