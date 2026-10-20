import { v } from "convex/values";
import { accessError, ownerMutation } from "./access";
import { isValidTimeZone } from "./lib/calendar";

/** Standard-Heimatzeitzone, bis Steven sie ändert. Eine Annahme, keine Messung. */
export const DEFAULT_HOME_TIME_ZONE = "Europe/Berlin";

/**
 * Legt den Datensatz des angemeldeten Besitzers an, falls es ihn noch nicht
 * gibt. Einkommen und Gehaltstag bleiben leer, bis Steven sie erfasst.
 * Mehrfaches Aufrufen ist harmlos.
 */
export const ensureUser = ownerMutation({
  args: { homeTimeZone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (ctx.owner.user !== null) return { created: false };
    const homeTimeZone = args.homeTimeZone ?? DEFAULT_HOME_TIME_ZONE;
    if (!isValidTimeZone(homeTimeZone)) throw accessError("invalid_argument", "homeTimeZone");
    await ctx.db.insert("users", {
      clerkTokenIdentifier: ctx.owner.tokenIdentifier,
      homeTimeZone,
      createdAt: BigInt(Date.now()),
    });
    return { created: true };
  },
});
