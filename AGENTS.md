# AGENTS.md

Regeln für Agenten in diesem Repo. Plan und Hintergründe: [docs/neubau/plan.md](docs/neubau/plan.md).

## Über Steven und die Zusammenarbeit

- Ich bin Steven, du bist der Agent. Ich war bis 2022 Entwickler, bin wieder dabei. accura soll mir helfen, meine Finanzen zu überblicken. Nur ich nutze die App.
- Kommuniziere direkt, ohne Vorrede. Erkläre größere technische Entscheidungen mit Grund und Alternativen und triff sie nicht stillschweigend.
- Ich gebe Produkt und UX vor. Sag klar, wenn eine Idee technische, finanzielle oder sicherheitsrelevante Probleme macht.
- Eine Frage will eine Antwort, keine Änderung. Analyse und Prüfung erlauben keine Umsetzung der Funde.
- Verschweige keine fehlgeschlagene oder nicht ausgeführte Prüfung.
- Einfach vor clever. YAGNI und KISS. Keine Abstraktion und keine Abhängigkeit für hypothetischen Bedarf.

## Sprache

- Doku, Commit-Nachrichten und Oberflächentexte sind Deutsch. Code, Bezeichner und etablierte Fachbegriffe bleiben Englisch.
- accura schreibt man immer klein, auch am Satzanfang, in Doku, Oberfläche und App-Name. Bezeichner im Code (`AccuraApp`, `Theme.Accura`) folgen der Kotlin-Konvention.
- Beschreibe den tatsächlichen Zustand. Geplantes steht nicht als erledigt da.
- Ändert sich Verhalten, Datenmodell oder Architektur, ändere die Doku im selben Schritt.

## Aufbau

- `app/` Android-App (Kotlin, Jetpack Compose). Zeigt an, rechnet nicht.
- `convex/` Backend und Rechenkern in TypeScript. Alle Finanzlogik liegt hier. Tests in `tests/`, Doku in `docs/backend/`.
- `scripts/` Installation, später Backup und Restore.
- `docs/` Doku. `docs/neubau/` enthält Plan und Bestandsaufnahme aus dem Altprojekt.

## Kotlin und Compose

- Kotlin-Stil `official`. Keine `!!`, keine ungeprüften Casts. Nullbarkeit im Typ ausdrücken.
- Zustände als `sealed interface` modellieren (laden, leer, Fehler, Daten, veraltet) und mit erschöpfendem `when` behandeln.
- Compose: Zustand nach oben heben, Composables bleiben zustandslos, wo es geht. Keine Geschäftslogik in Composables.
- Material 3 Expressive aus den offiziellen Compose-Bausteinen, keine eigenen Nachbauten. Experimentelle APIs nur im Bausteinkatalog und mit `@OptIn`.
- Genau eine Datenschicht spricht mit Convex und Clerk. Der Rest der App kennt weder Client noch Token.
- Versionen nur im Version Catalog (`gradle/libs.versions.toml`), Convex- und Clerk-Clients fest gepinnt.
- Texte stehen in `strings.xml`, nicht im Code. Jedes interaktive Element hat einen zugänglichen Namen (`contentDescription`, Semantics), Touch-Ziele mindestens 48 dp, Farbe trägt nie allein eine Information. Teste mit großer Schrift und TalkBack.
- Neue Abhängigkeit nur mit konkretem Nutzen. Keine eigene Kryptografie oder Anmeldung.

## Geld und Rechnen

- Beträge sind ganzzahlige Cent in `Long`, nie `Float` oder `Double`. Rundung, Fälligkeit und Zeiträume sind explizit.
- Berechnungen leben in `convex/` als reine, getestete Funktionen. Die App übergibt das heutige Datum in Stevens Zeitzone.
- Unterscheide tatsächliche, geplante, geschätzte und berechnete Werte, auch in der Oberfläche. Erfinde keine fehlenden Daten.
- Änderungen an Berechnungen brauchen Tests mit verständlichen Beispielen und Grenzfällen (Monatswechsel, Schaltjahr, Rundung).

## Sicherheit und Privatsphäre

- Echte Finanzdaten, Tokens, Schlüssel und Passwörter kommen nie ins Repo, in Logs, Tests oder Chat. Keystore, Passwörter und `.env`-Dateien liegen unter `~/.config/accura/`.
- Logs und Fehlermeldungen enthalten keine Beträge, Namen oder Tokens. Kein Analysedienst.
- Convex prüft bei jedem öffentlichen Aufruf das Clerk-Token und die erlaubte Kennung, über einen gemeinsamen Wrapper. Eingaben validiert der Server.
- Release-Build setzt `FLAG_SECURE`, Offline-Kopie nur verschlüsselt und kontogebunden (Plan, Abschnitt „App-Schutz“).
- Tests und Entwürfe nutzen nur anonyme Testdaten.

## Prüfen

- Vor „fertig“: Build (`./gradlew :app:assembleDebug`), Tests, Lint. Nenne offen, was du nicht ausführen konntest.
- Backend (`convex/`): `npm run check` (Typecheck und Vitest). Neue öffentliche Funktionen nur über `ownerQuery`/`ownerMutation` und mit Eintrag in `tests/access.test.ts`.
- Passe Tests nicht an, nur damit Fehler grün werden.
- Builds mit niedriger Priorität: `nice -n 19 ionice -c3 <befehl>`.
- Installation auf das Handy: `scripts/install.sh` (siehe README).

## Git

- Arbeitsbranches vom Standardbranch `main`, Änderungen per Pull Request. Kein Merge, kein Push auf `main`, kein Force Push ohne ausdrücklichen Auftrag.
- Lösche nichts und überschreibe keine fremden Änderungen. Ein Commit pro Thema.
- Deployments in die Convex-Produktion und Änderungen an Clerk nur auf Auftrag.
