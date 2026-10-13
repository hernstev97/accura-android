/**
 * Grenze zwischen Rechenkern und Convex: Der Kern rechnet mit sicheren
 * Integern (`number`), Convex speichert und liefert alle Ganzzahlen als int64
 * (`bigint`). Kommazahlen gibt es weder in der Datenbank noch in Antworten.
 */

/** int64 aus der Datenbank in eine sichere Zahl für den Rechenkern. */
export function fromInt64(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Gespeicherte Zahl ist außerhalb des sicheren Bereichs.");
  return result;
}

export function fromOptionalInt64(value: bigint | undefined): number | null {
  return value === undefined ? null : fromInt64(value);
}

export function toInt64(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new Error("Wert ist keine ganze Zahl.");
  return BigInt(value);
}

export type Wire<T> = T extends number
  ? bigint
  : T extends string | boolean | null | bigint
    ? T
    : T extends readonly (infer U)[]
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;

/**
 * Wandelt eine Antwort für den Client: jede Zahl muss ganz sein und wird zu
 * int64. Eine Kommazahl ist ein Programmfehler und bricht ab, statt still
 * gerundet auszugehen.
 */
export function toWire<T>(value: T): Wire<T> {
  return convert(value) as Wire<T>;
}

function convert(value: unknown): unknown {
  if (typeof value === "number") return toInt64(value);
  if (Array.isArray(value)) return value.map(convert);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) result[key] = convert(entry);
    }
    return result;
  }
  return value;
}
