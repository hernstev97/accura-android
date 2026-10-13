# Visueller Prototyp (Phase 1.3, Runde 2)

> **Zielgruppe:** Steven zum Prüfen und Entscheiden; Agenten, die danach die Ansichten weiterbauen.
> **Zweck:** Was der Compose-Prototyp in Runde 2 zeigt, woher die Gestaltung kommt und was noch offen ist.
> **Grundlage:** [Design-Leitfaden](../design/leitfaden.md), Abschnitt „Richtung“ (PR #3, `7c4fda7`), [Plan](../neubau/plan.md), Abschnitt „Design“, Screenshots der alten Web-App aus ihren Visual-Tests.

Stand 13. Oktober 2026, Ticket ACC-100 (Runde 1: ACC-96). Der Prototyp ist die echte App mit Testdaten. Alle Zahlen sind ausgedacht und stammen aus den Vertragsbeispielen des Rechenkerns (siehe [datenschicht.md](datenschicht.md)). Die Leitfaden-Datei liegt in PR #3, nicht in diesem Branch; der Link funktioniert erst nach dem Merge.

## Was Steven zu Runde 1 gesagt hat

„Beim Design bitte näher an der alten Webversion von accura bleiben, aber das Ganze auf jeden Fall geradeziehen und schick machen. Die Zeitleiste C sieht trotzdem gut aus. Orientiere dich auch an der Google-Health-App.“

Daraus folgt Runde 2: Die Varianten A („Kontostand zuerst“) und B („Spielraum zuerst“) sind weg, mit ihnen der Variantenschalter im Debug-Menü. Es gibt eine Übersicht. Die Zeitleiste aus Variante C ist ein Baustein geworden. Alle vier Ansichten folgen dem Aufbau der alten Web-App und sind im Stil von Google Health ausgeführt.

## Aus der alten Web-App übernommen

- **Aufbau der Übersicht in derselben Reihenfolge:** Begrüßung mit Monat, Einkommens-Ring links mit Kacheln rechts, Kennzahl-Kacheln („Jetzt verfügbar“ als Fokus), Karte „Nächster Spielraum“, Konten als Liste mit Gesamt, Pockets als Kachelraster.
- **Schulden als „Dein Weg auf null“:** große Karte mit Restschuld und Ziel-Plakette rechts, zwei Kacheln, Gläubiger-Liste, Restschuldkurve mit Tabelle, Stufen „Mehr frei durch auslaufende Raten“ mit Liste darunter, Karte „Planungsannahme“.
- **Budget:** Hauptkarte „Einkommen“ mit Ring und Legende nach Notwendigkeit, daneben „Frei“ und „Rücklagen“, Ausgaben als Balken, umschaltbar nach Kategorie oder Notwendigkeit.
- **Begriffe und Ton:** „Jetzt verfügbar“, „Nächster Spielraum“, „Gläubiger“, „Ablösesumme“, „Planungsannahme“, „Dein Budget“.
- **Petrol als Rückfall-Farbton** und Google Sans Flex (schon in Runde 1).

## Geradegezogen

- **Ein Raster** (`ui/theme/Raster.kt`): 16 dp Seitenrand und Innenabstand, 12 dp zwischen Kacheln, 24 dp über jeder Abschnittsüberschrift, 20 dp in der einen Hauptkarte je Ansicht. Die alte App hatte je Bereich eigene Abstände und verschachtelte Karten in Karten (Pockets, Konten, Restschuld). Hier gibt es keine Karte in einer Karte mehr.
- **Zwei Radien** (`AccuraShapes`): Karten, Kacheln und Listengruppen 24 dp, Flächen in einer Karte 12 dp, die inneren Ecken einer Listengruppe 4 dp. Knöpfe, Anteil-Pillen und Chips sind ganz rund. Die alte App hatte 36, 28, 24 und 20 px nebeneinander.
- **Ein Kachelsystem:** gedämpft (`surfaceContainer`) für alles, kräftig (Fläche der Farbrolle) nur für den einen Fokus eines Abschnitts: „Jetzt verfügbar“, „Nächster Spielraum“, die Hauptkarten von Demnächst, Budget und Schulden, „Frei im Monat“ im Budget. Gedämpfte Kacheln tragen einen Punkt in der Farbe ihrer Rolle.
- **Listengruppen statt Trennlinien:** Konten, Gläubiger, Raten und Zahlungen stehen als einzelne Flächen mit 2 dp Fuge, die Summenzeile („Gesamt“, „Zusammen“) leicht abgesetzt.
- **Typografie aus dem Leitfaden:** Seitentitel 28 sp (`headlineMedium`), Abschnitt 18 sp, Hauptzahl 44 sp, Kachelwert 24 sp, Text 16 und 14 sp. Beträge mit tabellarischen Ziffern.
- **Eine Hauptaktion je Ansicht** als Pillen-Knopf. In der Übersicht ist das „Stände aktualisieren“. Im Prototyp zeigt der Knopf den Hinweis „Eintragen kommt mit der Ersterfassung.“ (Platzhalter, Phase 3). Gleiches gilt für „Gehaltstag eintragen“ in Demnächst.
- **Datenalter ruhig:** In der Übersicht steht ein einziger Chip „Ältester Stand vom 25. Juli“, in den Konten ein leiser Zusatz „Stand von heute“. Alte Stände bekommen den Chip „Alt“ mit Uhr und gestricheltem Rand und oben die Achtung-Karte. „So gerechnet“ steht in den Hauptkarten als Zeile und hinter jeder Wert-Kachel im Blatt.

## Nach Google Health gestaltet

Vorlage waren vier Screenshots von Stevens Handy. Sie enthalten Gesundheitsdaten und liegen deshalb nicht im Repo; übernommen ist nur Form und Aufbau.

- **Ring mit Pillen daneben:** Der Einkommens-Ring zeigt die Anteile als Bögen mit runden Enden und Lücken, in der Mitte der Anteil „frei“. Rechts stehen die Anteil-Pillen; ihre Füllung im Farbton des Bogens zeigt den Anteil, die Zahl steht daneben als Text. Ab 130 % Schrift stehen Ring und Pillen untereinander.
- **Pillen-Knopf** für die Hauptaktion: 56 dp hoch, ganz rund, Fläche `primaryContainer`. Beim Drücken wird er etwas eckiger (Material 3 Expressive).
- **Raster „wichtigste Werte“:** Wert-Kacheln mit Name, großem Wert, einem Satz und unten dem Platz für einen kleinen Verlauf. Verläufe gibt es erst mit mehreren Ständen, das Backend liefert noch keine. Deshalb steht dort nach dem Vorbild „Keine Daten“ der Chip „Kein Verlauf“. accura zeichnet keine erfundene Linie.
- **Verlauf als Karten mit Datum:** In Demnächst steht über jedem Tag mit Zahlungen eine Zeile mit Datum, darunter die Zahlungen als Listengruppe.
- **Kräftig gegen gedämpft:** wie „Fokus bearbeiten“, nur ohne Bearbeiten.
- **Ein Tipp auf eine Kachel öffnet ein Blatt** (Bottom Sheet) mit Wert, Datenalter, Art und „So gerechnet“, statt die Kachel im Raster aufzuklappen.

## Die vier Ansichten

### Übersicht

„Hallo“, darunter „Dein August 2026 auf einen Blick.“ Dann Ring und vier Pillen, der Satz „Aufteilung von 3.000,00 € Einkommen im Monat“, der Knopf „Stände aktualisieren“ und der Chip zum ältesten Stand. Unter „Auf einen Blick“ vier Wert-Kacheln: Jetzt verfügbar (kräftig), Bis Gehalt (mit Tagesrahmen; ohne Gehaltstag „Gehaltstag eintragen“), Rücklagen (Summe der Pockets), Puffer. Danach „Nächster Spielraum“, Konten, Pockets. Expressive-Höhepunkt ist der Stern „Eine Rate läuft aus“ in „Nächster Spielraum“.

**Vier Pillen statt drei.** Der Leitfaden nennt drei Kacheln (Ausgaben, Rücklagen, frei), wie in der alten App. Dort steckten die Raten in „Ausgaben“. Das Backend liefert die Raten heute als eigenen Anteil (`incomeSplit.parts`: expenses, rates, reserves, free, je mit `sharePercent`). Für drei Pillen müsste die App zwei Anteile addieren, und die App rechnet nicht. Deshalb zeigt sie jeden Anteil, den das Backend liefert. Siehe offene Fragen.

Bilder: [hell](../screenshots/runde2-uebersicht-hell.png), [dunkel](../screenshots/runde2-uebersicht-dunkel.png), [200 % Schrift](../screenshots/runde2-uebersicht-schrift-200.png), [negativ](../screenshots/runde2-uebersicht-negativ.png), [leer](../screenshots/runde2-uebersicht-leer.png), [weiter unten](../screenshots/runde2-uebersicht-unten.png), [Blatt einer Kachel](../screenshots/runde2-uebersicht-blatt.png)

### Demnächst

„Bis zum Gehalt“ mit Gehaltstag und Abstand, die Hauptkarte „Wie viel kann ich bis zum Gehalt noch ausgeben?“ (frei, im Minus „Achtung“), zwei Wert-Kacheln (Auf den Konten, Fällig bis zum Gehalt) und darunter „Was kommt“ als Zeitleiste: heute, jeder Tag mit Zahlungen, das Gehalt. Ohne Gehaltstag steht statt der Zeitleiste ein Leerzustand mit Knopf „Gehaltstag eintragen“.

Bilder: [hell](../screenshots/runde2-demnaechst-hell.png), [dunkel](../screenshots/runde2-demnaechst-dunkel.png), [200 % Schrift](../screenshots/runde2-demnaechst-schrift-200.png), [negativ](../screenshots/runde2-demnaechst-negativ.png), [leer](../screenshots/runde2-demnaechst-leer.png), [Zeitleiste](../screenshots/runde2-demnaechst-zeitleiste.png)

### Budget

„Dein Budget“ mit „August 2026 · 95,22 % verplant“. Die Hauptkarte zeigt das Einkommen groß, den Ring aus den fünf Stufen der Notwendigkeit, den Raten und dem freien Rest, darunter die Legende mit genauen Beträgen. Die fünf Stufen sind eine Reihe von `primary` zur Spur hin, weil sie eine Rangfolge sind. Danach „Frei im Monat“ (kräftig; überplant in „Achtung“ mit dem Fehlbetrag) und „Rücklagen“. Unter „Ausgaben im Monat“ Balken nach Kategorie oder Notwendigkeit; nach Notwendigkeit klappt jede Stufe ihre Posten mit Fälligkeit auf. Am Ende die Raten als Listengruppe.

Bilder: [hell](../screenshots/runde2-budget-hell.png), [dunkel](../screenshots/runde2-budget-dunkel.png), [200 % Schrift](../screenshots/runde2-budget-schrift-200.png), [negativ](../screenshots/runde2-budget-negativ.png), [leer](../screenshots/runde2-budget-leer.png), [nach Notwendigkeit](../screenshots/runde2-budget-notwendigkeit.png)

### Schulden

„Dein Weg auf null“ mit „Planmäßig schuldenfrei im Dezember 2029“. Die Hauptkarte zeigt die Restschuld heute, die Ablösesumme als Obergrenze und rechts die Plakette „Ziel Dez. 2029“ (ab 130 % Schrift als Pille darunter). Zwei Kacheln: Zinsen bis Laufzeitende, Mehrkosten gegenüber sofortiger Ablösung. Die Gläubiger stehen als Listengruppe; ein Tipp öffnet die Einzelheiten des Kredits im Blatt. Darunter die Restschuldkurve und die Stufen „Mehr frei durch auslaufende Raten“, gefolgt von der Zeitleiste bis „Schuldenfrei“ und der Planungsannahme.

**„Noch planmäßig zu zahlen“ fehlt als Kachel.** Die alte App zeigte diese Summe. Das Backend liefert sie heute nicht als Kennzahl, nur als ersten Schritt im Rechenweg der Mehrkosten (9.712,25 € in den Testdaten). Die App addiert Restschuld und Zinsen nicht selbst. Deshalb steht dort „Zinsen bis Laufzeitende“; der Betrag ist über das Blatt der Kachel „Mehrkosten“ erreichbar.

Bilder: [hell](../screenshots/runde2-schulden-hell.png), [dunkel](../screenshots/runde2-schulden-dunkel.png), [200 % Schrift](../screenshots/runde2-schulden-schrift-200.png), [negativ](../screenshots/runde2-schulden-negativ.png), [leer](../screenshots/runde2-schulden-leer.png), [Restschuld mit Tabelle](../screenshots/runde2-schulden-verlauf.png), [Stufen und Zeitleiste](../screenshots/runde2-schulden-stufen.png)

## Entscheidungen

### Zeitleiste in Demnächst und Schulden, nicht in der Übersicht

Die Zeitleiste ist jetzt der Baustein `Station` und `Punkt` in `ui/katalog/Zeitleiste.kt`. Ich habe sie an zwei Stellen eingesetzt:

- **Demnächst** heißt schon „was kommt“. Die Stationen heute, Zahlungstage und Gehalt kommen direkt aus `views:upcoming`; hier ersetzt die Zeitleiste die flache Liste und macht die Abstände bis zum Gehalt sichtbar.
- **Schulden:** Die Stationen „Ab Oktober 2026 … ab Januar 2030“ bis „Schuldenfrei“ sind dieselben Daten wie das Stufendiagramm. Die Zeitleiste ist damit dessen Textfassung mit genauen Beträgen, und der Stern steht an der nächsten Entlastung.

In der Übersicht wäre die Zeitleiste doppelt: „Nächster Spielraum“ zeigt die nächste Entlastung schon, und der Gehaltstag steht im Modell der Übersicht nicht. Am Ende der Übersicht hätte sie die Seite nur verlängert.

### Schulden in Schiefergrau, nicht in Rosa

Die alte App zeigt Schulden in Rosa, dunkel in einem tiefen Weinrot. Rosa liegt im Farbton neben Fehlerrot; dunkel liest sich das Weinrot wie ein Fehler. Der Leitfaden sagt „Schulden ruhig, nicht in Alarmfarben“ und legt Schiefergrau fest. Dabei bleibt es. Damit die Hauptkarte sich hell von den gedämpften Kacheln abhebt, ist die Schulden-Fläche hell eine Stufe tiefer als im Klick-Dummy (`#D8DCEA` statt `#E1E3EC`); Kontraste geprüft. Wer Rosa doch will, ändert eine Farbrolle in `AccuraColors`.

### Ein Expressive-Höhepunkt je Bildschirm

| Ansicht | Höhepunkt |
| --- | --- |
| Übersicht | Stern „Eine Rate läuft aus“ in „Nächster Spielraum“ |
| Schulden | derselbe Stern an der ersten Station der Zeitleiste |
| Demnächst, Budget | keiner |

Der Datenalter-Chip wechselt seine Form zwischen frisch (Pille) und alt (fast eckig) wie in Runde 1. Das zählt als Zustandsanzeige, nicht als Höhepunkt. Frische-Zeichen und „Zahl mit Richtung“ aus Runde 1 stehen nur noch im Katalog.

## Diagramme

Drei Diagramme mit Compose Canvas, ohne neue Bibliothek (`ui/katalog/Diagramme.kt`, `Aufteilung.kt`):

| Diagramm | Textfassung für TalkBack und Augen |
| --- | --- |
| Ring (Übersicht, Budget) | Beschreibung des Rings; Pillen oder Legende mit genauen Beträgen |
| Restschuldkurve | Beschreibung „von 8.945,00 € heute auf 0,00 € im Dezember 2029“; Schalter „Werte als Tabelle“ mit heute, jedem Januar und dem letzten Monat |
| Stufen „Mehr frei“ | Beschreibung mit Zahl der Stufen und Endwert; die Zeitleiste darunter mit jedem Betrag |

Nur die Achsen runden: `achsenGrenze` wählt den nächsten runden Euro-Betrag (550 € → 600 €, 8.945 € → 10.000 €). Achsenbeschriftungen sind Text und wachsen mit der Schrift. Bleibt nach allen Entlastungen weniger als nichts frei (Szenario „Negativ“), steht das Stufendiagramm in „Achtung“.

## Bewegung

- Bewegung nur mit Bedeutung: Formwechsel des Datenalter-Chips, Stern beim Erscheinen, Auf- und Zuklappen, Blatt, Druckform des Pillen-Knopfs.
- „Animationen entfernen“ gilt wie in Runde 1 (`LocalReduceMotion`). Gemessen im Emulator beim Wechsel zu „Alte Stände“: mit Animationen 53 Bilder in der Aufnahme, ohne 7.
- Beobachtung: Der Stern wächst, während die Navigation zur Übersicht überblendet. Dadurch ist das Wachsen kaum zu sehen.

## Schrift und Farben

Unverändert aus Runde 1: Google Sans Flex (`res/font`, OFL-Lizenz in `assets/lizenzen/`), Skala in `Typografie.kt`, feste Rollen Frei, Rücklage, Achtung, Schulden in `AccuraColors`, Dynamic Color als Grundstimmung, Rückfall-Schema „tonalSpot“ aus Petrol `#2F667A`. Neu ist die Füllung der Anteil-Pillen: Akzent der Rolle mit 30 % Deckkraft über der Spur (`RoleColors.fuellung`), damit Text in `onSurface` auf Füllung und Spur lesbar bleibt.

## Bausteinkatalog

Im Debug-Menü unter der Szenarienwahl. Neu in Runde 2, als Nummer 12 bis 16 nach den elf Bausteinen des Leitfadens: Kachel und Wert-Kachel mit Pillen-Knopf, Ring und Anteil-Pillen, Listengruppe, Zeitleiste, Diagramme (Kurve, Stufen, Balken). Geändert: Leerzustand ist eine gedämpfte Kachel mit Pillen-Knopf; die Chips der Auswahl sind sichtbar 48 dp hoch; die Hauptzahl-Karte hat 24 dp Radius.

## Barrierefreiheit

| Prüfung | Wie | Ergebnis |
| --- | --- | --- |
| Touch-Ziele ≥ 48 dp, jedes mit Namen | `BarrierefreiheitTest`: jede der vier Ansichten × Standard, Alte Stände, Negativ, Ohne Gehaltstag | grün |
| 200 % Schrift ohne abgeschnittene Texte | derselbe Test, misst die Zeilen jedes Texts; Gegenprobe mit absichtlich abgeschnittenem Betrag schlägt an | grün |
| Kontraste | `KontrastTest`: Rollen, Rückfall-Schema, neu auch Kacheln, Summenzeile, Pillen-Knopf, Anteil-Pillen (Text auf Spur und Füllung) | grün |
| Diagramme mit Textfassung | `AppFlowTest`: Beschreibung der Restschuldkurve vorhanden, Tabelle klappt auf | grün |
| „Animationen entfernen“ | `BewegungTest` und Emulator-Aufnahme | grün |
| TalkBack von Hand | nicht gemacht | offen |

Der erste Lauf fand ein echtes Problem: Die Auswahl-Chips „Kategorie“ und „Notwendigkeit“ waren nur 32 dp hoch. Sie sind jetzt sichtbar 48 dp hoch.

## Emulator-Bilder

Aus dem Emulator `accura-pixel` (Android 17, Dynamic Color aus dem Standard-Hintergrund), Testdaten „Standard“, sofern nicht anders benannt, verkleinert auf 400 × 889: `docs/screenshots/runde2-<ansicht>-<fall>.png` für hell, dunkel, schrift-200 (Systemeinstellung 2,0), negativ und leer, dazu sechs Detailbilder. Die Bilder der Runde 1 (`prototyp-*.png`) sind entfernt.

## Offen

1. Vier Pillen (Raten eigen) oder drei wie in der alten App? Für drei müsste das Backend Ausgaben und Raten als einen Anteil liefern.
2. Soll das Backend „Noch planmäßig zu zahlen“ (und die Zahl der restlichen Raten) als Kennzahl liefern, damit die Kachel wie in der alten App stehen kann?
3. Schulden in Schiefergrau statt Rosa: passt das?
4. Zeitleiste in Demnächst und Schulden statt am Ende der Übersicht: passt das?
5. „Rücklagen“ in der Übersicht zeigt die Summe der Pockets (Ist). Die alte App zeigte die geplanten Rücklagen im Monat. Welche ist gemeint?
6. „Kein Verlauf“ auf jeder Kachel: so lassen, bis Verläufe kommen, oder den Platz erst dann zeigen?
7. Begrüßung fest „Hallo“ oder nach Tageszeit wie in der alten App („Guten Morgen“)? Dafür bräuchte die Übersicht die Uhrzeit.
8. Rückfall-Farbton und Schema-Variante (Vorschlag weiter: tonalSpot aus `#2F667A`).
9. TalkBack-Durchgang von Hand am Handy.
