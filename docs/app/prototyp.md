# Visueller Prototyp (Phase 1.3)

> **Zielgruppe:** Steven zum Vergleichen und Entscheiden; Agenten, die danach die Übersicht bauen.
> **Zweck:** Was der Compose-Prototyp zeigt, wie man die Varianten umschaltet und was davon gilt.
> **Grundlage:** [Design-Leitfaden](../design/leitfaden.md) (PR #3), Klick-Dummys unter `design/` (PR #3), [Plan](../neubau/plan.md), Abschnitt „Design“.

Stand 13. Oktober 2026, Ticket ACC-96. Der Prototyp ist die echte App mit Testdaten. Alle Zahlen sind ausgedacht und stammen aus den Vertragsbeispielen des Rechenkerns (siehe [datenschicht.md](datenschicht.md)). Die Leitfaden-Datei liegt in PR #3, nicht in diesem Branch; der Link funktioniert erst nach dem Merge.

## Varianten umschalten

Im Debug-Build über das Konto-Symbol oben rechts, „Entwicklung“, Abschnitt „Übersicht: Variante“. Darunter steht ein Satz zur gewählten Variante. Der Release-Build hat kein Debug-Menü und zeigt immer „Kontostand zuerst“ (`OverviewVariant.Standard`).

Neben dem Konto-Symbol steht im Debug-Build ein zweites Symbol, „Testdaten wechseln“. Es schaltet ohne Umweg über das Menü durch Standard, Alte Stände, Negativ und Ohne Gehaltstag. Nur so sieht man Formwechsel und Zahlbewegung, während die Übersicht offen ist.

## Die drei Varianten

### Kontostand zuerst

Die Übersicht beantwortet „Wie viel ist auf deinen Konten?“ in einer Hauptzahl-Karte, wie in den Klick-Dummys. Darunter stehen drei Kennzahlen (Bis Gehalt verfügbar, Frei im Monat, Puffer), der nächste Spielraum, Konten und Pockets. Tagesrahmen, Nettovermögen, Restschuld, Schuldenfrei und die Aufteilung des Einkommens liegen unter „Alle Kennzahlen“ und klappen erst auf Tipp auf. Der Expressive-Höhepunkt ist das Frische-Zeichen neben der Zahl: ein Siegel mit Haken, solange die Stände frisch sind, ein schlichtes Quadrat mit Uhr in Bernstein, wenn sie alt sind. Wechselt der Zustand, wandelt sich die Form.

Bilder: [hell](../screenshots/prototyp-kontostand-hell.png), [dunkel](../screenshots/prototyp-kontostand-dunkel.png), [200 % Schrift](../screenshots/prototyp-kontostand-schrift-200.png)

### Spielraum zuerst

Hier steht oben „Wie viel kannst du bis zum Gehalt ausgeben?“, groß und ohne Karte, mit dem Tagesrahmen als Satz darunter. Die Zahl steht in der Farbe „Frei“, im Minus in „Achtung“. Darunter vier Kacheln (Frei im Monat, Puffer, Konten, Restschuld), bei großer Schrift untereinander. Der Höhepunkt ist Bewegung: Ändert sich die Zahl, während sie zu sehen ist, kommt die neue von unten (mehr) oder von oben (weniger), und TalkBack liest sie vor. Diese Variante fragt am direktesten nach Geld, ist aber ohne Gehaltstag die leerste: Dann steht oben nur „Gehaltstag eintragen“.

Bilder: [hell](../screenshots/prototyp-spielraum-hell.png), [dunkel](../screenshots/prototyp-spielraum-dunkel.png), [200 % Schrift](../screenshots/prototyp-spielraum-schrift-200.png)

### Zeitleiste

Die Übersicht ist ein Weg von heute nach vorn: heute (Konten und bis Gehalt), jeden Monat (frei, Puffer), ab wann eine Rate ausläuft, wann du schuldenfrei bist. Jede Station ist für TalkBack ein Eintrag. Konten und Pockets folgen unter der Leiste. Der Höhepunkt ist der Stern „Eine Rate läuft aus“ in der Farbe „Frei“; er wächst beim Erscheinen einmal aus einem Kreis und steht dann still. Die Variante zeigt am meisten Zusammenhang, braucht aber mehr Scrollen bis zu den Konten.

Bilder: [hell](../screenshots/prototyp-zeitleiste-hell.png), [dunkel](../screenshots/prototyp-zeitleiste-dunkel.png), [200 % Schrift](../screenshots/prototyp-zeitleiste-schrift-200.png)

Die Bilder stammen aus dem Emulator `accura-pixel` (Android 17, Dynamic Color aus dem Standard-Hintergrund, Testdaten „Standard“), verkleinert auf 400 × 889. Die 200-%-Bilder zeigen die Systemeinstellung 2,0; Android 14 und neuer vergrößert große Schrift weniger stark als kleine.

## Expressive: Regeln im Code

- Höchstens ein Expressive-Höhepunkt pro Bildschirm. Die drei Zeichen stehen in `ui/katalog/Expressive.kt`, nur dort mit `@OptIn(ExperimentalMaterial3ExpressiveApi)`. Die Ansichten nutzen sie über den Katalog.
- Form und Bewegung zeigen einen Zustand: frisch oder alt (Frische-Zeichen, Datenalter-Chip), gespeichert (Gespeichert-Zeichen, nur im Katalog, weil es noch keine Eingabe gibt), eine Rate läuft aus (Stern), eine Zahl ändert sich (Zahl mit Richtung). Jeder Zustand steht zusätzlich als Text da.
- Formen: `MaterialShapes` aus Material 3 und `Morph` aus `androidx.graphics:graphics-shapes` (kommt mit Material 3, keine neue Abhängigkeit). Bewegung: `MotionScheme.expressive()` (Federn).
- „Animationen entfernen“: `AccuraTheme` liest `ValueAnimator.areAnimatorsEnabled()` bei jedem Start und jeder Rückkehr in die App (`LocalReduceMotion`). Ist die Einstellung an, springen Formen und Zahlen ohne Zwischenbild in den Endzustand; die Zahl wird ohne `AnimatedContent` ersetzt, damit nicht für ein Bild alte und neue Zahl übereinanderliegen. Compose verkürzt seine eigenen Animationen dann ebenfalls auf null.
- Eine Bewegung startet ein Bild nach dem Zustandswechsel. Grund: Neue Daten bauen die ganze Ansicht neu auf. Auf dem Emulator dauerte das länger als ein Bild, die Feder bekam einen veralteten Zeitstempel und war im nächsten Bild schon fertig (Aufnahme: Formwechsel ohne Zwischenbilder). Mit dem Warten auf ein Bild läuft der Formwechsel über rund 20 Bilder.

## Schrift, Skala, Farben

- **Google Sans Flex** liegt als `res/font/google_sans_flex.ttf` in der App, verlustfrei aus der WOFF2-Datei aus PR #3 gewandelt (`woff2_decompress`; Android liest kein WOFF2). Variable Schrift mit Achse `wght`, Untermenge Latin, mit € − ä ö ü ß und tabellarischen Ziffern (`tnum`). Die Lizenz (OFL 1.1, ohne reservierten Namen) liegt in `assets/lizenzen/google-sans-flex-OFL.txt` und damit auch in der APK.
- **Skala** in `ui/theme/Typografie.kt`, die Tabelle im Kommentar ordnet die Größen aus dem Leitfaden den Material-Rollen zu (Hauptzahl 44 sp halbfett, Abschnitt 18 sp, Text 16 sp, Zusatz 14 sp, Chip 13 sp). Alle Stile haben deutsche Silbentrennung (`Hyphens.Auto`, Locale `de-DE`), damit lange Wörter bei großer Schrift nicht mitten im Wort ohne Trennstrich brechen.
- **Feste Rollen** Frei, Rücklage, Achtung, Schulden (`AccuraColors`) mit den Werten des Leitfadens, unabhängig von Dynamic Color.
- **Rückfall-Schema** für Geräte ohne Dynamic Color: Material-Schema „tonalSpot“ aus Petrol `#2F667A` (Farbton der alten App), erzeugt mit `scripts/rueckfall-farben.mjs` (Aufruf im Kopf der Datei) nach `ui/theme/RueckfallFarben.kt`. Das ist ein Vorschlag, der Leitfaden nennt Farbton und Variante als offen.

## Bausteinkatalog

Im Debug-Menü unter der Szenarienwahl, Reihenfolge wie im Leitfaden: Hauptzahl-Karte, Kennzahl, Rechenweg, Liste, Hinweis (Achtung und Einspar-Hinweis mit „Bewusst so“), Leerzustand (mit Schritt zur Lösung), Datenalter-Chip und Art, Betragsfeld, Auswahl (eine und mehrere), Schrittanzeige, Aufteilungsbalken. Danach die Expressive-Zeichen mit Schaltern zum Ausprobieren.

Geändert gegenüber dem Gerüst: Die Kennzahl klappt auf Tipp auf die ganze Karte auf (Leitfaden) und zeigt zugeklappt nur Name, Kurzbeschreibung, Wert und Art; Datenalter und Grund stehen zugeklappt nur da, wenn der Wert alt oder nicht berechenbar ist. Der frische Datenalter-Chip hat einen Haken und ist rund, der alte ist fast eckig mit Uhr und gestricheltem Rand, „nicht berechenbar“ hat einen Strich. Hauptzahl-Karte und Kennzahl zeigen die Art des Werts als Marke.

Neu: Betragsfeld, Auswahl, Schrittanzeige (für die Ersterfassung, noch in keiner Ansicht), Einspar-Hinweis-Karte. Das Betragsfeld liest mit `parseBetrag` dieselben Eingaben wie der Klick-Dummy und rundet oder rät nichts.

## Barrierefreiheit

| Prüfung | Wie | Ergebnis |
| --- | --- | --- |
| Touch-Ziele ≥ 48 dp, jedes mit Namen | `BarrierefreiheitTest`: jede Variante × Standard, Alte Stände, Negativ, Ohne Gehaltstag | grün |
| 200 % Schrift ohne abgeschnittene Texte | derselbe Test, misst die Zeilen jedes Texts gegen seinen Rahmen; eine Gegenprobe mit absichtlich abgeschnittenem Betrag schlägt an | grün |
| Kontraste | `KontrastTest`: Text 4,5 zu 1, Symbole und Ränder 3 zu 1, feste Rollen und Rückfall-Schema, Hell und Dunkel | grün |
| „Animationen entfernen“ | `BewegungTest` (ohne Animation kein Zwischenbild, mit Animation ein Übergang) und Emulator-Aufnahme mit Skalierung 0 | grün |
| TalkBack von Hand | nicht gemacht | offen |

`hasVisualOverflow` von Compose meldet bei Texten mit Zeichenabstand eine Überbreite, obwohl im Bild nichts abgeschnitten ist. Der Test misst deshalb die tatsächlichen Zeilenränder.

## Offen

- Steven wählt eine Variante; die anderen fallen danach weg, mit ihnen das Debug-Schalten der Variante.
- Rückfall-Farbton und Schema-Variante (Vorschlag: tonalSpot aus `#2F667A`).
- Gespeichert-Zeichen bekommt erst mit der Ersterfassung (Phase 3) einen echten Platz.
- Die Farbe der Zahl in „Spielraum zuerst“ wechselt beim Übergang sofort, die alte Zahl gleitet schon in der neuen Farbe hinaus.
- TalkBack-Durchgang von Hand am Handy.
