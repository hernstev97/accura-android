# convex/

Backend und Rechenkern in TypeScript. Doku: [../docs/backend/](../docs/backend/README.md).

- `access.ts`: gemeinsamer Wrapper (`ownerQuery`, `ownerMutation`) für alle öffentlichen Funktionen. Keine öffentliche Funktion ohne Wrapper, ein Test prüft das.
- `views.ts`: eine Abfrage je Ansicht, `today` kommt als Argument.
- `lib/`: reiner Rechenkern ohne Convex-Abhängigkeit (außer `load.ts` und `seed.ts`).
- Tests liegen in `../tests/`, nicht hier, weil Convex jede Datei in diesem Ordner bündelt.
- `_generated/` entsteht durch `npx convex dev --once` und wird eingecheckt.

Das Deployment steht in `.env.local` (nicht eingecheckt): `CONVEX_DEPLOYMENT=dev:jovial-chickadee-454`. Die Produktion fasst nur Steven an.
