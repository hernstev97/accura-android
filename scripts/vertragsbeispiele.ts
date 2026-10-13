/**
 * Erzeugt die Vertragsbeispiele der App (app/src/test/resources/vertrag/*.json) aus dem echten Rechenkern:
 * je Ansicht und Szenario die Antwort von `toWire(build…(input))` als JSON.
 *
 * Voraussetzung: der Backend-Stand mit `convex/lib/` (PR #2) und `npm ci`. Aufruf aus dem Repo-Wurzelordner:
 *   npx esbuild scripts/vertragsbeispiele.ts --bundle --platform=node --format=esm --outfile=/tmp/vertrag.mjs \
 *     && node /tmp/vertrag.mjs app/src/test/resources/vertrag
 * Danach laufen die Vertragstests der App (`./gradlew :app:testDebugUnitTest`); ändern sich die Antworten,
 * müssen die Kotlin-Modelle in `app/.../data/model/` mitziehen.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { anonymousInput, TODAY } from "../convex/lib/fixtures";
import type { FinanceInput } from "../convex/lib/input";
import { buildBudget, buildDebts, buildOverview, buildUpcoming } from "../convex/lib/views";
import { toWire } from "../convex/lib/wire";

const out = process.argv[2]!;
mkdirSync(out, { recursive: true });

const standard = (): FinanceInput => {
  const input = anonymousInput();
  input.debts[0]!.anchor = { day: "2026-07-25", balanceCents: 852_500, payoffQuoteCents: 860_000, recordedDay: "2026-07-26" };
  return input;
};
const scenarios: Record<string, () => FinanceInput> = {
  standard,
  leer: () => ({ today: TODAY, incomeCents: null, salaryDay: null, accounts: [], pockets: [], budgetItems: [], debts: [] }),
  negativ: () => {
    const input = standard();
    input.incomeCents = 150_000;
    input.accounts[0]!.stand = { day: TODAY, cents: -39_834, recordedDay: TODAY };
    return input;
  },
  veraltet: () => {
    const input = standard();
    for (const a of input.accounts) if (a.stand) a.stand = { day: "2026-07-01", cents: a.stand.cents, recordedDay: "2026-07-01" };
    for (const p of input.pockets) if (p.stand) p.stand = { day: "2026-07-01", cents: p.stand.cents, recordedDay: "2026-07-01" };
    input.debts[0]!.anchor = { day: "2026-04-20", balanceCents: 900_000, payoffQuoteCents: null, recordedDay: "2026-04-20" };
    return input;
  },
};
const views = { overview: buildOverview, budget: buildBudget, debts: buildDebts, upcoming: buildUpcoming };

// Convex liefert int64; als JSON schreiben wir sie als Zahl (Cent liegen weit unter 2^53).
for (const [scenario, make] of Object.entries(scenarios)) {
  for (const [view, build] of Object.entries(views)) {
    const wire = toWire(build(make()));
    const json = JSON.stringify(wire, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2);
    writeFileSync(`${out}/${view}-${scenario}.json`, json + "\n");
  }
}
