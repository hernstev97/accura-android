import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { anonymousInput } from "./lib/fixtures";
import { seedFinanceInput } from "./lib/seed";
import { DEFAULT_HOME_TIME_ZONE } from "./users";

/**
 * Wartung: nur intern, die App kann diese Funktionen nicht aufrufen. Aufruf
 * über `npx convex run maintenance:seedAnonymousData '{"tokenIdentifier":"…"}'`.
 */

/**
 * Füllt ein Entwicklungs-Deployment mit den anonymen Testdaten, damit die
 * App ohne Ersterfassung etwas zeigt. Sicherung gegen Verwechslung: läuft nur,
 * wenn im Deployment `ALLOW_DEMO_SEED=true` gesetzt ist (nie in der Produktion),
 * und nur für einen Nutzer, den es noch nicht gibt.
 */
export const seedAnonymousData = internalMutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("ALLOW_DEMO_SEED ist nicht gesetzt.");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("clerkTokenIdentifier", args.tokenIdentifier))
      .unique();
    if (existing !== null) throw new Error("Für diese Kennung gibt es schon Daten.");

    const input = anonymousInput();
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      clerkTokenIdentifier: args.tokenIdentifier,
      homeTimeZone: DEFAULT_HOME_TIME_ZONE,
      monthlyIncomeCents: BigInt(input.incomeCents ?? 0),
      salaryDay: BigInt(input.salaryDay ?? 1),
      createdAt: BigInt(now),
    });
    await seedFinanceInput(ctx.db, userId, input, now);
    return null;
  },
});
