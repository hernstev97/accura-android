import { v } from "convex/values";
import { accessError, ownerMutation } from "./access";
import { dayOfMonth, MAX_TIME_ZONE_LENGTH, nullable, optionalCents, requireSeen, requireUser } from "./editing";
import { isValidTimeZone } from "./lib/calendar";
import { settingsFields } from "./lib/fields";

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

const settings = { monthlyIncomeCents: nullable(v.int64()), salaryDay: nullable(v.int64()), homeTimeZone: v.string() };

/**
 * Einkommen, Gehaltstag und Heimatzeitzone setzen. `null` heißt „nicht
 * erfasst“; die abhängigen Kennzahlen sind dann nicht berechenbar.
 * `expected`: die Einstellungen, wie die App sie gezeigt hat.
 */
export const updateSettings = ownerMutation({
  args: { ...settings, expected: v.object(settings) },
  handler: async (ctx, args) => {
    const user = requireUser(ctx);
    const monthlyIncomeCents = optionalCents(args.monthlyIncomeCents, "monthlyIncomeCents");
    const salaryDay = dayOfMonth(args.salaryDay, "salaryDay");
    if (args.homeTimeZone.length > MAX_TIME_ZONE_LENGTH || !isValidTimeZone(args.homeTimeZone)) {
      throw accessError("invalid_argument", "homeTimeZone");
    }
    requireSeen("settings", null, settingsFields(user), args.expected);
    await ctx.db.patch(user._id, { monthlyIncomeCents, salaryDay, homeTimeZone: args.homeTimeZone });
    return null;
  },
});
