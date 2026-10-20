# Klick-Dummys

> **Zielgruppe:** Steven zum Durchklicken am Handy; Agenten, die den Prototyp bauen.
> **Zweck und Lernziel:** Reihenfolge, Inhalt und Texte der Abläufe prüfen, bevor die App gebaut wird.
> **Voraussetzungen:** Python 3 (nur zum Ausliefern). Keine Installation, kein Konto, kein Build.
> **Kanonisch für:** Start und Aufbau der Dummys. Die Regeln stehen im [Leitfaden](../docs/design/leitfaden.md).
> **Verwandte Dokumente:** [Plan](../docs/neubau/plan.md), Abschnitt „Der Weg dahin“

Grobe, mobile HTML-Prototypen: reines HTML, CSS und JavaScript, ohne Build-Kette und ohne externe Abhängigkeiten. Schrift und Symbole liegen lokal, beim Betrachten wird nichts aus dem Netz geladen und nichts gesendet. **Alle Zahlen sind ausgedacht.** Es geht um Reihenfolge, Inhalt und Texte, nicht um Optik. Bewegung und Expressive-Formen zeigt erst der Compose-Prototyp.

## Am Handy öffnen

1. Rechner und Handy im selben WLAN (kein Gastnetz).
2. Auf dem Rechner im Repo:

   ```sh
   scripts/serve-dummies.sh
   ```

   Das Skript gibt die Adresse im Heimnetz aus, zum Beispiel `http://192.168.178.51:8421/`, und einen QR-Code, wenn `qrencode` installiert ist.
3. Die Adresse im Handy-Browser öffnen. Beenden mit Strg+C.

Es wird nichts veröffentlicht: Der Server hört nur im lokalen Netz und liefert nur den Ordner `design/dummies`. Anderer Port: `PORT=9000 scripts/serve-dummies.sh`. Nur auf dem Rechner ausprobieren: `scripts/serve-dummies.sh --local`. Ohne Skript geht auch `python3 -m http.server --bind 0.0.0.0` im Ordner `design/dummies`.

Erreicht das Handy den Rechner nicht, liegt es meist an der Firewall des Rechners (Port freigeben) oder an einem WLAN mit Geräteisolierung.

## Was man durchklickt

Der Einstieg ist das **Dummy-Menü** (oben rechts auf jedem Bildschirm). Der Zustand lebt nur in diesem Browser-Tab und verschwindet mit dem Tab. „Dummy zurücksetzen“ im Menü stellt alles zurück. „Heute“ ist im Dummy fest der 13. Oktober 2026.

| Ablauf | Worauf es ankommt |
| --- | --- |
| 1. Ersterfassung | Startet leer. Ein Thema pro Bildschirm: Einkommen, Konten, Pockets, feste Kosten (Vorlagen), Kredite (vollständig), Haushalt. Jederzeit mit „Später“ unterbrechbar. Reicht die Reihenfolge? Fehlt eine Frage, ist eine zu viel? Schafft man es in einer Sitzung? |
| 2. Stände aktualisieren | Mit Testdaten, vier Stände sind alt. Ein Stand pro Bildschirm, alter Wert vorausgefüllt. Am Ende zeigt der Dummy die Dauer. Ziel: unter zwei Minuten. |
| 3. Die vier Ansichten | Übersicht, Demnächst, Budget, Schulden, mit Daten und (im Menü „Leer“) leer. Beantwortet jede oben ihre Frage? |
| 4. Kennzahlen | Alle Kennzahlen mit „So gerechnet“, Status und Art des Werts. Leuchtet der Rechenweg ein? |
| 5. Einspar-Hinweise | Vier Hinweise, „Bewusst so“, Rückkehr bei Änderung (Dummy-Hilfe unten auf der Seite). Wirken sie ruhig, nie beschämend? |
| 6. Datenalter | Chips auf allen Zahlen, Übersicht aller Stände, Hinweis bei alten Ständen. |

**Dummy-Menü, Einstellungen:** Datenstand (Testdaten oder leer), Schriftgröße 100 / 150 / 200 % zum Prüfen großer Schrift, Hell, Dunkel oder System. „Beträge ausblenden“ ist das Auge in der Kopfzeile. Gestrichelte Kästen mit „Dummy-Hilfe“ füllen Felder mit Testwerten, damit du nicht tippen musst. Sie gehören nicht zur App.

## Aufbau

```
design/
  README.md           diese Datei
  dummies/            der Dummy, wird ausgeliefert
    index.html
    css/app.css       Farbrollen und Bausteine
    js/core.js        Geld in Cents, Datumsrechnung (reine Funktionen)
    js/calc.js        Rechenkern des Dummys: Kennzahlen mit Rechenweg, Tilgungsplan, Hinweise
    js/data.js        ausgedachte Testdaten
    js/ui.js          die Bausteine
    js/screens-*.js   Ansichten und Abläufe
    js/app.js         Zustand, Routing, Aktionen
    assets/fonts/     Google Sans Flex (OFL), lokal
  check/pruefen.cjs   Prüfung ohne Browser
scripts/serve-dummies.sh
```

## Prüfen

```sh
nice -n 19 node design/check/pruefen.cjs
```

Das Skript prüft ohne Abhängigkeiten: Geld und Datum (Cents, Format, Monatsende, Schaltjahr), die Summen des Rechenkerns, dass dieselbe Kennzahl auf jeder Ansicht denselben Wert zeigt, Kontraste der Farbrollen hell und dunkel, doppelte IDs und unbeschriftete Eingaben in allen Ansichten, kein externer Zugriff im Quelltext.

## Grenzen

- **Der Dummy rechnet im Browser.** Im Neubau rechnet Convex, die App zeigt nur an (Plan). Die Rechenregeln hier sind Annahmen und stehen im Leitfaden unter „Offen“. Verbindlich werden sie erst mit dem Rechenkern in Phase 2.
- **Nicht gezeigt:** Anmeldung, Sperre, Offline, Export, Bearbeiten einzelner Posten, Erinnerungen, echte Bewegung, Dynamic Color. Im Menü „Mehr“ stehen sie als Platzhalter.
- **Zeitmessung** und **Dummy-Hilfe** gibt es nur im Dummy.
- Die Prüfung ersetzt weder TalkBack noch einen Test auf dem Pixel.

## Daten und Lizenz

Alles ist ausgedacht, keine echten Finanzdaten (die gehören nie ins Repo). Die Schrift Google Sans Flex steht unter der SIL Open Font License 1.1, der Lizenztext liegt in `dummies/assets/fonts/`.
