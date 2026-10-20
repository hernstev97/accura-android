# Backend (Convex)

Stand: Phase 2, Teil Backend, die Einspar-Hinweise aus Phase 3 ohne Lebensmittel-Richtwert und aus Phase 4 das Bearbeiten mit Konfliktschutz, Stände und Export (ohne Vorlagen). Beschrieben ist, was gebaut ist. Plan und Hintergründe: [../neubau/plan.md](../neubau/plan.md).

| Thema | Seite |
| --- | --- |
| Tabellen, Typen, Abweichungen vom Plan | [schema.md](schema.md) |
| Prüfung von Token und Konto, interne Funktionen | [zugriffsschutz.md](zugriffsschutz.md) |
| Rechenregeln, Kennzahlen, Einspar-Hinweise, Antwortformat der Ansichten | [rechenregeln.md](rechenregeln.md) |
| Anlegen, Ändern, Archivieren, Stände, Konfliktschutz, Export | [bearbeiten.md](bearbeiten.md) |

## Aufbau

```
convex/
  schema.ts, auth.config.ts   Tabellen, Clerk-Aussteller
  access.ts                   gemeinsamer Wrapper für alle öffentlichen Funktionen
  views.ts                    Abfragen je Ansicht (overview, budget, debts, debtSchedule, upcoming, hints)
  users.ts                    ensureUser, updateSettings
  hints.ts                    setWaived („bewusst so“ für Einspar-Hinweise)
  accounts.ts, pockets.ts,    create, update, setActive je Datensatzart
  budgetItems.ts, debts.ts,
  household.ts
  stands.ts                   record (Stände, einzeln oder „Stände aktualisieren“)
  records.ts                  list (alle Datensätze zum Bearbeiten)
  dataExport.ts               all (Export aller eigenen Daten)
  editing.ts                  Helfer: Prüfungen, Besitz, Konfliktschutz, Fehlercodes
  maintenance.ts              nur intern: anonyme Testdaten in ein Dev-Deployment
  lib/                        reiner Rechenkern, kennt Convex nur in load.ts, seed.ts und fields.ts
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
