import { describe, expect, it } from "vitest";
import { MAX_ORDER, nextOrder, optionalText, requiredText } from "../convex/editing";
import { isPlausibleToday } from "../convex/lib/calendar";
import { sameFields } from "../convex/lib/fields";

const invalid = (field: string) => expect.objectContaining({ data: { code: "invalid_argument", field } });

describe("Texte", () => {
  it("entfernt Leerzeichen am Rand und nimmt Umlaute und Emoji an", () => {
    expect(requiredText("  Bäckerei Müller 🥐 ", "label", 80)).toBe("Bäckerei Müller 🥐");
  });

  it.each([
    ["leer", ""],
    ["nur Leerzeichen", "   "],
    ["zu lang", "x".repeat(81)],
    ["Zeilenumbruch", "a\nb"],
    ["Tabulator", "a\tb"],
    ["Nullzeichen", "a\u0000b"],
    ["Zeilentrenner", "a\u2028b"],
  ])("lehnt einen Pflichttext ab: %s", (_label, value) => {
    expect(() => requiredText(value, "label", 80)).toThrow(invalid("label"));
  });

  it("lässt genau die Höchstlänge zu", () => {
    expect(requiredText("x".repeat(80), "label", 80)).toHaveLength(80);
  });

  it("macht aus leerem freiwilligem Text „nicht gesetzt“", () => {
    expect(optionalText(null, "note", 10)).toBeUndefined();
    expect(optionalText(undefined, "note", 10)).toBeUndefined();
    expect(optionalText("  ", "note", 10)).toBeUndefined();
    expect(optionalText(" a ", "note", 10)).toBe("a");
  });

  it("erlaubt Zeilenumbrüche nur in mehrzeiligen Texten", () => {
    expect(optionalText("Zeile 1\nZeile 2", "note", 100, true)).toBe("Zeile 1\nZeile 2");
    expect(() => optionalText("Zeile 1\nZeile 2", "contractType", 100)).toThrow(invalid("contractType"));
    expect(() => optionalText("a\rb", "note", 100, true)).toThrow(invalid("note"));
  });
});

describe("Reihenfolge für neue Datensätze", () => {
  it("kommt hinter alle vorhandenen, auch archivierte", () => {
    expect(nextOrder([])).toBe(1n);
    expect(nextOrder([{ order: 3n }, { order: 7n }, { order: 0n }])).toBe(8n);
  });

  it("bleibt in der erlaubten Spanne", () => {
    expect(nextOrder([{ order: MAX_ORDER }])).toBe(MAX_ORDER);
  });
});

describe("Vergleich gesehener Werte", () => {
  it("vergleicht int64 nach Wert und unterscheidet null von einem fehlenden Feld", () => {
    expect(sameFields({ a: 1n, b: null, c: "x", d: true }, { a: BigInt(1), b: null, c: "x", d: true })).toBe(true);
    expect(sameFields({ a: 1n }, { a: 2n })).toBe(false);
    expect(sameFields({ a: null }, {})).toBe(false);
    expect(sameFields({ a: 1n }, { a: 1n, b: 1n })).toBe(false);
    expect(sameFields(null, null)).toBe(true);
    expect(sameFields(null, { a: 1n })).toBe(false);
  });

  it("vergleicht Texte genau", () => {
    expect(sameFields({ a: "Miete" }, { a: "miete" })).toBe(false);
    expect(sameFields({ a: "Miete" }, { a: "Miete " })).toBe(false);
  });
});

describe("Plausibler Tag für einen Stand", () => {
  const at = (iso: string) => new Date(iso).getTime();

  it.each([
    ["2026-08-07", "2026-08-08T10:00:00Z", true],
    ["2026-08-08", "2026-08-08T10:00:00Z", true],
    ["2026-08-09", "2026-08-08T10:00:00Z", true],
    ["2026-08-06", "2026-08-08T10:00:00Z", false],
    ["2026-08-10", "2026-08-08T10:00:00Z", false],
    // Kiribati (UTC+14) ist schon am nächsten Tag, Baker Island (UTC−12) noch am vorigen.
    ["2026-08-09", "2026-08-08T23:59:00Z", true],
    ["2026-08-07", "2026-08-08T00:01:00Z", true],
    // Jahres- und Schaltjahreswechsel
    ["2027-01-01", "2026-12-31T12:00:00Z", true],
    ["2028-02-29", "2028-03-01T00:30:00Z", true],
    ["2028-02-28", "2028-03-01T00:30:00Z", false],
  ])("%s um %s: %s", (day, now, expected) => {
    expect(isPlausibleToday(day, at(now))).toBe(expected);
  });

  it("lehnt ungültige Tage und eine ungültige Uhr ab", () => {
    expect(isPlausibleToday("2026-02-30", at("2026-02-28T12:00:00Z"))).toBe(false);
    expect(isPlausibleToday("2026-08-08", Number.NaN)).toBe(false);
  });
});
