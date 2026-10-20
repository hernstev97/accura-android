import { v } from "convex/values";
import { ownerQuery, requireCalendarDay } from "./access";
import { loadFinanceInput } from "./lib/load";
import { buildBudget, buildDebtSchedule, buildDebts, buildOverview, buildUpcoming } from "./lib/views";
import { toWire } from "./lib/wire";

/**
 * Eine Abfrage je Ansicht. Alle erwarten den heutigen Kalendertag in Stevens
 * Zeitzone als Argument ("YYYY-MM-DD"): Convex speichert Abfragen zwischen, eine
 * Uhr in der Abfrage würde falsche Ergebnisse festhalten. Die App liefert den
 * Tag und fragt neu, wenn er wechselt.
 */

export const overview = ownerQuery({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const today = requireCalendarDay(args.today, "today");
    return toWire(buildOverview(await loadFinanceInput(ctx.db, ctx.owner.user, today)));
  },
});

export const budget = ownerQuery({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const today = requireCalendarDay(args.today, "today");
    return toWire(buildBudget(await loadFinanceInput(ctx.db, ctx.owner.user, today)));
  },
});

export const debts = ownerQuery({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const today = requireCalendarDay(args.today, "today");
    return toWire(buildDebts(await loadFinanceInput(ctx.db, ctx.owner.user, today)));
  },
});

/** Tilgungsplan eines einzelnen Kredits; `null`, wenn es ihn nicht gibt oder seine Vertragsdaten ungültig sind. */
export const debtSchedule = ownerQuery({
  args: { today: v.string(), debtId: v.id("debts") },
  handler: async (ctx, args) => {
    const today = requireCalendarDay(args.today, "today");
    const debt = await ctx.db.get(args.debtId);
    if (debt === null || ctx.owner.user === null || debt.userId !== ctx.owner.user._id) return null;
    const model = buildDebtSchedule(await loadFinanceInput(ctx.db, ctx.owner.user, today), args.debtId);
    return model === null ? null : toWire(model);
  },
});

export const upcoming = ownerQuery({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const today = requireCalendarDay(args.today, "today");
    return toWire(buildUpcoming(await loadFinanceInput(ctx.db, ctx.owner.user, today)));
  },
});
