# Rechenregeln und Antworten der Ansichten

Quelle: `convex/lib/` (reine Funktionen), getestet in `tests/lib/`. Der Rechenkern kennt keine Datenbank und keine Uhr. Die Abfragen laden Daten, rufen den Kern und wandeln das Ergebnis mit `toWire`.

## Grundregeln

- **Cent.** Alle Beträge sind sichere Integer in Cent. Multiplikation mit anschließender Division läuft über BigInt (`lib/money.ts`).
- **Rundung.** Auf ganze Cent und Basispunkte wird kaufmännisch gerundet, halbe Werte von null weg (2,5 → 3, −2,5 → −3). Ausnahmen, immer abgerundet: Tagesrahmen und Puffer (siehe unten).
- **Anteile** in Basispunkten (10.000 = 100 %) sind einzeln gerundet. Ihre Summe kann um 1 bis 2 Basispunkte von 10.000 abweichen. Die Cent-Beträge dahinter gehen genau auf. Ohne positive Bezugsgröße ist der Anteil `null`.
- **Kalender.** Tage sind `"JJJJ-MM-TT"`, gerechnet wird über Tagesnummern (`lib/calendar.ts`), nie über `Date` in einer Zeitzone. **Das heutige Datum ist ein Argument** jeder Abfrage (`today`) und kommt aus Stevens Zeitzone. Es gibt keine Uhr in Abfragen, weil Convex Abfrageergebnisse zwischenspeichert. `calendarDayInZone` rechnet einen Zeitpunkt in einen Tag um (für Mutationen, etwa den Tag eines `recordedAt`).
- **Tag 29 bis 31** rutscht in kurzen Monaten auf den letzten Tag. Bei Raten bleibt der Tag der ersten Rate maßgeblich (31. Jan. → 28. Feb. → 31. März).
- **Negative Werte bleiben negativ.** Nichts wird auf null geschönt.
- **Erfundene Werte gibt es nicht.** Fehlt ein nötiger Stand oder ein Eckwert, ist die Kennzahl `unavailable` mit Begründung.
- **Pockets** sind eine zweite Sicht auf dasselbe Geld und werden nie zu den Konten addiert.

## Kennzahl-Paket (`Metric`)

Jede Kennzahl hat dieselbe Form:

| Feld | Bedeutung |
| --- | --- |
| `key`, `unit` | Name; Einheit: `cents`, `bps`, `monthsX100` (Monate mal 100), `days`, `count`, `day` (Wert steht dann in `day`) |
| `kind` | `actual` eingetragen, `planned` geplant (Budget, Vertrag), `estimated` geschätzt (Obergrenze), `calculated` berechnet |
| `value`, `day` | Wert oder `null` |
| `status` | `ok` belastbar, `stale` beruht auf alten Daten, `unavailable` nicht berechenbar |
| `reason` | Begründung bei `unavailable` oder `stale`, sonst `null` |
| `dataAgeDays`, `oldestDataDay` | Alter des ältesten verwendeten Standes bis heute; `null` ohne datierte Stände |
| `steps` | Rechenweg („So gerechnet“): Liste aus `op` (`start`, `plus`, `minus`, `result`, `note`), `label` und je einem der Werte `cents`, `bps`, `count`, `day` |

Die Labels der Rechenwege sind deutsche Texte aus dem Backend (feste Formulierungen plus Namen der Posten).

**Datenalter.** Kontostände und Pockets gelten ab 7 Tagen als alt (`BALANCE_STALE_AFTER_DAYS`), bestätigte Kreditstände ab 90 Tagen (`DEBT_ANCHOR_STALE_AFTER_DAYS`). Eine Summe nimmt den ältesten beteiligten Stand. Alt heißt: Wert wird gezeigt, aber als `stale` gekennzeichnet.

## Kennzahlen

| Kennzahl (`key`) | Regel |
| --- | --- |
| `accountsTotal` | Summe der jüngsten Stände aller aktiven Konten bis heute. Fehlt einem aktiven Konto der Stand, ist sie `unavailable`. |
| `pocketsTotal` | Wie oben für Pockets, nur Information. |
| `pendingPayments` | Summe der Zahlungen im Fenster [heute, nächster Gehaltstag). |
| `availableUntilSalary` | `accountsTotal − pendingPayments`. Ohne Gehaltstag `unavailable`. |
| `dailyAllowance` | `availableUntilSalary ÷ Tage bis zum Gehalt`, **abgerundet**, damit Tage × Tagesrahmen den Betrag nie übersteigen. Am Gehaltstag selbst `unavailable`. |
| `freeMonthly` | `Einkommen − aktive Budgetposten (Ausgaben und Rücklagen) − Monatsraten laufender Kredite`. Ohne Einkommen `unavailable`. |
| `bufferMonths` | `accountsTotal ÷ notwendige Kosten pro Monat`, in Hundertstel Monaten, abgerundet. Notwendige Kosten: aktive Ausgaben der Stufen `essential` und `necessary` plus Monatsraten (Rücklagen zählen nicht). Ohne solche Kosten `unavailable`. |
| `netWorth` | `accountsTotal − Ablösesumme höchstens` aller Schulden. |
| `debtRemaining` | Summe der Restschulden nach Plan. |
| `payoffMax` | Summe der Restschulden plus Obergrenze der Entschädigung (siehe unten). |
| `interestToEnd` | Zinsen aller noch offenen Raten bis Laufzeitende. |
| `extraCostVsPayoff` | Noch planmäßig zu zahlen minus `payoffMax`. |
| `debtFreeDay` | Letzte Rate aller laufenden Kredite. Ohne laufende Schulden `day = null`, Status `ok`. |

**Fälligkeiten (Demnächst).** Das Fenster beginnt heute (heute fällige Zahlungen zählen mit) und endet vor dem nächsten Gehaltstag (Zahlungen am Gehaltstag selbst zählen nicht). Der Gehaltstag ist der nächste am oder nach heute. Budgetposten mit `dueDay` fallen monatlich an, solange `contractEndDay` nicht überschritten ist. Kredite liefern ihre Raten aus dem Tilgungsplan, einschließlich der Schlussrate. „Kurz vor Gehalt“ gilt für Fälligkeiten 1 bis 7 Tage vor dem Gehalt. Gegenüber der Altanwendung gilt neu: Ohne Gehaltstag zeigt die App keine Zahl, statt den Kontostand als „sicher verfügbar“ auszugeben.

**Monatsraten.** Als Rate zählt jeder aktive Kredit, der ab heute noch eine Rate hat, mit seiner Monatsrate. Ein Kredit, dessen erste Rate noch aussteht, zählt schon mit (vorsichtig geplant).

**Entlastung.** Ein Kredit gibt seine Monatsrate ab dem Monat nach der letzten Rate frei. Gleiche Monate werden zusammengefasst, `freeAfterCents` summiert fortlaufend auf `freeMonthly`.

**Verlauf der Restschuld.** Gesamtrestschuld heute und danach am Ende jedes Monats mit mindestens einer Rate.

## Tilgungsplan (`lib/amortization.ts`)

Eingabe: Startbetrag, Sollzins (Basispunkte), Monatsrate, erste Rate, Anzahl der Raten, optional Schlussrate und erlaubte Sondertilgung pro Jahr.

- Rate *i* ist am Tag der ersten Rate plus *i − 1* Monate fällig.
- **Zins je Periode** = Restschuld × Sollzins ÷ 12, auf ganze Cent gerundet. Banken zählen Zinstage teils anders, deshalb weicht der Plan um Cents bis wenige Euro ab. Die Abweichung zeigt die App gegenüber dem Bankstand.
- Jede Rate zahlt höchstens Restschuld plus Zins; ist die Schuld früher getilgt, endet der Plan früher.
- Die letzte Rate ist die Schlussrate laut Vertrag, sonst Restschuld plus Zins. Passt eine vertragliche Schlussrate nicht zur Rechnung, bleibt ein Rest (`residualCents`) mit Warnung `unexpected_residual`. Warnungen gibt es außerdem für Raten unter dem Zins (`payment_below_interest`) und eine abgeleitete letzte Rate von mehr als dem Doppelten der Monatsrate (`final_payment_far_from_rate`).
- **Restschuld nach Plan.** Raten mit Fälligkeit **vor** heute gelten als bezahlt. Eine Rate am heutigen Tag gilt als noch offen (der Kontostand kann sie noch nicht enthalten) und steht in „Demnächst“. Vor der ersten Rate ist die Restschuld der Startbetrag.
- **Bankstand als Ausgangspunkt.** Trägt Steven einen Bankstand ein, rechnet der Plan ab diesem Tag mit diesem Wert weiter. Der Stand gilt nach allen Raten, die am Stichtag oder davor fällig waren. Die Abweichung ist Bankstand minus Plan am selben Tag, positiv heißt: die Bank sieht mehr Schuld.
- **Ablösesumme.** Restschuld plus Obergrenze der Vorfälligkeitsentschädigung: 1 % der Restschuld, bei höchstens 12 verbleibenden Raten 0,5 %, nie mehr als die Zinsen bis zum planmäßigen Ende (Annahme nach § 502 BGB, siehe offene Fragen im PR). Zinslose Ratenkäufe haben keine Entschädigung. Nennt die Bank eine Ablösesumme zum Bankstand und wurde seither keine Rate fällig, gilt diese.
- **Sondertilgung.** Der Grundplan setzt keine Sondertilgung an, sie ist nur erlaubt. Hat der Kredit eine erlaubte jährliche Summe, rechnet die App ein Beispiel: Sondertilgung nach jeder 12. Rate bis zur Restschuld, mit Enddatum und gesparten Zinsen. Es ist als `kind: estimated` gedacht und ändert keine andere Kennzahl.

## Ansichten (Abfragen)

Alle erwarten `today` und liefern ein Modell, in dem jede Ganzzahl `int64` ist. Typen: `lib/views.ts`.

| Abfrage | Inhalt |
| --- | --- |
| `views:overview` | Konten und Pockets mit Stand und Alter, `accountsTotal`, `availableUntilSalary`, `dailyAllowance`, `freeMonthly`, `bufferMonths`, `netWorth`, `debtRemaining`, `debtFreeDay`, Aufteilung des Einkommens, nächste Entlastung, Datenalter je Stand |
| `views:budget` | Status (`empty`, `income_missing`, `within_budget`, `overdrawn`), Einkommen, Ausgaben, Rücklagen, Raten, `freeMonthly`, Auslastung, Posten nach Notwendigkeit und Kategorie |
| `views:debts` | je Kredit: Vertragsdaten, Restschuld (Kennzahl), nächste und letzte Rate, Restzahlungen, Zinsen, Ablösesumme, Abweichung vom Bankstand, Beispiel Sondertilgung, Warnungen; dazu die Summen, Entlastungen und der Verlauf |
| `views:debtSchedule` | Tilgungsplan eines Kredits (Raten ab dem Bankstand, `paid` oder `upcoming`) |
| `views:upcoming` | Gehaltstag, Tage bis dahin, Zahlungen, `pendingPayments`, `availableUntilSalary`, `dailyAllowance` |

Aus der Altanwendung übernommen (und in `tests/lib/views.test.ts` nachgebildet) sind die Regeln und Grenzfälle zu Gehaltstag, Fälligkeitstag am Monatsende und im Schaltjahr, Zahlung am Gehaltstag, Zahlung von gestern, negative Kontostände, leere Budgets, Einkommen ≤ 0 und sehr große Beträge. Die Testdaten sind neu ausgedacht; sie stehen in `convex/lib/fixtures.ts`.

## Noch nicht gebaut

Einspar-Hinweise und Lebensmittel-Richtwert, Plan gegen Ist-Ausgaben, Sparziele, „Was wäre wenn“ jenseits der Sondertilgung, Verlauf und Monatsvergleich sowie alle schreibenden Funktionen außer `users:ensureUser`.
