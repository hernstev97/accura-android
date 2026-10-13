/**
 * Geld ist immer eine ganze Zahl in Cent (sicherer Integer). Kommazahlen
 * kommen nirgends vor. Multiplikation mit anschließender Division läuft über
 * BigInt, damit keine Zwischenwerte die 2^53-Grenze sprengen.
 */

export function assertSafeInteger(value: number, what: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${what} muss eine ganze Zahl sein.`);
  return value;
}

export function addCents(left: number, right: number): number {
  return assertSafeInteger(left + right, "Summe");
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total = addCents(total, value);
  return total;
}

function toSafeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Ergebnis überschreitet den sicheren Zahlenbereich.");
  return result;
}

/** floor(a * b / c) für c > 0, exakt. */
export function floorMulDiv(a: number, b: number, c: number): number {
  if (c <= 0) throw new Error("Teiler muss positiv sein.");
  const numerator = BigInt(a) * BigInt(b);
  const divisor = BigInt(c);
  let quotient = numerator / divisor;
  if (numerator % divisor !== 0n && numerator < 0n) quotient -= 1n;
  return toSafeNumber(quotient);
}

/**
 * round(a * b / c) für c > 0, exakt. Halbe Werte runden von null weg
 * (2,5 → 3, -2,5 → -3). Das ist die einzige Rundungsregel für Cents.
 */
export function mulDivRound(a: number, b: number, c: number): number {
  if (c <= 0) throw new Error("Teiler muss positiv sein.");
  const numerator = BigInt(a) * BigInt(b);
  const divisor = BigInt(c);
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  let quotient = magnitude / divisor;
  if ((magnitude % divisor) * 2n >= divisor) quotient += 1n;
  return toSafeNumber(negative ? -quotient : quotient);
}

export function floorDiv(a: number, c: number): number {
  return floorMulDiv(a, 1, c);
}

/** Anteil in Basispunkten (10.000 = 100 %); `null` ohne positive Bezugsgröße. */
export function ratioBps(part: number, whole: number): number | null {
  return whole > 0 ? mulDivRound(part, 10_000, whole) : null;
}

/** Monatszins in Cent: Restschuld × Jahreszins ÷ 12, gerundet auf ganze Cent. */
export function monthlyInterestCents(balanceCents: number, nominalRateBps: number): number {
  return mulDivRound(balanceCents, nominalRateBps, 120_000);
}
