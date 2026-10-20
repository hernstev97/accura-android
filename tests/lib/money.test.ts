import { describe, expect, it } from "vitest";
import { addCents, floorDiv, floorMulDiv, monthlyInterestCents, mulDivRound, ratioBps, splitBps, splitWholePercent, sumCents } from "../../convex/lib/money";
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

describe("Anteile, die sich auf 100 % summieren", () => {
  it("lässt exakte Anteile unverändert", () => {
    expect(splitBps([50_000, 25_000, 25_000], 100_000)).toEqual([5_000, 2_500, 2_500]);
  });

  it("gibt einen fehlenden Basispunkt (Drittel) dem größten Anteil: 3.333 × 3 = 9.999", () => {
    // Einzeln gerundet: 3.333 + 3.333 + 3.333 = 9.999. Gleichstand: der erste ist der größte.
    expect(splitBps([10_000, 10_000, 10_000], 30_000)).toEqual([3_334, 3_333, 3_333]);
  });

  it("nimmt einen überzähligen Basispunkt vom größten Anteil: 7.167 + 1.355 + 1.000 + 479 = 10.001", () => {
    expect(ratioBps(215_000, 300_000)! + ratioBps(40_645, 300_000)! + ratioBps(30_000, 300_000)! + ratioBps(14_355, 300_000)!).toBe(10_001);
    expect(splitBps([215_000, 40_645, 30_000, 14_355], 300_000)).toEqual([7_166, 1_355, 1_000, 479]);
  });

  it("verteilt auch einen Rest von −2 auf den größten Anteil, nicht auf die halben Werte", () => {
    // Echte Anteile 4.999,5 / 2.500,5 / 2.499,5 / 0,5 – jeder halbe Wert rundet auf: 5.000 + 2.501 + 2.500 + 1 = 10.002.
    expect(splitBps([9_999, 5_001, 4_999, 1], 20_000)).toEqual([4_998, 2_501, 2_500, 1]);
  });

  it("gibt bei Gleichstand dem ersten der größten Anteile den Rest", () => {
    expect(splitBps([0, 10_000, 10_000, 10_000], 30_000)).toEqual([0, 3_334, 3_333, 3_333]);
  });

  it("verträgt einen negativen Anteil, die Summe bleibt 100 %", () => {
    // Einkommen 300,01 €: überplant um 99,99 €, der freie Anteil ist negativ.
    const shares = splitBps([200_000, 100_000, 100_000, -99_999], 300_001);
    expect(shares.reduce((sum, share) => sum! + share!, 0)).toBe(10_000);
    expect(shares[3]).toBeLessThan(0);
  });

  it("summiert für viele Aufteilungen immer genau auf 10.000 und weicht höchstens 2 Basispunkte von der Einzelrundung ab", () => {
    let seed = 12_345;
    const next = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % max;
    };
    for (let run = 0; run < 2_000; run++) {
      const parts = [next(200_000), next(100_000), next(50_000), next(80_000)];
      const whole = parts.reduce((sum, part) => sum + part, 0);
      if (whole === 0) continue;
      const shares = splitBps(parts, whole)!;
      expect(shares.reduce((sum, share) => sum! + share!, 0)).toBe(10_000);
      parts.forEach((part, index) => expect(Math.abs(shares[index]! - ratioBps(part, whole)!)).toBeLessThanOrEqual(2));
    }
  });

  it("erfindet keinen Anteil ohne positive Bezugsgröße", () => {
    expect(splitBps([100, 200], 0)).toEqual([null, null]);
    expect(splitBps([100, 200], -5)).toEqual([null, null]);
    expect(splitBps([], 100)).toEqual([]);
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

describe("Ganze Prozent, die sich auf 100 summieren (größter Rest)", () => {
  it("Standarddaten: einzeln gerundet 72 + 14 + 10 + 5 = 101, mit größtem Rest 72 + 13 + 10 + 5 = 100", () => {
    // Echte Anteile 71,67 % / 13,55 % / 10,00 % / 4,79 %.
    const parts = [215_000, 40_645, 30_000, 14_355];
    expect(parts.map((part) => mulDivRound(part, 100, 300_000))).toEqual([72, 14, 10, 5]);
    expect(splitWholePercent(parts, 300_000)).toEqual([72, 13, 10, 5]);
  });

  it("gibt bei Dritteln den fehlenden Punkt dem ersten bei Gleichstand: 34 + 33 + 33", () => {
    expect(splitWholePercent([10_000, 10_000, 10_000], 30_000)).toEqual([34, 33, 33]);
  });

  it("lässt exakte Anteile unverändert", () => {
    expect(splitWholePercent([50_000, 25_000, 25_000, 0], 100_000)).toEqual([50, 25, 25, 0]);
  });

  it("rundet nie einen Anteil um mehr als einen Punkt von seinem echten Wert weg", () => {
    let seed = 4_242;
    const next = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % max;
    };
    for (let run = 0; run < 2_000; run++) {
      const parts = [next(200_000), next(100_000), next(50_000), next(80_000)];
      const whole = parts.reduce((sum, part) => sum + part, 0);
      if (whole === 0) continue;
      const shares = splitWholePercent(parts, whole);
      expect(shares.reduce((sum, share) => sum! + share!, 0)).toBe(100);
      parts.forEach((part, index) => {
        const exact = (part * 100) / whole;
        expect(Math.abs(shares[index]! - exact)).toBeLessThan(1);
      });
    }
  });

  it("verträgt einen negativen Anteil wie splitBps, die Summe bleibt 100", () => {
    const shares = splitWholePercent([200_000, 100_000, 100_000, -99_999], 300_001);
    expect(shares.reduce((sum, share) => sum! + share!, 0)).toBe(100);
    expect(shares[3]).toBeLessThan(0);
  });

  it("erfindet keinen Anteil ohne positive Bezugsgröße", () => {
    expect(splitWholePercent([100, 200], 0)).toEqual([null, null]);
    expect(splitWholePercent([], 100)).toEqual([]);
  });
});
