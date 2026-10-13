# Aufbau der App

> **Zielgruppe:** Agenten und Steven beim Weiterbauen.
> **Zweck:** Wo was liegt und warum. Nur Gebautes.

Paket `app.kiumu.accura` im Modul `app`. Es gibt ein einziges Gradle-Modul. Theme und Bausteinkatalog sind klar abgegrenzte Pakete (`ui/theme`, `ui/katalog`), kein eigenes Modul: Ein zweites Modul brächte Build-Aufwand ohne Nutzen (AGENTS.md: einfach vor clever).

| Paket | Inhalt |
| --- | --- |
| `data/` | `FinanceRepository` (eine Schnittstelle, Modelle je Ansicht als Fluss von `ViewState`), `ViewState`, `ErrorKind`, `FinanceJson`, `todayFlow` (Tageswechsel) |
| `data/model/` | Kotlin-Spiegel der Convex-Antworten, siehe [datenschicht.md](datenschicht.md) |
| `auth/` | `AuthGateway` (E-Mail-Code in zwei Schritten, `Session`), Release-Variante „nicht eingerichtet“ |
| `ui/theme/` | `AccuraTheme` (Material 3 Expressive, Dynamic Color), feste Farbrollen `AccuraColors` |
| `ui/katalog/` | Bausteine: Hauptzahl-Karte, Kennzahl, „So gerechnet“, Datenalter-Chip, Hinweis, Leerzustand, Liste, Aufteilungsbalken, Lade-, Fehler- und Veraltet-Zustand, `Bausteinkatalog` |
| `ui/format/` | Anzeigeformate (Cent, Prozent, Datum), reine Funktionen |
| `ui/screens/` | Übersicht, Demnächst, Budget, Schulden (zustandslos, nehmen einen `ViewState`), Debug-Menü |
| `ui/anmeldung/` | Anmeldeseite und ihr ViewModel |
| `ui/navigation/` | die vier Ziele |
| `src/debug/` | Fake-Anmeldung, Fake-Datenquelle, `createAppGraph` mit Testdaten |
| `src/release/` | `createAppGraph` ohne Daten: nicht verbunden, keine Anmeldung |

## Verdrahtung

`AccuraApplication` hält einen `AppGraph` (Anmeldung, Datenquelle, Uhr in Europe/Berlin). `createAppGraph` ist je Build-Typ in `src/debug` und `src/release` definiert. Es gibt keine DI-Bibliothek. Eine Release-App mit Fake-Zahlen auf Stevens Handy kann so nicht entstehen: Die Fake-Klassen existieren dort nicht.

## Anmeldung und Navigation

- Die Anmeldung ist ein **Zustand**, keine Route (`AccuraApp`). Abgemeldet erreicht niemand eine Ansicht, auch nicht über Zurück.
- Jeder Sitzungszustand hat einen eigenen ViewModel-Speicher (`SessionScope`). Beim Abmelden verschwinden die ViewModels der Ansichten samt ihren Finanzdaten, beim Anmelden bleibt kein halber Anmeldeschritt hängen.
- Angemeldet: `Scaffold` mit Titel, Konto-Menü (Abmelden, im Debug-Build „Entwicklung“) und `ShortNavigationBar` mit den vier Ansichten (Compose Navigation). Die Leiste skaliert die Schrift nur bis 130 %, weil vier Namen sonst mitten im Wort brechen; der Inhalt skaliert voll.
- Das Debug-Menü „Entwicklung“ schaltet das Szenario der Fake-Daten (Standard, Leer, Negativ, Alte Stände, Offline-Kopie, Lädt, Fehler) und zeigt den Bausteinkatalog.
- Fake-Anmeldung (nur Debug): jede gültige Adresse bekommt einen Code, der Code ist `123456`. `offline@example.test` meldet „keine Verbindung“, `000000` „Code abgelaufen“.

## Material 3 und Version

Das Projekt nutzt `androidx.compose.material3:material3` **1.5.0-beta01**, fest gepinnt im Version Catalog. Compose UI und Foundation kommen aus der BOM `2026.09.00` (1.12.1), das Beta verlangt mindestens 1.12.0.

Begründung: Die BOM liefert Material 3 1.4.0 (stabil). In 1.4.0 sind die Expressive-Bausteine `MaterialExpressiveTheme`, `MotionScheme.expressive()`, `LoadingIndicator` und `ShortNavigationBar` **intern** und lassen sich nicht aufrufen (Compilerfehler „it is internal“, geprüft). Ab 1.5.0-beta01 sind sie öffentlich. Wechsel auf 1.5.0, sobald es stabil erscheint: Version im Katalog ändern, Tests laufen lassen. `@OptIn(ExperimentalMaterial3ExpressiveApi)` steht nur in `ui/theme`, `ui/katalog/Zustaende.kt` und `ui/AccuraApp.kt` (Leiste).

Farben: Dynamic Color als Grundstimmung (`dynamicLightColorScheme`/`dynamicDarkColorScheme`, Rückfall: Petrol-Schema). Feste Rollen **Frei**, **Rücklage**, **Achtung**, **Schulden** in `AccuraColors`, Hell und Dunkel, Werte aus dem Design-Leitfaden. Die Schrift ist noch die Standard-Schrift von Material (Google Sans Flex steht aus, siehe „Offen“).

## Regeln im Code

- Composables rechnen nichts nach. Anzeigeformate (`ui/format`) setzen Zahlen nur zusammen, ohne Kommazahlen. „Leer“ entscheidet das Modell (`isEmpty`, Status `empty`, keine Kredite).
- Beträge stehen einzeilig mit tabellarischen Ziffern und geschütztem Leerzeichen vor dem Euro-Zeichen. Die große Zahl schrumpft (`TextAutoSize`), statt abgeschnitten zu werden. Bei Schrift ab 130 % stehen Kennzahlen und Listenzeilen gestapelt.
- Datenalter-Chip: Uhr, gestrichelter Rand und das Wort „Alt“ tragen die Aussage, nicht nur die Farbe.
- Alle Texte stehen in `strings.xml`. Ausnahme: Beschriftungen und Beispieldaten des Bausteinkatalogs (nur Debug-Menü, nur Entwicklern sichtbar).
- `allowBackup=false` und `data_extraction_rules.xml` schließen jede Sicherung und Übertragung von App-Daten aus.

## Tests

| Ebene | Wo | Befehl |
| --- | --- | --- |
| Vertrag, Formate | `src/test` (JUnit) | `./gradlew :app:testDebugUnitTest` |
| Fake-Quelle, Anmeldung, ViewModel, Anmelde- und Navigationsablauf (Compose UI-Tests unter Robolectric) | `src/testDebug` | dito |
| Screenshots ohne Emulator (Roborazzi) | `src/testDebug/.../screenshots`, Referenzen in `src/test/screenshots` | `./gradlew :app:verifyRoborazziDebug`, neu aufnehmen mit `:app:recordRoborazziDebug` |
| Lint | | `./gradlew :app:lint` |

Screenshot-Tests: jede Ansicht in Hell, Dunkel, großer Schrift (200 %), leer, negativ, alte Stände, Offline-Kopie, dazu die ganze App mit Leiste, die Anmeldung und der Katalog. Roborazzi vergleicht mit einer kleinen Toleranz (0,5 %).

Robolectric läuft mit Android 16 (API 36, `robolectric.properties`): Mit API 37 scheitert Espresso in Robolectric 4.17 (`InputManagerEventInjectionStrategy`). Die App selbst zielt auf API 37 und wurde im Emulator mit API 37 geprüft.

## Offen

- Clerk (`clerk-android-api`) und Convex-Client hinter `AuthGateway` und `FinanceRepository`. Dort kommt auch die Zuordnung von int64 (`Long`) und die Offline-Kopie dazu.
- Schrift Google Sans Flex, Übertragung der Typografie-Skala des Leitfadens, Rückfall-Farbton.
- Sperre, `FLAG_SECURE`, verschlüsselte Offline-Kopie (Phase 5).
- Anmeldung: Schritt und E-Mail überleben Drehen und Prozess-Ende (`rememberSaveable` in `SignInRoute`, weil `SessionScope` einen eigenen ViewModel-Speicher ohne `SavedStateHandle` hat). Der Code selbst bleibt nicht erhalten, er ist nur kurz gültig. Der Test `Code-Schritt bleibt nach Drehen oder Prozess-Ende stehen` schlägt ohne diese Lösung fehl.
- TalkBack-Durchgang von Hand. Namen und Rollen sind gesetzt, ein Durchgang mit dem Screenreader steht aus.
- CI für die App (Lint, Tests, `verifyRoborazziDebug`).
