# Zugriffsschutz

Quelle: `convex/access.ts`, `convex/auth.config.ts`. Getestet in `tests/access.test.ts`.

## Ablauf bei jedem öffentlichen Aufruf

1. Convex prüft das Clerk-Token anhand von `auth.config.ts` (Aussteller und `applicationID: "convex"`). Ohne gültiges Token gibt es keine Identität.
2. `requireOwner` verlangt eine Identität, sonst Fehler `unauthenticated`.
3. Die Kennung der Identität (`subject`, die Clerk-Nutzer-ID) muss der Umgebungsvariable `ALLOWED_CLERK_SUBJECT` entsprechen, sonst Fehler `forbidden`. Ist die Variable nicht gesetzt oder leer, wird **alles** abgewiesen.
4. Erst danach läuft die eigentliche Funktion. Sie bekommt `ctx.owner` (Kennung, `tokenIdentifier` und den `users`-Datensatz oder `null`).

Fehler sind `ConvexError` mit `{ code }` (`unauthenticated`, `forbidden`, `invalid_argument` mit `field`). Sie enthalten keine Kennungen, Beträge, Namen oder Tokens. Die schreibenden Funktionen haben weitere Codes ([bearbeiten.md](bearbeiten.md#fehlercodes)); nur `conflict` trägt Werte, und zwar die aktuellen Werte des eigenen Datensatzes für die Anzeige.

## Regeln für Funktionen

- Öffentliche Queries und Mutations entstehen nur über `ownerQuery` und `ownerMutation`. Öffentliche Actions gibt es nicht.
- Wartung und Import sind `internalQuery`/`internalMutation` (zum Beispiel `maintenance:seedAnonymousData`) und für die App nicht aufrufbar.
- Jedes Argument hat einen Validator (`v.string()`, `v.id("…")`, Ganzzahlen als `v.int64()`). Kein Argument nennt einen Besitzer. Kalendertage prüft zusätzlich `requireCalendarDay` bzw. `calendarDay` (Format und Existenz, `2026-02-31` wird abgewiesen), Längen und Wertebereiche prüfen die Helfer in `convex/editing.ts`.
- Der Test `tests/access.test.ts` lädt alle Module und bricht, wenn
  - eine öffentliche Funktion nicht über den Wrapper entstanden ist,
  - eine öffentliche Action existiert,
  - eine öffentliche Funktion nicht in der Tabelle der Zugriffstests steht. Dort läuft sie ohne Anmeldung (muss `unauthenticated` sein), mit fremdem Konto (`forbidden`), ohne gesetzte Variable (`forbidden`) und mit dem Besitzer (läuft durch).
- Alle Tabellen tragen `userId`. Abfragen lesen nur Zeilen des angemeldeten Nutzers; `debtSchedule` gibt für Kredite fremder Nutzer `null` zurück.
- `hints:setWaived` ändert nur Posten des angemeldeten Nutzers. Fremde, gelöschte und unbekannte Posten ergeben denselben Fehler (`invalid_argument`, Feld `budgetItemId`), damit die Antwort nicht verrät, ob es den Posten gibt.
- Dasselbe gilt für alle schreibenden Funktionen (`ownedRecord` in `convex/editing.ts`): Eine fremde Kennung ergibt `invalid_argument` mit dem Namen des Arguments. `records:list` und `dataExport:all` lesen nur über den Index mit `userId` des angemeldeten Nutzers.

## Einrichtung pro Deployment

Der Besitzer ist pro Deployment ein anderer Clerk-Nutzer (Development- und Production-Instance haben getrennte Nutzer-IDs):

```sh
npx convex env set ALLOWED_CLERK_SUBJECT user_…      # Dev (deployment dev/main)
npx convex env set ALLOWED_CLERK_SUBJECT user_… --prod   # Produktion, nur auf Auftrag
```

`auth.config.ts` listet beide Clerk-Aussteller (`https://daring-troll-2105.clerk.accounts.dev` für Development, `https://clerk.accura.kiumu.app` für Production). Jedes Deployment akzeptiert damit Tokens beider Instanzen; durch die Kennungsprüfung kommt trotzdem nur der eine konfigurierte Nutzer durch. Die Convex-Integration im Clerk-Dashboard (Token mit Zielgruppe `convex`) ist Voraussetzung dafür, dass überhaupt Tokens ankommen.

`ALLOW_DEMO_SEED=true` darf nur im Dev-Deployment gesetzt sein, wenn `maintenance:seedAnonymousData` laufen soll.

## Grenzen

- Geprüft ist die Kennung `subject`, nicht der Aussteller. Zwei Instanzen mit gleicher Nutzer-ID wären nicht unterscheidbar; Clerk vergibt die IDs je Instanz eindeutig.
- Es gibt keine Ratenbegrenzung und keine Sperrliste. Bei einem Besitzer genügt die Kennungsprüfung; Clerk begrenzt Anmeldeversuche.
