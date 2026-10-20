import { ConvexError, v, type Validator } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { accessError, type OwnerMutationCtx, type OwnerQueryCtx } from "./access";
import { isCalendarDay, type CalendarDay } from "./lib/calendar";
import { sameFields, type FieldSet } from "./lib/fields";

/**
 * Gemeinsame Bausteine der schreibenden Funktionen: Fehler, Prüfungen der
 * Eingaben, Besitz und Konfliktschutz. Keine Convex-Funktionen, nur Helfer.
 *
 * Fehler sind `ConvexError` mit `{ code, field? }`. Sie nennen keine Beträge,
 * Namen oder Kennungen. Einzige Ausnahme ist `conflict`: Dort stehen die
 * aktuellen Werte in `data.conflicts`, damit die App sie anzeigen kann; der
 * Fehlertext (`message`, landet in Logs) ist nur „conflict“.
 */

export type EditErrorCode =
  /** Ein Argument ist ungültig, oder die Kennung gehört nicht dem Nutzer. `field` nennt das Argument. */
  | "invalid_argument"
  /** Es gibt noch keinen Nutzer-Datensatz, erst `users:ensureUser` aufrufen. */
  | "user_missing"
  /** Der gespeicherte Stand weicht vom gesehenen (`expected`) ab. Es wurde nichts gespeichert. */
  | "conflict"
  /** Es gibt schon einen Stand nach dem übergebenen Tag. Meist stimmt Datum oder Zeitzone des Geräts nicht. */
  | "date_conflict"
  /** Ein Konto mit aktiven Pockets lässt sich nicht archivieren. */
  | "has_active_pockets"
  /** Ein aktives Pocket braucht ein aktives Konto. */
  | "account_archived";

export function editError(code: Exclude<EditErrorCode, "conflict">, field?: string) {
  return new ConvexError(field === undefined ? { code } : { code, field });
}

export const invalid = (field: string) => accessError("invalid_argument", field);

export type ConflictEntity =
  | "settings"
  | "account"
  | "pocket"
  | "budgetItem"
  | "debt"
  | "householdMember"
  | "accountStand"
  | "pocketStand"
  | "debtStand";

export type Conflict = {
  entity: ConflictEntity;
  /** Kennung des Datensatzes (bei Ständen: des Kontos, Pockets oder Kredits); `null` bei den Einstellungen. */
  id: string | null;
  /** Aktuelle Werte; bei Ständen `null`, wenn es noch keinen Stand gibt. */
  current: FieldSet | null;
};

export function conflictError(conflicts: Conflict[]) {
  const error = new ConvexError({ code: "conflict" as const, conflicts });
  // Standardmäßig wäre der Text die JSON-Fassung der Daten, also mit Beträgen.
  error.message = "conflict";
  return error;
}

/** Bricht mit `conflict` ab, wenn die gespeicherten Werte nicht den gesehenen entsprechen. */
export function requireSeen(entity: ConflictEntity, id: string | null, current: FieldSet, expected: FieldSet): void {
  if (!sameFields(current, expected)) throw conflictError([{ entity, id, current }]);
}

export function requireUser(ctx: OwnerMutationCtx): Doc<"users"> {
  if (ctx.owner.user === null) throw editError("user_missing");
  return ctx.owner.user;
}

type OwnedTable = "accounts" | "pockets" | "budgetItems" | "debts" | "householdMembers";

/**
 * Lädt einen Datensatz des angemeldeten Nutzers. Fremde und unbekannte
 * Kennungen ergeben denselben Fehler, damit die Antwort nicht verrät, ob es
 * den Datensatz gibt.
 */
export async function ownedRecord<T extends OwnedTable>(
  ctx: OwnerQueryCtx | OwnerMutationCtx,
  id: Id<T>,
  field: string,
): Promise<Doc<T>> {
  const doc = await ctx.db.get(id);
  if (doc === null || ctx.owner.user === null || doc.userId !== ctx.owner.user._id) throw invalid(field);
  return doc;
}

export function nullable<T, F extends string>(validator: Validator<T, "required", F>) {
  return v.union(validator, v.null());
}

// ------------------------------------------------------------ Grenzen

export const MAX_NAME_LENGTH = 80;
export const MAX_CATEGORY_LENGTH = 40;
export const MAX_NOTE_LENGTH = 1_000;
export const MAX_TIME_ZONE_LENGTH = 64;
/** Höchster Betrag in Cent: eine Milliarde Euro. Hält jede Summe weit im sicheren Bereich. */
export const MAX_AMOUNT_CENTS = 100_000_000_000n;
export const MAX_ORDER = 1_000_000n;
export const MAX_DAILY_KCAL = 10_000n;
/** Höchstens so viele Stände je Liste in einem Durchgang. */
export const MAX_STANDS_PER_LIST = 100;

// Steuerzeichen, Zeilen- und Absatztrenner. Notizen dürfen Zeilenumbrüche (\n) enthalten.
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/;

// ------------------------------------------------------------ Prüfungen

/** Pflichttext: ohne Leerzeichen am Rand, nicht leer, höchstens `max` Zeichen, einzeilig. */
export function requiredText(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > max || SINGLE_LINE_FORBIDDEN.test(trimmed)) throw invalid(field);
  return trimmed;
}

/** Freiwilliger Text: leer oder `null` wird zu „nicht gesetzt“ (`undefined`). */
export function optionalText(
  value: string | null | undefined,
  field: string,
  max: number,
  multiline = false,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > max || (multiline ? MULTI_LINE_FORBIDDEN : SINGLE_LINE_FORBIDDEN).test(trimmed)) throw invalid(field);
  return trimmed;
}

export function intInRange(value: bigint, field: string, min: bigint, max: bigint): bigint {
  if (value < min || value > max) throw invalid(field);
  return value;
}

export function optionalIntInRange(value: bigint | null | undefined, field: string, min: bigint, max: bigint): bigint | undefined {
  return value === null || value === undefined ? undefined : intInRange(value, field, min, max);
}

/** Betrag in Cent ab 0. */
export const cents = (value: bigint, field: string) => intInRange(value, field, 0n, MAX_AMOUNT_CENTS);

export const optionalCents = (value: bigint | null | undefined, field: string) =>
  optionalIntInRange(value, field, 0n, MAX_AMOUNT_CENTS);

/** Kontostände dürfen negativ sein (Dispo). */
export const signedCents = (value: bigint, field: string) => intInRange(value, field, -MAX_AMOUNT_CENTS, MAX_AMOUNT_CENTS);

export const dayOfMonth = (value: bigint | null | undefined, field: string) => optionalIntInRange(value, field, 1n, 31n);

export function calendarDay(value: string, field: string): CalendarDay {
  if (!isCalendarDay(value)) throw invalid(field);
  return value;
}

export function optionalCalendarDay(value: string | null | undefined, field: string): CalendarDay | undefined {
  return value === null || value === undefined ? undefined : calendarDay(value, field);
}

export const order = (value: bigint, field = "order") => intInRange(value, field, 0n, MAX_ORDER);

/** Reihenfolge für einen neuen Datensatz: hinter allen vorhandenen. */
export function nextOrder(rows: readonly { order: bigint }[]): bigint {
  const max = rows.reduce((highest, row) => (row.order > highest ? row.order : highest), 0n);
  return max >= MAX_ORDER ? MAX_ORDER : max + 1n;
}
