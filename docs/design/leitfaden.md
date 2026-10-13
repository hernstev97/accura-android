# Design-Leitfaden

> **Zielgruppe:** Steven als Entscheider; Agenten, die Prototyp und App gestalten.
> **Zweck und Lernziel:** Auf einer Seite festhalten, nach welchen Regeln accura aussieht und klingt, und welche Bausteine es gibt.
> **Voraussetzungen:** [Plan](../neubau/plan.md), Abschnitt „Design“.
> **Kanonisch für:** Designregeln, Farbrollen, Typografie, Bausteinliste und Ton der Texte.
> **Verwandte Dokumente:** [Klick-Dummys](../../design/README.md), [Plan](../neubau/plan.md)

Stand: 13. Oktober 2026. **Entwurf, Steven prüft.** Quellen sind der Plan und Stevens geparkte Notizen zu Material 3 Expressive. Was der Plan nicht festlegt, steht als „offen“ da. Die Werte unter „Dummy“ gelten für die HTML-Klick-Dummys, nicht für die spätere Compose-App.

## Richtung (Steven, 13. Oktober 2026)

- **Nah an der alten Web-App bleiben**, aber geradeziehen und sauber machen. Aufbau der Übersicht wie dort: Begrüßung mit Monat, Einkommens-Ring links mit drei Füll-Kacheln rechts (Ausgaben, Rücklagen, frei), darunter zwei Kennzahl-Kacheln (jetzt verfügbar, Rücklagen), die Karte „Nächster Spielraum“, Konten als Liste, Pockets als Kachelraster. Schulden wie „Dein Weg auf null“ mit Restschuldkurve und den Stufen „Mehr frei durch auslaufende Raten“.
- **Vorbild für die Ausführung ist Google Health** (Android): großer Ring mit drei pillenförmigen Kacheln daneben, Kacheln mit kräftiger Füllfarbe für den Fokus, gedämpfte Kacheln für den Rest, große Pillen-Knöpfe für die Hauptaktionen, ein Raster „wichtigste Werte“ mit kleinen Verläufen und „Keine Daten“-Chips, Karten mit großen Radien auf dunklem Grund, eine Leiste mit wenigen Zielen.
- **Die Zeitleiste aus dem Prototyp (Variante C) bleibt**, als Baustein für „Was kommt“: heute, jeden Monat, auslaufende Raten, schuldenfrei.
- Die Varianten A und B des ersten Prototyps entfallen in dieser Form.

## Die sieben Regeln

1. **Wenige Bausteine, überall gleich.** Jede Ansicht setzt sich nur aus dem Katalog unten zusammen. Neue Bausteine nur mit Begründung.
2. **Eine Antwort pro Ansicht.** Oben steht groß die Antwort auf die Frage der Ansicht, darunter die Herleitung. Höchstens ein Expressive-Höhepunkt pro Bildschirm.
3. **Wenige Zahlen zeigen, viele bereithalten.** Der Rechenkern liefert mehr, als auf einen Bildschirm passt. Der Rest steht beim Aufklappen („So gerechnet“) oder unter „Alle Kennzahlen“.
4. **Expressive mit Absicht.** Form und Bewegung zeigen Zustände (gespeichert, frisch oder alt, Rate läuft aus), sie dekorieren nicht. „Animationen entfernen“ gilt. Der echte Eindruck entsteht erst im Compose-Prototyp.
5. **Farben mit fester Bedeutung.** Dynamic Color für die Grundstimmung, feste Rollen für frei, Rücklage und Achtung. Schulden ruhig, nicht in Alarmfarben.
6. **Zahlen zuerst.** Beträge nie abgeschnitten, nie gerundet (außer in Diagrammachsen), das Euro-Zeichen nie allein in der Zeile, bis 200 % Schrift lesbar.
7. **Sprache als Design.** Texte entstehen mit den Bildschirmen, nicht danach.

Dazu aus den Notizen: Die Lautstärke ist ruhig (Vertrauensaufgabe, Schamrisiko). Farbe trägt nie allein eine Information, jede Form und Bewegung respektiert Kontrast, Fokus und Namen.

## Farbrollen

| Rolle | Bedeutung | Wo sie steht |
| --- | --- | --- |
| Grundstimmung | Dynamic Color aus dem Hintergrundbild. Rückfall: ein accura-Standardschema (Plan). | Flächen, Navigation, Schaltflächen, „Jetzt verfügbar“ |
| Frei | Geld, das du ausgeben kannst | Bis Gehalt verfügbar, Tagesrahmen, Frei im Monat, Entlastung |
| Rücklage | Geld, das für etwas zurückliegt | Rücklagen, Puffer |
| Achtung | Eine Zahl ist alt, unvollständig oder überplant. Ruhiges Bernstein, nie Rot. | Datenalter-Chip „alt“, Hinweis auf alte Stände |
| Schulden | Schiefergrau, ruhig und klar | Restschuld, Kredite, Verlauf |

Fehlerrot gibt es nur für technische Fehler des Systems, nie für Finanzdaten. Hell, Dunkel und System, kein reines Schwarz als Fläche.

**Dummy:** feste Petrol-Palette, Farben als Rollen in [`app.css`](../../design/dummies/css/app.css). Das Prüfskript misst Kontraste: Text mindestens 4,5 zu 1, Flächen und Ränder mindestens 3 zu 1, hell und dunkel.

| Rolle | Hell: Fläche, Text | Dunkel: Fläche, Text |
| --- | --- | --- |
| Frei | `#C6EDCF`, `#00210C` (Akzent `#1B6B35`) | `#0B3A1C`, `#C6EDCF` (Akzent `#8AD5A0`) |
| Rücklage | `#DCE1FF`, `#071A4D` (Akzent `#3F55A5`) | `#25397F`, `#DCE1FF` (Akzent `#B4C3FF`) |
| Achtung | `#FFE3B3`, `#2A1800` (Akzent `#8A5100`) | `#4E3200`, `#FFE3B3` (Akzent `#FFB95B`) |
| Schulden | `#E1E3EC`, `#1A1D2A` (Akzent `#565C70`) | `#2C3040`, `#E1E3EC` (Akzent `#B9BED3`) |

Offen: der Rückfall-Farbton (die alte App nutzt Petrol `#2F667A`) und die Schema-Variante (Notizen: `tonalSpot` als Alltag).

## Typografie

- **Schrift:** Google Sans Flex, lokal eingebunden, Lizenz OFL (aus der alten App übernommen). Im Dummy nur die Gewichtsachse.
- **Skala im Dummy (100 %):** Hauptzahl bis 44 px, höchstens 14 % der Kartenbreite, damit sie bei 200 % Schrift schrumpft statt abzuschneiden. Ansichtstitel 22 px, Thema 24 px, Abschnitt 18 px, Text 16 px, Zusatz 14 px, Chip 13 px. Offen: Übertragung auf die Material-Skala in Compose.
- **Zahlen:** tabellarische Ziffern, deutsches Format `1.482,60 €` mit geschütztem Leerzeichen, negatives Vorzeichen als Minuszeichen (`−3.983,46 €`). Prozente ganz, die Summe ergibt 100 %. Daten als „12. Okt.“ und „Februar 2029“.
- **Größen:** Touch-Ziele mindestens 48 dp, Schrift bis 200 % ohne abgeschnittene oder überlappende Texte.

## Bausteine

Elf Bausteine, dazu Rahmen (Kopfzeile mit „Beträge ausblenden“, Navigationsleiste mit den vier Ansichten).

| Baustein | Zweck und Regeln |
| --- | --- |
| Hauptzahl-Karte | Frage, Antwort groß, ein Satz Herleitung, Datenalter-Chip, „So gerechnet“. Eine pro Ansicht. |
| Kennzahl | Name, Wert, Kurzbeschreibung. Ein Tipp klappt „So gerechnet“ auf. |
| Rechenweg („So gerechnet“) | Frage, Schritte mit den einbezogenen Posten, Ergebnis, Hinweis, Status und ältester verwendeter Stand. |
| Liste | Zeile mit Titel, Zusatz, Betrag rechts, optional Chip und Pfeil. |
| Hinweis | Ruhige Karte mit Titel, Text, Betrag pro Monat und Jahr, Rechenweg, „Bewusst so“. Daneben die Achtung-Meldung bei alten Ständen. |
| Leerzustand | Was fehlt, ein Satz, ein Schritt zur Lösung. Nie eine leere Fläche. |
| Datenalter-Chip | „Stand vom 12. Okt.“, bei alt mit Uhr, Alter in Tagen und gestricheltem Rand. Form und Text tragen die Aussage, nicht nur die Farbe. |
| Betragsfeld | Ziffern und ein Komma, darunter „Gelesen als 1.482,60 €“. Optional „Im Minus“. Ungültiges sagt, wie es richtig geht. |
| Auswahl | Chips für eine Wahl, Vorlagenliste mit Häkchen für mehrere. |
| Schrittanzeige | „Thema 2 von 6“ mit Fortschrittsbalken, Zurück, „Später“. |
| Aufteilungsbalken | Anteile des Einkommens, dazu Liste mit Name, Prozent und Betrag. Die Liste trägt die Information, der Balken zeigt sie. |

Begründete Ergänzung: das Verlaufsdiagramm „Weg auf null“ für den Restschuldverlauf, mit Liste als Alternative.

**Zustand jedes Werts:** Status (belastbar, beruht auf alten Daten, nicht berechenbar) und Art (eingetragen, geplant, berechnet, geschätzt) stehen sichtbar dabei.

## Ton der Texte

- **Du, ruhig, kurz, konkret.** Keine Ausrufezeichen, keine Gamification, kein Lob und kein Druck.
- **Nie beschämend.** Nicht „Du hast deine Daten vernachlässigt“, sondern „4 Stände sind älter als 7 Tage“. Hinweise schlagen vor, du entscheidest. Keine Tarif- oder Anbieterempfehlung.
- **Ehrlich zu Daten.** „Stand vom 3. Okt.“ statt „Aktuell“. Fehlendes heißt „Es fehlt: Gehaltstag“, nichts wird erfunden.
- **Fehler nennen, was passiert ist.** „Gerade keine Verbindung, nichts wurde gespeichert.“
- **Hinweise** nennen Betrag pro Monat und Jahr, Grund und Rechenweg. „Bewusst so“ blendet aus, bis sich der Posten ändert.
- **Begriffe:** Bis Gehalt verfügbar, Frei im Monat, Restschuld, Ablösesumme (Obergrenze), Schuldenfrei. Notwendigkeit: Existenziell, Notwendig, Sinnvoll, Optional, Unnötig. accura schreibt sich immer klein.

## Barrierefreiheit

Jedes interaktive Element hat einen Namen, 48 dp, sichtbaren Fokus. Eingaben haben Beschriftungen. Der Dummy prüft das im Browser und per Skript, TalkBack nicht. Ein Durchgang von Hand folgt mit der App.

## Offen

- Quelle und Spanne des Lebensmittel-Richtwerts (im Dummy Platzhalter).
- Wie viele Einspar-Hinweise wo sichtbar sind (Dummy: einer auf der Übersicht, zwei im Budget, alle auf eigener Seite).
- Welche Vorlagen für feste Kosten (Dummy: 16).
- Ab wann ein Stand „alt“ ist (Dummy: nach 7 Tagen) und wie früh der Kündigungs-Hinweis kommt (Dummy: 120 Tage vorher).
- Rückfall-Farbton, Schema-Variante, Rolle der Rücklage-Farbe.
- Aufbau der Navigation jenseits der vier Ansichten (Dummy: „Mehr“ oben rechts).
- Die Festlegungen zu den Kennzahlen im Dummy (Konten zählen als verfügbar, Puffer, Obergrenze der Entschädigung) sind Annahmen. Der Rechenkern in Phase 2 legt sie verbindlich fest.
