# convex/

Backend und Rechenkern in TypeScript. Doku: [../docs/backend/](../docs/backend/README.md).

- `access.ts`: gemeinsamer Wrapper (`ownerQuery`, `ownerMutation`) für alle öffentlichen Funktionen. Keine öffentliche Funktion ohne Wrapper, ein Test prüft das.
- `views.ts`: eine Abfrage je Ansicht, `today` kommt als Argument.
- `hints.ts`: „bewusst so“ für Einspar-Hinweise (`hints:setWaived`).
- `accounts.ts`, `pockets.ts`, `budgetItems.ts`, `debts.ts`, `household.ts`, `stands.ts`, `users.ts`: Anlegen, Ändern, Archivieren und Stände, jede Änderung mit `expected` (Konfliktschutz). Helfer in `editing.ts`. Doku: [bearbeiten.md](../docs/backend/bearbeiten.md).
- `records.ts`: alle Datensätze zum Bearbeiten; `dataExport.ts`: Export aller eigenen Daten.
- `lib/`: reiner Rechenkern ohne Convex-Abhängigkeit (außer `load.ts`, `seed.ts` und den Feldsätzen in `fields.ts`).
- Tests liegen in `../tests/`, nicht hier, weil Convex jede Datei in diesem Ordner bündelt.
- `_generated/` entsteht durch `npx convex dev --once` und wird eingecheckt.

Das Deployment steht in `.env.local` (nicht eingecheckt): `CONVEX_DEPLOYMENT=dev:jovial-chickadee-454`. Die Produktion fasst nur Steven an.
