# Datenschicht

> **Zweck:** Wie die App Antworten des Backends liest, welche Zustände es gibt und wie der Vertragstest arbeitet.

## Eine Schnittstelle

`FinanceRepository` liefert je Ansicht einen `Flow<ViewState<Modell>>` und bekommt den heutigen Kalendertag in Stevens Zeitzone (Convex speichert Abfragen zwischen, eine Uhr im Server wäre falsch). `todayFlow` liefert den Tag und wechselt um Mitternacht, das ViewModel fragt dann neu. Hinter der Schnittstelle sitzt später der Convex-Client mit dem Clerk-Token. Heute gibt es:

- `FakeFinanceRepository` (`src/debug`): liest JSON aus den Assets, Szenario wählbar,
- `NotConnectedFinanceRepository` (Release): immer `Error(NOT_CONNECTED)`.

## Modelle

`data/model/` spiegelt `convex/lib/views.ts` und `convex/lib/metric.ts` aus dem Backend (PR #2, Stand `bffc0bc`): `OverviewModel`, `BudgetModel`, `DebtsModel`, `UpcomingModel` und die Kennzahl `Metric` mit Wert, Art, Status, Datenalter und Rechenweg (`Step`). `debtSchedule` (Tilgungsplan eines Kredits) ist noch nicht abgebildet. Alle Modelle sind `@Serializable` (kotlinx.serialization):

- Geld ist `Long` in Cent, Anteile `Int` in Basispunkten. Kein `Float`, kein `Double`.
- Tage und Monate sind `LocalDate` und `YearMonth` (Format `JJJJ-MM-TT`, `JJJJ-MM`). Ein ungültiges Datum ist ein Lesefehler, kein Absturz.
- Enums tragen die Namen des Backends per `@SerialName`. Ein unbekannter Wert lässt sich nicht lesen, es wird nie still ein Standard angenommen.
- Im Betrieb ignoriert `FinanceJson.lenient` unbekannte Felder. Der Vertragstest liest streng.
- `salaryStatus` (`SalaryStatus.SET`/`MISSING`) in `OverviewModel` und `UpcomingModel` ist ein Pflichtfeld ohne Standardwert: Fehlt es, ist die Antwort unlesbar, die App nimmt nie still „gesetzt“ an. Bei `MISSING` haben „Bis Gehalt verfügbar“, Tagesrahmen und „Fällig bis zum Gehalt“ keine Zahl; die Ansichten zeigen dort ruhig „Gehaltstag eintragen“. Der Kontostand bleibt sichtbar.

## Zustände

`ViewState` ist ein `sealed interface`: `Loading`, `Empty`, `Error(kind)`, `Data(model)`, `Stale(model, fetchedAt, reason)`. „Veraltet“ meint hier den letzten bekannten Stand ohne frische Daten (zum Beispiel ohne Netz). Davon getrennt ist das Alter der Zahlen selbst: Es steht im Modell (`Metric.status = stale`, `Stand.stale`) und erscheint als Datenalter-Chip. `ErrorKind` enthält nie Beträge, Namen oder Tokens.

`Empty` entscheidet das Modell (`OverviewModel.isEmpty`, `BudgetStatus.EMPTY`, keine Kredite), nicht die App. „Demnächst“ ist nie `Empty`: Ein fehlender Gehaltstag steht im Modell, die Ansicht sagt „Es fehlt: Gehaltstag“.

## Vertragstest

`src/test/resources/vertrag/<ansicht>-<szenario>.json` sind **Ausgaben des echten Rechenkerns** (`toWire(buildOverview(...))` usw.) für die ausgedachten Testdaten des Backends, in fünf Szenarien: `standard`, `leer`, `negativ`, `veraltet`, `ohne-gehaltstag` (Standarddaten ohne Gehaltstag). Erzeugt mit `scripts/vertragsbeispiele.ts`; der Kopf der Datei erklärt den Aufruf, im selben Repo oder mit einem Backend-Worktree als Quelle, ohne diesen zu ändern. Stand der Beispiele: Backend-Commit `bffc0bc` (PR #2).

`VertragsTest` liest jede Datei **streng**, prüft Kernzahlen gegen die Erwartungen der Convex-Tests (zum Beispiel 904,30 € bis Gehalt, Tagesrahmen 53,19 €), dass negative Stände negativ bleiben, dass „leer“ nichts erfindet, und dass unbekannte Felder und Statuswerte erkannt werden. Ergänzt das Backend ein Feld, schlägt der Test fehl, bis das Modell es kennt.

Die int64-Werte stehen in den Beispielen als JSON-Zahl (Cent liegen weit unter 2^53). Wie der Convex-Client int64 an Kotlin liefert, ist noch nicht geprüft; die Zuordnung gehört in die spätere Convex-Implementierung des Repositories, die Modelle bleiben gleich.
