import { v } from "convex/values";
import { accessError, ownerMutation } from "./access";
import { hintFingerprint } from "./lib/hints";
import { budgetItemInput } from "./lib/load";

/**
 * „Bewusst so“ für einen Budgetposten setzen (`waived: true`) oder
 * zurücknehmen (`waived: false`). Gespeichert wird der Zeitpunkt und der
 * Stand des Postens; ändert sich der Posten später, zählt er in den Hinweisen
 * wieder mit, ohne dass eine andere Funktion daran denken muss.
 *
 * Ein fremder oder unbekannter Posten ergibt denselben Fehler, damit die
 * Antwort nicht verrät, ob es ihn gibt.
 */
export const setWaived = ownerMutation({
  args: { budgetItemId: v.id("budgetItems"), waived: v.boolean() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.budgetItemId);
    if (item === null || ctx.owner.user === null || item.userId !== ctx.owner.user._id) {
      throw accessError("invalid_argument", "budgetItemId");
    }
    await ctx.db.patch(
      item._id,
      args.waived
        ? { waivedHintAt: BigInt(Date.now()), waivedHintFingerprint: hintFingerprint(budgetItemInput(item)) }
        : { waivedHintAt: undefined, waivedHintFingerprint: undefined },
    );
    return { waived: args.waived };
  },
});
