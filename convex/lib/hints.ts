import type { CalendarDay } from "./calendar";
import { NECESSITIES, type BudgetItemInput, type FinanceInput, type Necessity } from "./input";
import { steps, type Step } from "./metric";
import { assertSafeInteger, sumCents } from "./money";
import { cancellation, type Cancellation } from "./notice";

/**
 * Einspar-Hinweise (Plan, Abschnitt „Einspar-Hinweise“). Reine Funktionen auf
 * `FinanceInput`. Jeder Hinweis nennt den Betrag pro Monat und pro Jahr, einen
 * Grund, den Rechenweg und einen Status. Das Backend liefert alle Hinweise,
 * auch ausgeblendete; was davon zu sehen ist, entscheidet die App.
 *
 * Texte nennen keine Beträge (die App kann Beträge ausblenden) und empfehlen
 * keine Anbieter oder Tarife.
 */

/** Kategorien, die als Abo oder Vertrag gelten; verglichen ohne Leerzeichen am Rand und ohne Groß- und Kleinschreibung. */
export const SUBSCRIPTION_CATEGORIES = ["abo", "vertrag"] as const;

/** Die beiden unteren Notwendigkeitsstufen. */
export const LOW_NECESSITIES: readonly Necessity[] = ["optional", "unnecessary"];

export const MONTHS_PER_YEAR = 12;

/** Jahresbetrag = Monatsbetrag × 12, exakt. */
export const yearlyCents = (monthlyCents: number) => assertSafeInteger(monthlyCents * MONTHS_PER_YEAR, "Jahresbetrag");

export type HintType = "subscriptions" | "lowNecessity";

/** open: zählt mit; waived: „bewusst so“, zählt nicht; reopened: war „bewusst so“, der Posten hat sich seitdem geändert, zählt wieder. */
export type HintItemStatus = "open" | "waived" | "reopened";

/** open: mindestens ein Posten zählt; waived: alle Posten sind „bewusst so“. */
export type HintStatus = "open" | "waived";

export type HintItem = {
  id: string;
  label: string;
  category: string;
  necessity: Necessity;
  /** Ohne Leerzeichen am Rand; `null`, wenn nicht erfasst. */
  contractType: string | null;
  monthlyCents: number;
  yearlyCents: number;
  status: HintItemStatus;
  /** Letzter Kündigungstag; `null`, wenn weder Vertragsende noch Frist erfasst sind. */
  cancellation: Cancellation | null;
};

/** Mehrere mitzählende Abos oder Verträge derselben Art. */
export type SameTypeGroup = {
  /** Schreibweise des ersten Postens der Gruppe. */
  contractType: string;
  itemIds: string[];
  monthlyCents: number;
  yearlyCents: number;
};

export type Hint = {
  type: HintType;
  status: HintStatus;
  reason: string;
  /** Summe der mitzählenden Posten. Ausgeblendete zählen nicht; bei `waived` also 0. */
  monthlyCents: number;
  yearlyCents: number;
  steps: Step[];
  /** Alle Posten des Hinweises, auch ausgeblendete, in Anzeigereihenfolge. */
  items: HintItem[];
  /** Nur bei `subscriptions`, sonst leer. */
  sameTypeGroups: SameTypeGroup[];
};

export type HintsModel = {
  today: CalendarDay;
  /** In fester Reihenfolge: `subscriptions`, `lowNecessity`. Ein Hinweis ohne Posten fehlt. */
  hints: Hint[];
};

type HintFields = Pick<
  BudgetItemInput,
  | "monthlyAmountCents"
  | "necessity"
  | "kind"
  | "category"
  | "contractType"
  | "contractEndDay"
  | "noticePeriodDays"
  | "noticePeriodMonths"
>;

/**
 * Stand eines Postens, soweit er für Hinweise zählt. „Bewusst so“ speichert
 * ihn; weicht der Posten später davon ab, ist der Hinweis wieder da. Name,
 * Notiz, Reihenfolge und Fälligkeitstag gehören nicht dazu.
 */
export function hintFingerprint(item: HintFields): string {
  return JSON.stringify([
    1,
    item.monthlyAmountCents,
    item.necessity,
    item.kind,
    item.category,
    item.contractType,
    item.contractEndDay,
    item.noticePeriodDays,
    item.noticePeriodMonths,
  ]);
}

export function itemStatus(item: BudgetItemInput): HintItemStatus {
  if (item.waivedHintFingerprint === null) return "open";
  return item.waivedHintFingerprint === hintFingerprint(item) ? "waived" : "reopened";
}

const counts = (item: HintItem) => item.status !== "waived";

const normalize = (text: string) => text.trim().toLowerCase();

export function isSubscription(item: BudgetItemInput): boolean {
  return (SUBSCRIPTION_CATEGORIES as readonly string[]).includes(normalize(item.category));
}

function contractTypeOf(item: BudgetItemInput): string | null {
  const type = item.contractType?.trim() ?? "";
  return type === "" ? null : type;
}

/** Niedrigste Notwendigkeit zuerst, dann der höhere Betrag, dann die Reihenfolge im Budget. */
export function compareForHints(a: BudgetItemInput, b: BudgetItemInput): number {
  return (
    NECESSITIES.indexOf(b.necessity) - NECESSITIES.indexOf(a.necessity) ||
    b.monthlyAmountCents - a.monthlyAmountCents ||
    a.order - b.order ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function hintItems(items: readonly BudgetItemInput[], today: CalendarDay): HintItem[] {
  return [...items].sort(compareForHints).map((item) => ({
    id: item.id,
    label: item.label,
    category: item.category,
    necessity: item.necessity,
    contractType: contractTypeOf(item),
    monthlyCents: item.monthlyAmountCents,
    yearlyCents: yearlyCents(item.monthlyAmountCents),
    status: itemStatus(item),
    cancellation: cancellation(item, today),
  }));
}

/** Posten-Zeilen und Summe pro Monat und Jahr; ausgeblendete Posten stehen als Notiz da. */
function sumSteps(items: readonly HintItem[], monthLabel: string, yearLabel: string): { steps: Step[]; monthlyCents: number } {
  const monthlyCents = sumCents(items.filter(counts).map((item) => item.monthlyCents));
  return {
    monthlyCents,
    steps: [
      ...items.map((item) =>
        counts(item)
          ? steps.plus(item.label, { cents: item.monthlyCents })
          : steps.note(`${item.label}: bewusst so, zählt nicht mit`),
      ),
      steps.result(monthLabel, { cents: monthlyCents }),
      steps.note("Monate im Jahr", { count: MONTHS_PER_YEAR }),
      steps.result(yearLabel, { cents: yearlyCents(monthlyCents) }),
    ],
  };
}

function sameTypeGroups(items: readonly HintItem[]): SameTypeGroup[] {
  const groups = new Map<string, HintItem[]>();
  for (const item of items) {
    if (!counts(item) || item.contractType === null) continue;
    const key = normalize(item.contractType);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()]
    .filter((members) => members.length > 1)
    .map((members) => {
      const monthlyCents = sumCents(members.map((member) => member.monthlyCents));
      return {
        contractType: members[0]!.contractType!,
        itemIds: members.map((member) => member.id),
        monthlyCents,
        yearlyCents: yearlyCents(monthlyCents),
      };
    });
}

const quoted = (texts: readonly string[]) => texts.map((text) => `„${text}“`).join(", ");

function subscriptionsHint(items: HintItem[]): Hint {
  const groups = sameTypeGroups(items);
  const { steps: sums, monthlyCents } = sumSteps(items, "Abos und Verträge im Monat", "Abos und Verträge im Jahr");
  const groupNotes = groups.map((group) => {
    const labels = group.itemIds.map((id) => items.find((item) => item.id === id)!.label);
    return steps.note(`Gleiche Art „${group.contractType}“: ${labels.join(", ")}`, { count: group.itemIds.length });
  });
  const noticeNotes = items.flatMap((item) =>
    counts(item) && item.cancellation?.lastNoticeDay
      ? [
          steps.note(
            item.cancellation.state === "passed"
              ? `Letzter Kündigungstag vorbei: ${item.label}`
              : `Letzter Kündigungstag: ${item.label}`,
            { day: item.cancellation.lastNoticeDay },
          ),
        ]
      : [],
  );
  const status: HintStatus = items.some(counts) ? "open" : "waived";
  const reason =
    status === "waived"
      ? "Alle Abos und Verträge sind als „bewusst so“ markiert."
      : "Abos und Verträge laufen weiter, bis sie gekündigt werden. Aufs Jahr gerechnet sieht man, was sie zusammen kosten." +
        (groups.length === 0
          ? ""
          : ` Mehrere Posten haben dieselbe Art: ${quoted(groups.map((group) => group.contractType))}.`);
  return {
    type: "subscriptions",
    status,
    reason,
    monthlyCents,
    yearlyCents: yearlyCents(monthlyCents),
    steps: [...sums, ...groupNotes, ...noticeNotes],
    items,
    sameTypeGroups: groups,
  };
}

function lowNecessityHint(items: HintItem[]): Hint {
  const { steps: sums, monthlyCents } = sumSteps(items, "Würde im Monat frei", "Würde im Jahr frei");
  const status: HintStatus = items.some(counts) ? "open" : "waived";
  return {
    type: "lowNecessity",
    status,
    reason:
      status === "waived"
        ? "Alle Posten der beiden unteren Notwendigkeitsstufen sind als „bewusst so“ markiert."
        : "Diese Posten stehen in den beiden unteren Notwendigkeitsstufen. Fielen sie weg, würde dieser Betrag frei.",
    monthlyCents,
    yearlyCents: yearlyCents(monthlyCents),
    steps: sums,
    items,
    sameTypeGroups: [],
  };
}

/**
 * Alle Hinweise. Es zählen nur aktive Ausgaben, keine Rücklagen. Ein Posten
 * kann in beiden Hinweisen stehen (ein Abo mit niedriger Notwendigkeit); die
 * Beträge verschiedener Hinweise darf man deshalb nicht addieren.
 */
export function buildHints(input: FinanceInput): HintsModel {
  const expenses = input.budgetItems.filter((item) => item.active && item.kind === "expense");
  const subscriptions = hintItems(expenses.filter(isSubscription), input.today);
  const low = hintItems(
    expenses.filter((item) => LOW_NECESSITIES.includes(item.necessity)),
    input.today,
  );
  const hints: Hint[] = [];
  if (subscriptions.length > 0) hints.push(subscriptionsHint(subscriptions));
  if (low.length > 0) hints.push(lowNecessityHint(low));
  return { today: input.today, hints };
}
