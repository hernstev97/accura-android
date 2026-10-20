import type { Auth } from "convex/server";
import { ConvexError, type ObjectType, type PropertyValidators } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isCalendarDay, type CalendarDay } from "./lib/calendar";

/**
 * Zugriffsschutz für alle öffentlichen Funktionen.
 *
 * Öffentliche Queries und Mutations entstehen ausschließlich über
 * `ownerQuery` und `ownerMutation`. Beide prüfen bei jedem Aufruf
 *  1. ein gültiges Clerk-Token (Convex validiert die Signatur anhand von
 *     `auth.config.ts`, hier wird nur geprüft, dass es eins gibt) und
 *  2. dass die Clerk-Kennung (`subject`) der erlaubten Kennung aus der
 *     Umgebungsvariable `ALLOWED_CLERK_SUBJECT` entspricht.
 * Ist die Variable nicht gesetzt, wird alles abgewiesen.
 *
 * Wartung und Import gehören in `internalQuery`/`internalMutation` und sind
 * für die App nicht aufrufbar. Ein Test (`access.test.ts`) bricht, wenn eine
 * öffentliche Funktion am Wrapper vorbei registriert wird.
 */

export const ALLOWED_SUBJECT_ENV = "ALLOWED_CLERK_SUBJECT";

export type AccessErrorCode = "unauthenticated" | "forbidden" | "invalid_argument";

/** Fehler ohne Beträge, Namen oder Tokens; die App unterscheidet nur nach `code`. */
export function accessError(code: AccessErrorCode, field?: string): ConvexError<{ code: AccessErrorCode; field?: string }> {
  return new ConvexError(field === undefined ? { code } : { code, field });
}

export type Owner = {
  /** Clerk-Nutzerkennung (`sub`). */
  subject: string;
  /** `issuer|subject`, so wie in `users.clerkTokenIdentifier` gespeichert. */
  tokenIdentifier: string;
  /** Datensatz des Nutzers; `null`, bis `users:ensureUser` einmal lief. */
  user: Doc<"users"> | null;
};

/** Alle öffentlichen Funktionen, die den Wrapper durchlaufen haben. Nur für den Test. */
export const wrappedPublicFunctions = new WeakSet<object>();

export async function requireOwner(ctx: { auth: Auth; db: QueryCtx["db"] }): Promise<Owner> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw accessError("unauthenticated");

  const allowed = process.env[ALLOWED_SUBJECT_ENV];
  if (allowed === undefined || allowed === "") {
    // Ohne konfigurierte Kennung bleibt alles zu. Der Hinweis nennt keine Daten.
    console.error(`${ALLOWED_SUBJECT_ENV} ist nicht gesetzt, alle Aufrufe werden abgewiesen.`);
    throw accessError("forbidden");
  }
  if (identity.subject !== allowed) throw accessError("forbidden");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("clerkTokenIdentifier", identity.tokenIdentifier))
    .unique();
  return { subject: identity.subject, tokenIdentifier: identity.tokenIdentifier, user };
}

export type OwnerQueryCtx = { db: QueryCtx["db"]; owner: Owner };
export type OwnerMutationCtx = { db: MutationCtx["db"]; owner: Owner };

export function ownerQuery<Args extends PropertyValidators, Result>(config: {
  args: Args;
  handler: (ctx: OwnerQueryCtx, args: ObjectType<Args>) => Promise<Result> | Result;
}) {
  const registered = query({
    args: config.args,
    handler: async (ctx, args: ObjectType<Args>) => {
      const owner = await requireOwner(ctx);
      return await config.handler({ db: ctx.db, owner }, args);
    },
  });
  wrappedPublicFunctions.add(registered);
  return registered;
}

export function ownerMutation<Args extends PropertyValidators, Result>(config: {
  args: Args;
  handler: (ctx: OwnerMutationCtx, args: ObjectType<Args>) => Promise<Result> | Result;
}) {
  const registered = mutation({
    args: config.args,
    handler: async (ctx, args: ObjectType<Args>) => {
      const owner = await requireOwner(ctx);
      return await config.handler({ db: ctx.db, owner }, args);
    },
  });
  wrappedPublicFunctions.add(registered);
  return registered;
}

/** Prüft ein Datum aus einem Argument; die Abfrage hat keine Uhr, der Aufrufer liefert den Tag. */
export function requireCalendarDay(value: string, field: string): CalendarDay {
  if (!isCalendarDay(value)) throw accessError("invalid_argument", field);
  return value;
}
