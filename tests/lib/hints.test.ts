import { describe, expect, it } from "vitest";
import { anonymousInput, TODAY } from "../../convex/lib/fixtures";
import { buildHints, hintFingerprint, type Hint, type HintType } from "../../convex/lib/hints";
import type { BudgetItemInput, FinanceInput } from "../../convex/lib/input";
import { emptyInput } from "../../convex/lib/load";
import { toWire } from "../../convex/lib/wire";

/** Ausgedachte Posten; Beträge in Cent pro Monat. */
const item = (
  id: string,
  label: string,
  monthlyAmountCents: number,
  necessity: BudgetItemInput["necessity"],
  category: string,
  extra: Partial<BudgetItemInput> = {},
): BudgetItemInput => ({
  id,
  label,
  monthlyAmountCents,
  necessity,
  kind: "expense",
  category,
  dueDay: null,
  contractType: null,
  contractEndDay: null,
  noticePeriodDays: null,
  noticePeriodMonths: null,
  waivedHintFingerprint: null,
  order: 1,
  active: true,
  ...extra,
});

const withItems = (...items: BudgetItemInput[]): FinanceInput => ({ ...emptyInput(TODAY), budgetItems: items });
const hint = (input: FinanceInput, type: HintType): Hint | undefined => buildHints(input).hints.find((h) => h.type === type);
/** „Bewusst so“ für den heutigen Stand des Postens. */
const waived = (entry: BudgetItemInput): BudgetItemInput => ({ ...entry, waivedHintFingerprint: hintFingerprint(entry) });

const streamingA = item("stream-a", "Streaming A", 1_299, "optional", "Abo", { contractType: "Streaming", order: 1 });
const streamingB = item("stream-b", "Streaming B", 999, "optional", "Abo", { contractType: "streaming ", order: 2 });
const music = item("music", "Musik", 1_099, "worthwhile", "Abo", { contractType: "Musik", order: 3 });
const phone = item("phone", "Handy", 2_000, "necessary", "Vertrag", { order: 4, contractEndDay: "2026-12-31", noticePeriodMonths: 3 });
const rent = item("rent", "Miete", 90_000, "essential", "Wohnen", { order: 5 });
const gifts = item("gifts", "Geschenke", 5_000, "unnecessary", "Freizeit", { order: 6 });

describe("Einspar-Hinweise: leer und ohne Anlass", () => {
  it("ohne Daten gibt es keinen Hinweis", () => {
    expect(buildHints(emptyInput(TODAY))).toEqual({ today: TODAY, hints: [] });
  });

  it("ohne Abos und ohne niedrige Notwendigkeit gibt es keinen Hinweis", () => {
    expect(buildHints(withItems(rent, item("food", "Lebensmittel", 40_000, "essential", "Lebensmittel"))).hints).toEqual([]);
  });

  it("keine Abos, aber niedrige Notwendigkeit: nur dieser Hinweis", () => {
    expect(buildHints(withItems(rent, gifts)).hints.map((h) => h.type)).toEqual(["lowNecessity"]);
  });

  it("zählt keine inaktiven Posten und keine Rücklagen", () => {
    const input = withItems(
      { ...streamingA, active: false },
      item("reserve", "Rücklage Urlaub", 10_000, "optional", "Abo", { kind: "reserve" }),
    );
    expect(buildHints(input).hints).toEqual([]);
  });
});

describe("Hinweis „Abos und Verträge“", () => {
  const input = withItems(phone, rent, music, streamingB, streamingA, gifts);

  it("nimmt alle Posten der Kategorie Abo oder Vertrag, niedrigste Notwendigkeit zuerst", () => {
    const subscriptions = hint(input, "subscriptions")!;
    expect(subscriptions.items.map((i) => [i.label, i.necessity])).toEqual([
      ["Streaming A", "optional"],
      ["Streaming B", "optional"],
      ["Musik", "worthwhile"],
      ["Handy", "necessary"],
    ]);
  });

  it("rechnet die Jahreskosten exakt: Monatsbetrag mal 12", () => {
    const subscriptions = hint(input, "subscriptions")!;
    expect(subscriptions.items.map((i) => [i.monthlyCents, i.yearlyCents])).toEqual([
      [1_299, 15_588],
      [999, 11_988],
      [1_099, 13_188],
      [2_000, 24_000],
    ]);
    // 12,99 + 9,99 + 10,99 + 20,00 = 53,97 € im Monat, 647,64 € im Jahr
    expect(subscriptions).toMatchObject({ status: "open", monthlyCents: 5_397, yearlyCents: 64_764 });
  });

  it("legt den Rechenweg offen: jeder Posten, Summe pro Monat, mal 12, Summe pro Jahr", () => {
    const { steps } = hint(input, "subscriptions")!;
    expect(steps.map((s) => [s.op, s.label, s.cents ?? s.count ?? s.day])).toEqual([
      ["plus", "Streaming A", 1_299],
      ["plus", "Streaming B", 999],
      ["plus", "Musik", 1_099],
      ["plus", "Handy", 2_000],
      ["result", "Abos und Verträge im Monat", 5_397],
      ["note", "Monate im Jahr", 12],
      ["result", "Abos und Verträge im Jahr", 64_764],
      ["note", "Gleiche Art „Streaming“: Streaming A, Streaming B", 2],
      ["note", "Letzter Kündigungstag: Handy", "2026-09-30"],
    ]);
  });

  it("lässt mehrere Abos derselben Art auffallen, ohne Groß- und Kleinschreibung und Leerzeichen am Rand", () => {
    const subscriptions = hint(input, "subscriptions")!;
    expect(subscriptions.sameTypeGroups).toEqual([
      { contractType: "Streaming", itemIds: ["stream-a", "stream-b"], monthlyCents: 2_298, yearlyCents: 27_576 },
    ]);
    expect(subscriptions.reason).toContain("„Streaming“");
    expect(subscriptions.items.find((i) => i.id === "stream-b")!.contractType).toBe("streaming");
  });

  it("eine Art allein, ein leerer Text oder keine Art fallen nicht auf", () => {
    const subscriptions = hint(
      withItems(music, { ...streamingA, contractType: "  " }, { ...streamingB, contractType: null }),
      "subscriptions",
    )!;
    expect(subscriptions.sameTypeGroups).toEqual([]);
    expect(subscriptions.items.map((i) => i.contractType)).toEqual([null, null, "Musik"]);
    expect(subscriptions.reason).not.toContain("dieselbe Art");
  });

  it("erkennt die Kategorien Abo und Vertrag auch klein oder mit Leerzeichen, aber nichts anderes", () => {
    const subscriptions = hint(
      withItems(
        item("a", "A", 100, "optional", " abo "),
        item("b", "B", 100, "optional", "VERTRAG"),
        item("c", "C", 100, "optional", "Abos"),
        item("d", "D", 100, "optional", "Versicherung"),
      ),
      "subscriptions",
    )!;
    expect(subscriptions.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("gleiche Notwendigkeit: höherer Betrag zuerst, dann Reihenfolge im Budget, dann Kennung", () => {
    const subscriptions = hint(
      withItems(
        item("z", "Zeitschrift", 500, "optional", "Abo", { order: 1 }),
        item("c", "Cloud", 999, "optional", "Abo", { order: 9 }),
        item("y", "Hörbuch", 500, "optional", "Abo", { order: 1 }),
        item("x", "App", 500, "optional", "Abo", { order: 0 }),
      ),
      "subscriptions",
    )!;
    expect(subscriptions.items.map((i) => i.id)).toEqual(["c", "x", "y", "z"]);
  });

  it("ordnet alle fünf Stufen von unnötig bis existenziell", () => {
    const subscriptions = hint(
      withItems(
        item("e", "E", 100, "essential", "Abo"),
        item("n", "N", 100, "necessary", "Abo"),
        item("w", "W", 100, "worthwhile", "Abo"),
        item("o", "O", 100, "optional", "Abo"),
        item("u", "U", 100, "unnecessary", "Abo"),
      ),
      "subscriptions",
    )!;
    expect(subscriptions.items.map((i) => i.id)).toEqual(["u", "o", "w", "n", "e"]);
  });

  it("nennt den letzten Kündigungstag, wenn Vertragsende und Frist erfasst sind", () => {
    const handy = hint(input, "subscriptions")!.items.find((i) => i.id === "phone")!;
    expect(handy.cancellation).toMatchObject({ state: "open", lastNoticeDay: "2026-09-30", daysUntilLastNoticeDay: 53 });
    expect(hint(input, "subscriptions")!.items.find((i) => i.id === "music")!.cancellation).toBeNull();
  });

  it("Kündigungstag schon vorbei: steht so im Rechenweg", () => {
    const later = { ...input, today: "2026-10-01" };
    const subscriptions = hint(later, "subscriptions")!;
    expect(subscriptions.items.find((i) => i.id === "phone")!.cancellation).toMatchObject({ state: "passed", daysUntilLastNoticeDay: -1 });
    expect(subscriptions.steps.at(-1)).toMatchObject({ op: "note", label: "Letzter Kündigungstag vorbei: Handy", day: "2026-09-30" });
  });

  it("Posten mit Betrag 0 (etwa ein Probeabo) bleiben sichtbar, wegen des Kündigungstags", () => {
    const trial = item("trial", "Probeabo", 0, "optional", "Abo", { contractEndDay: "2026-08-31", noticePeriodDays: 7 });
    const subscriptions = hint(withItems(trial), "subscriptions")!;
    expect(subscriptions).toMatchObject({ monthlyCents: 0, yearlyCents: 0, status: "open" });
    expect(subscriptions.items[0]!.cancellation).toMatchObject({ lastNoticeDay: "2026-08-24" });
  });
});

describe("Hinweis „Niedrige Notwendigkeit“", () => {
  it("summiert die beiden unteren Stufen: so viel würde frei, wenn sie wegfielen", () => {
    const low = hint(withItems(rent, music, streamingA, gifts, phone), "lowNecessity")!;
    // Geschenke 50,00 € + Streaming A 12,99 € = 62,99 € im Monat, 755,88 € im Jahr; Musik ist „sinnvoll“ und zählt nicht.
    expect(low).toMatchObject({ status: "open", monthlyCents: 6_299, yearlyCents: 75_588, sameTypeGroups: [] });
    expect(low.items.map((i) => i.label)).toEqual(["Geschenke", "Streaming A"]);
    expect(low.steps.map((s) => [s.op, s.label, s.cents ?? s.count])).toEqual([
      ["plus", "Geschenke", 5_000],
      ["plus", "Streaming A", 1_299],
      ["result", "Würde im Monat frei", 6_299],
      ["note", "Monate im Jahr", 12],
      ["result", "Würde im Jahr frei", 75_588],
    ]);
  });

  it("ein Abo mit niedriger Notwendigkeit steht in beiden Hinweisen", () => {
    const { hints } = buildHints(withItems(streamingA));
    expect(hints.map((h) => [h.type, h.items.map((i) => i.id)])).toEqual([
      ["subscriptions", ["stream-a"]],
      ["lowNecessity", ["stream-a"]],
    ]);
  });

  it("gleiche Notwendigkeit und gleicher Betrag: Reihenfolge im Budget", () => {
    const low = hint(
      withItems(
        item("b", "Kino", 2_000, "optional", "Freizeit", { order: 2 }),
        item("a", "Bücher", 2_000, "optional", "Freizeit", { order: 1 }),
      ),
      "lowNecessity",
    )!;
    expect(low.items.map((i) => i.label)).toEqual(["Bücher", "Kino"]);
  });
});

describe("„Bewusst so“", () => {
  it("ein ausgeblendeter Posten zählt in keinem Hinweis mit und steht als Notiz im Rechenweg", () => {
    const input = withItems(waived(streamingA), streamingB, gifts);
    const subscriptions = hint(input, "subscriptions")!;
    expect(subscriptions.items.map((i) => [i.id, i.status])).toEqual([
      ["stream-a", "waived"],
      ["stream-b", "open"],
    ]);
    expect(subscriptions).toMatchObject({ status: "open", monthlyCents: 999, yearlyCents: 11_988 });
    expect(subscriptions.steps[0]).toMatchObject({ op: "note", label: "Streaming A: bewusst so, zählt nicht mit", cents: null });
    // Nur noch ein Streaming-Abo zählt: keine Gruppe mehr.
    expect(subscriptions.sameTypeGroups).toEqual([]);
    expect(hint(input, "lowNecessity")).toMatchObject({ monthlyCents: 5_999 });
  });

  it("sind alle Posten ausgeblendet, ist der Hinweis ausgeblendet, kommt aber weiter mit", () => {
    const subscriptions = hint(withItems(waived(streamingA), waived(streamingB)), "subscriptions")!;
    expect(subscriptions).toMatchObject({ status: "waived", monthlyCents: 0, yearlyCents: 0 });
    expect(subscriptions.items.map((i) => [i.status, i.monthlyCents])).toEqual([
      ["waived", 1_299],
      ["waived", 999],
    ]);
    expect(subscriptions.reason).toBe("Alle Abos und Verträge sind als „bewusst so“ markiert.");
  });

  it("ausgeblendet und dann Betrag geändert: der Hinweis ist wieder da", () => {
    const priceUp = { ...waived(streamingA), monthlyAmountCents: 1_499 };
    const subscriptions = hint(withItems(priceUp), "subscriptions")!;
    expect(subscriptions.items[0]).toMatchObject({ status: "reopened", monthlyCents: 1_499, yearlyCents: 17_988 });
    expect(subscriptions).toMatchObject({ status: "open", monthlyCents: 1_499 });
  });

  it.each<[string, Partial<BudgetItemInput>]>([
    ["Notwendigkeit", { necessity: "worthwhile" }],
    ["Kategorie", { category: "Vertrag" }],
    ["Art", { contractType: "Film" }],
    ["Vertragsende", { contractEndDay: "2027-06-30" }],
    ["Kündigungsfrist", { noticePeriodDays: 14 }],
  ])("auch eine geänderte %s holt den Hinweis zurück", (_name, change) => {
    const subscriptions = hint(withItems({ ...waived(streamingA), ...change }), "subscriptions")!;
    expect(subscriptions.items[0]!.status).toBe("reopened");
  });

  it.each<[string, Partial<BudgetItemInput>]>([
    ["Name", { label: "Streaming Familie" }],
    ["Reihenfolge", { order: 7 }],
    ["Fälligkeitstag", { dueDay: 3 }],
  ])("ein geänderter %s lässt ihn ausgeblendet", (_name, change) => {
    expect(hint(withItems({ ...waived(streamingA), ...change }), "subscriptions")!.items[0]!.status).toBe("waived");
  });

  it("ein ausgeblendeter Posten, der nicht mehr in die Stufen fällt, verschwindet ganz", () => {
    const moved = { ...waived(gifts), necessity: "necessary" as const };
    expect(buildHints(withItems(moved)).hints).toEqual([]);
  });
});

describe("Texte und Antwortformat", () => {
  const all = buildHints(withItems(phone, music, streamingA, streamingB, gifts, waived(item("w", "W", 100, "optional", "Abo"))));

  it("nennen keine Beträge, damit ausgeblendete Beträge verborgen bleiben", () => {
    for (const h of all.hints) expect(h.reason).not.toMatch(/\d/);
    for (const h of buildHints(withItems(waived(streamingA))).hints) expect(h.reason).not.toMatch(/\d/);
  });

  it("die Standarddaten liefern beide Hinweise", () => {
    const model = buildHints(anonymousInput());
    expect(model.hints.map((h) => [h.type, h.monthlyCents, h.yearlyCents, h.items.map((i) => i.label)])).toEqual([
      ["subscriptions", 10_000, 120_000, ["Fitness", "Abos"]],
      ["lowNecessity", 15_000, 180_000, ["Geschenke", "Fitness", "Abos"]],
    ]);
    expect(model.hints[0]!.items[0]!.cancellation).toMatchObject({ lastNoticeDay: "2026-11-30", daysUntilLastNoticeDay: 114 });
  });

  it("lässt sich ohne Kommazahl in int64 wandeln", () => {
    expect(() => toWire(all)).not.toThrow();
    expect(() => toWire(buildHints(anonymousInput()))).not.toThrow();
  });

  it("bricht bei Jahresbeträgen außerhalb des sicheren Bereichs ab, statt still zu runden", () => {
    expect(() => buildHints(withItems(item("huge", "Groß", Number.MAX_SAFE_INTEGER, "optional", "Abo")))).toThrow();
  });
});
