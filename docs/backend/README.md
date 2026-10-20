# Backend (Convex)

Stand: Phase 2, Teil Backend. Beschrieben ist, was gebaut ist. Plan und Hintergründe: [../neubau/plan.md](../neubau/plan.md).

| Thema | Seite |
| --- | --- |
| Tabellen, Typen, Abweichungen vom Plan | [schema.md](schema.md) |
| Prüfung von Token und Konto, interne Funktionen | [zugriffsschutz.md](zugriffsschutz.md) |
| Rechenregeln, Kennzahlen, Antwortformat der Ansichten | [rechenregeln.md](rechenregeln.md) |

## Aufbau

```
convex/
  schema.ts, auth.config.ts   Tabellen, Clerk-Aussteller
  access.ts                   gemeinsamer Wrapper für alle öffentlichen Funktionen
  views.ts                    Abfragen je Ansicht (overview, budget, debts, debtSchedule, upcoming)
  users.ts                    ensureUser
  maintenance.ts              nur intern: anonyme Testdaten in ein Dev-Deployment
  lib/                        reiner Rechenkern, kennt Convex nur in load.ts und seed.ts
  _generated/                 von `npx convex dev` erzeugt, eingecheckt
tests/                        Vitest (Rechenkern, Zugriff, Abfragen mit convex-test)
```

Die Tests liegen bewusst außerhalb von `convex/`: Convex bündelt jede Datei in `convex/` als Modul.

## Befehle

```sh
npm ci
npm run check        # Typecheck (tsc) und Vitest
npx convex dev --once   # gegen das Dev-Deployment pushen und convex/_generated aktualisieren
```

`CONVEX_DEPLOYMENT=dev:jovial-chickadee-454` steht in der nicht eingecheckten `.env.local`. Wer Funktionen hinzufügt oder umbenennt, führt `npx convex dev --once` aus und checkt `convex/_generated` mit ein, sonst schlägt der Typecheck in der CI fehl. In die Produktion deployt nur Steven oder auf seinen Auftrag.

CI: [.github/workflows/convex.yml](../../.github/workflows/convex.yml) führt Typecheck und Tests aus. Sie deployt nichts.
