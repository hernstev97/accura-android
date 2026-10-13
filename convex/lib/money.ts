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

/**
 * Anteile am Ganzen in Basispunkten, die sich exakt auf 10.000 summieren.
 * Jeder Anteil wird kaufmännisch gerundet (`ratioBps`); der Rest nach dem
 * Runden (meist −2 bis +2) geht an den größten Anteil, bei Gleichstand an den
 * ersten. Ohne positive Bezugsgröße sind alle Anteile `null`.
 */
export function splitBps(parts: readonly number[], whole: number): (number | null)[] {
  if (whole <= 0) return parts.map(() => null);
  const shares = parts.map((part) => mulDivRound(part, 10_000, whole));
  if (parts.length === 0) return shares;
  const rest = 10_000 - sumCents(shares);
  let largest = 0;
  parts.forEach((part, index) => {
    if (part > parts[largest]!) largest = index;
  });
  shares[largest] = shares[largest]! + rest;
  return shares;
}

/**
 * Ganze Prozent je Anteil, die sich auf genau 100 summieren (Verfahren des größten Rests): alle
 * Anteile abrunden, die fehlenden Prozentpunkte gehen an die Anteile mit dem größten Rest, bei
 * Gleichstand an den früheren. So wird 71,66 % zu 72 % und nicht zu 71 %, wie es „Rest an den
 * größten Anteil“ täte. Mit einem negativen Anteil, oder wenn die Anteile nicht genau die
 * Bezugsgröße ergeben, gilt die Regel von [splitBps]: einzeln runden, Rest an den größten Anteil.
 * Ohne positive Bezugsgröße gibt es keine Anteile.
 */
export function splitWholePercent(parts: readonly number[], whole: number): (number | null)[] {
  if (whole <= 0) return parts.map(() => null);
  if (parts.length === 0) return [];
  const exact = parts.every((part) => part >= 0) && sumCents(parts) === whole;
  if (!exact) {
    const shares = parts.map((part) => mulDivRound(part, 100, whole));
    let largest = 0;
    parts.forEach((part, index) => {
      if (part > parts[largest]!) largest = index;
    });
    shares[largest] = shares[largest]! + 100 - sumCents(shares);
    return shares;
  }
  const shares = parts.map((part) => floorMulDiv(part, 100, whole));
  const remainders = parts.map((part, index) => part * 100 - shares[index]! * whole);
  const order = parts.map((_, index) => index).sort((a, b) => remainders[b]! - remainders[a]! || a - b);
  const missing = 100 - sumCents(shares);
  for (let k = 0; k < missing; k++) shares[order[k]!] = shares[order[k]!]! + 1;
  return shares;
}

/** Monatszins in Cent: Restschuld × Jahreszins ÷ 12, gerundet auf ganze Cent. */
export function monthlyInterestCents(balanceCents: number, nominalRateBps: number): number {
  return mulDivRound(balanceCents, nominalRateBps, 120_000);
}
