import { describe, expect, it } from "vitest";
import { addCents, floorDiv, floorMulDiv, monthlyInterestCents, mulDivRound, ratioBps, sumCents } from "../../convex/lib/money";
import { fromInt64, toInt64, toWire } from "../../convex/lib/wire";

describe("Rundung auf ganze Cent", () => {
  it("rundet halbe Werte von null weg", () => {
    expect(mulDivRound(5, 1, 2)).toBe(3);
    expect(mulDivRound(-5, 1, 2)).toBe(-3);
    expect(mulDivRound(1, 1, 2)).toBe(1);
    expect(mulDivRound(-1, 1, 2)).toBe(-1);
    expect(mulDivRound(4, 1, 3)).toBe(1);
    expect(mulDivRound(5, 1, 3)).toBe(2);
    expect(mulDivRound(0, 7, 3)).toBe(0);
  });

  it("rundet knapp unter der Hälfte ab", () => {
    expect(mulDivRound(499, 1, 1000)).toBe(0);
    expect(mulDivRound(500, 1, 1000)).toBe(1);
  });

  it("rechnet Zwischenwerte über 2^53 exakt", () => {
    const big = 9_000_000_000_000_000;
    expect(mulDivRound(big, 10_000, big)).toBe(10_000);
    expect(mulDivRound(4_500_000_000_000_000, 10_000, big)).toBe(5_000);
  });

  it("weigert sich bei Ergebnissen außerhalb des sicheren Bereichs und bei Teiler 0", () => {
    expect(() => mulDivRound(Number.MAX_SAFE_INTEGER, 10, 1)).toThrow();
    expect(() => mulDivRound(1, 1, 0)).toThrow();
    expect(() => mulDivRound(1, 1, -2)).toThrow();
  });

  it("rundet für Abrundung zum kleineren Wert, auch bei Minus", () => {
    expect(floorMulDiv(7, 1, 2)).toBe(3);
    expect(floorMulDiv(-7, 1, 2)).toBe(-4);
    expect(floorMulDiv(-8, 1, 2)).toBe(-4);
    expect(floorDiv(90_430, 17)).toBe(5_319);
    expect(floorDiv(-1, 17)).toBe(-1);
  });
});

describe("Anteile in Basispunkten", () => {
  it("rundet kaufmännisch", () => {
    expect(ratioBps(14_132, 259_132)).toBe(545);
    expect(ratioBps(245_000, 259_132)).toBe(9_455);
    expect(ratioBps(245_000, 245_000)).toBe(10_000);
    expect(ratioBps(1, 3)).toBe(3_333);
  });

  it("erfindet keinen Anteil ohne positive Bezugsgröße", () => {
    expect(ratioBps(100, 0)).toBeNull();
    expect(ratioBps(100, -50)).toBeNull();
  });

  it("lässt negative Anteile negativ", () => {
    expect(ratioBps(-14_500, 100_000)).toBe(-1_450);
  });
});

describe("Zins und Summen", () => {
  it("berechnet den Monatszins gerundet", () => {
    expect(monthlyInterestCents(1_200_000, 500)).toBe(5_000);
    expect(monthlyInterestCents(100_000, 1_200)).toBe(1_000);
    expect(monthlyInterestCents(66_998, 1_200)).toBe(670); // 669,98
    expect(monthlyInterestCents(33_666, 1_200)).toBe(337); // 336,66
    expect(monthlyInterestCents(1_000_000, 0)).toBe(0);
    expect(monthlyInterestCents(0, 500)).toBe(0);
  });

  it("summiert exakt und bricht bei Überlauf ab", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([100, -250, 1])).toBe(-149);
    expect(() => addCents(Number.MAX_SAFE_INTEGER, 1)).toThrow();
    expect(() => sumCents([0.5])).toThrow(); // Kommazahlen sind kein Geld
  });
});

describe("Grenze zu Convex (int64)", () => {
  it("wandelt alle Ganzzahlen in bigint, auch verschachtelt", () => {
    expect(toWire({ a: 5, b: [1, { c: -2 }], d: "x", e: null, f: true, g: 3n })).toEqual({
      a: 5n,
      b: [1n, { c: -2n }],
      d: "x",
      e: null,
      f: true,
      g: 3n,
    });
  });

  it("lässt undefined weg", () => {
    expect(toWire({ a: 1, b: undefined })).toEqual({ a: 1n });
  });

  it("lehnt Kommazahlen und unsichere Zahlen ab", () => {
    expect(() => toWire({ a: 0.5 })).toThrow();
    expect(() => toWire({ a: [Number.NaN] })).toThrow();
    expect(() => toWire({ a: Number.MAX_SAFE_INTEGER + 2 })).toThrow();
    expect(() => toInt64(1.5)).toThrow();
  });

  it("liest int64 nur im sicheren Bereich", () => {
    expect(fromInt64(123n)).toBe(123);
    expect(fromInt64(-5n)).toBe(-5);
    expect(() => fromInt64(2n ** 60n)).toThrow();
  });
});
