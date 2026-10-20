# Rechenregeln und Antworten der Ansichten

Quelle: `convex/lib/` (reine Funktionen), getestet in `tests/lib/`. Der Rechenkern kennt keine Datenbank und keine Uhr. Die Abfragen laden Daten, rufen den Kern und wandeln das Ergebnis mit `toWire`.

## Grundregeln

- **Cent.** Alle Beträge sind sichere Integer in Cent. Multiplikation mit anschließender Division läuft über BigInt (`lib/money.ts`).
- **Rundung.** Auf ganze Cent und Basispunkte wird kaufmännisch gerundet, halbe Werte von null weg (2,5 → 3, −2,5 → −3). Ausnahmen, immer abgerundet: Tagesrahmen und Puffer (siehe unten).
- **Anteile** in Basispunkten (10.000 = 100 %) sind einzeln gerundet. Ihre Summe kann um 1 bis 2 Basispunkte von 10.000 abweichen. Die Cent-Beträge dahinter gehen genau auf. Ohne positive Bezugsgröße ist der Anteil `null`. **Ausnahme Einkommens-Ring** (`incomeSplit` der Übersicht): Dort summieren sich die Anteile exakt auf 10.000. Der Rest nach dem Runden (meist −2 bis +2) geht an den größten Anteil, bei Gleichstand an den ersten (`splitBps` in `lib/money.ts`). Beispiel: 7.167 + 1.355 + 1.000 + 479 = 10.001, also bekommt der größte Anteil 7.166. Zum Anzeigen liefert jeder Ring-Anteil zusätzlich `sharePercent`, ganze Prozent, die sich auf genau 100 summieren. Hier gilt das Verfahren des größten Rests (`splitWholePercent`): alle Anteile abrunden, die fehlenden Punkte gehen an die Anteile mit dem größten Rest. Einzeln gerundet wären es 72 + 14 + 10 + 5 = 101, mit größtem Rest 72 + 13 + 10 + 5 = 100. „Rest an den größten Anteil“ hätte hier 71 + 14 + 10 + 5 ergeben, also 71,67 % als 71 % gezeigt. Mit negativem Anteil gilt die Regel von `splitBps`. Die App rundet nicht selbst.
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
| `availableUntilSalary` | `accountsTotal − pendingPayments`. Ohne Gehaltstag `unavailable` (`salaryStatus: "missing"`). |
| `dailyAllowance` | `availableUntilSalary ÷ Tage bis zum Gehalt`, **abgerundet**, damit Tage × Tagesrahmen den Betrag nie übersteigen. Am Gehaltstag selbst `unavailable`. |
| `freeMonthly` | `Einkommen − aktive Budgetposten (Ausgaben und Rücklagen) − Monatsraten laufender Kredite`. Ohne Einkommen `unavailable`. |
| `bufferMonths` | `accountsTotal ÷ notwendige Kosten pro Monat`, in Hundertstel Monaten, abgerundet. Notwendige Kosten: aktive Ausgaben der Stufen `essential` und `necessary` plus Monatsraten (Rücklagen zählen nicht). Ohne solche Kosten `unavailable`. |
| `netWorth` | `accountsTotal − Ablösesumme höchstens` aller Schulden. |
| `debtRemaining` | Summe der Restschulden nach Plan. |
| `payoffMax` | Summe der Restschulden plus Obergrenze der Entschädigung (siehe unten). |
| `interestToEnd` | Zinsen aller noch offenen Raten bis Laufzeitende. |
| `extraCostVsPayoff` | Noch planmäßig zu zahlen minus `payoffMax`. |
| `debtFreeDay` | Letzte Rate aller laufenden Kredite. Ohne laufende Schulden `day = null`, Status `ok`. |

**Fälligkeiten (Demnächst).** Das Fenster beginnt heute (heute fällige Zahlungen zählen mit) und endet vor dem nächsten Gehaltstag (Zahlungen am Gehaltstag selbst zählen nicht). Der Gehaltstag ist der nächste am oder nach heute. Budgetposten mit `dueDay` fallen monatlich an, solange `contractEndDay` nicht überschritten ist. Kredite liefern ihre Raten aus dem Tilgungsplan, einschließlich der Schlussrate. „Kurz vor Gehalt“ gilt für Fälligkeiten 1 bis 7 Tage vor dem Gehalt. Gegenüber der Altanwendung gilt neu: Ohne Gehaltstag gibt es keine Zahl, statt den Kontostand als „sicher verfügbar“ auszugeben. Übersicht und Demnächst melden dann `salaryStatus: "missing"` (sonst `"set"`); `pendingPayments`, `availableUntilSalary` und `dailyAllowance` sind `unavailable` mit dem Grund „Der Gehaltstag fehlt.“ und einem Rechenweg aus einer Zeile (`note`), die erklärt, dass der Gehaltstag einzutragen ist. Ein ungültiger Gehaltstag (nicht 1 bis 31) zählt als fehlend.

### Zahlungen rund um den Gehaltstag (Regel von heute, noch nicht bestätigt)

Das Fenster „bis Gehalt“ ist halboffen: Es beginnt heute und endet am Gehaltstag, ohne ihn einzuschließen. Eine Zahlung, die heute fällig ist, zählt also mit, eine Zahlung am Gehaltstag selbst nicht, weil sie als vom neuen Gehalt gedeckt gilt. Ist heute der Gehaltstag, ist das Fenster leer: keine Zahlungen, kein Tagesrahmen, und „bis Gehalt verfügbar“ ist der volle Kontostand. Am Tag danach beginnt das Fenster bis zum nächsten Gehaltstag. Ein Gehaltstag über 28 rutscht im kurzen Monat auf den letzten Tag, eine Zahlung mit Tag 29 bis 31 ebenso; fallen beide auf denselben Tag, zählt die Zahlung nicht. Wochenenden kennt die Regel nicht, der Gehaltstag bleibt der Kalendertag. Folge: Eine Zahlung genau am Gehaltstag erscheint in keinem Zeitraum und wird nirgends abgezogen. Belegt durch `tests/lib/gehaltstag.test.ts`; Konto 1.000,00 €, Zahlung 100,00 €.

| Fall | Heute | Gehaltstag | Zahlung am | zählt bis Gehalt? | Verfügbar bis Gehalt |
| --- | --- | --- | --- | --- | --- |
| Tag davor | 20.08.2026 | 25.08. | 24.08. | ja | 900,00 € (180,00 € pro Tag) |
| Am Gehaltstag | 20.08.2026 | 25.08. | 25.08. | nein | 1.000,00 € (200,00 € pro Tag) |
| Tag danach | 20.08.2026 | 25.08. | 26.08. | nein, gehört zum nächsten Zeitraum | 1.000,00 € |
| Heute fällig | 20.08.2026 | 25.08. | 20.08. | ja | 900,00 € |
| Heute ist Gehaltstag | 25.08.2026 | 25.08. | 25.08. | nein, kein Fenster | 1.000,00 €, kein Tagesrahmen |
| Tag nach dem Gehaltstag | 26.08.2026 | 25.08. (nächster: 25.09.) | 25.08. | nein, vorbei und im nächsten Fenster nicht enthalten | 1.000,00 € |
| Kurzer Monat | 20.02.2026 | 31. → 28.02. | 30. oder 31. → 28.02. | nein, gleicher Tag | 1.000,00 € |
| Kurzer Monat, Tag davor | 20.02.2026 | 31. → 28.02. | 27.02. | ja | 900,00 € |
| Schaltjahr | 20.02.2028 | 31. → 29.02. | 29.02. / 28.02. | nein / ja | 1.000,00 € / 900,00 € |
| Wochenende | 20.08.2026 | 29.08. (Samstag) | 28.08. / 29.08. | ja / nein, keine Verschiebung auf Freitag | 900,00 € / 1.000,00 € |
| Monatsende | 28.08.2026 | 05.09. | 31.08. | ja | 900,00 € |
| Letzter Tag vor dem 1. | 30.08.2026 | 01.09. | 31.08. / 01.09. | ja / nein | 900,00 € / 1.000,00 € |
| Kreditrate | 10.09.2026 | 15.09. / 16.09. | Rate am 15.09. | nein / ja | – |

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
| `views:overview` | `salaryStatus`, Konten und Pockets mit Stand und Alter, `accountsTotal`, `availableUntilSalary`, `dailyAllowance`, `freeMonthly`, `bufferMonths`, `netWorth`, `debtRemaining`, `debtFreeDay`, Aufteilung des Einkommens, nächste Entlastung, Datenalter je Stand |
| `views:budget` | Status (`empty`, `income_missing`, `within_budget`, `overdrawn`), Einkommen, Ausgaben, Rücklagen, Raten, `freeMonthly`, Auslastung, Posten nach Notwendigkeit und Kategorie |
| `views:debts` | je Kredit: Vertragsdaten, Restschuld (Kennzahl), nächste und letzte Rate, Restzahlungen, Zinsen, Ablösesumme, Abweichung vom Bankstand, Beispiel Sondertilgung, Warnungen; dazu die Summen, Entlastungen und der Verlauf |
| `views:debtSchedule` | Tilgungsplan eines Kredits (Raten ab dem Bankstand, `paid` oder `upcoming`) |
| `views:upcoming` | `salaryStatus`, Gehaltstag, Tage bis dahin, Zahlungen, `pendingPayments`, `availableUntilSalary`, `dailyAllowance` |
| `views:hints` | Einspar-Hinweise, auch ausgeblendete (siehe [Einspar-Hinweise](#einspar-hinweise-libhintsts)) |

Aus der Altanwendung übernommen (und in `tests/lib/views.test.ts` nachgebildet) sind die Regeln und Grenzfälle zu Gehaltstag, Fälligkeitstag am Monatsende und im Schaltjahr, Zahlung am Gehaltstag, Zahlung von gestern, negative Kontostände, leere Budgets, Einkommen ≤ 0 und sehr große Beträge. Die Testdaten sind neu ausgedacht; sie stehen in `convex/lib/fixtures.ts`.

## Einspar-Hinweise (`lib/hints.ts`)

`views:hints` liefert alle Hinweise, auch ausgeblendete. Wie viele davon zu sehen sind und wo, entscheidet das Design. Gebaut sind zwei Hinweise, sie kommen in dieser Reihenfolge. Ein Hinweis ohne Posten fehlt in der Antwort. Den Lebensmittel-Richtwert gibt es noch nicht, weil die Quelle für den Preis offen ist.

| Hinweis (`type`) | Posten | Reihenfolge |
| --- | --- | --- |
| `subscriptions` (Abos und Verträge) | aktive Ausgaben der Kategorie „Abo“ oder „Vertrag“. Leerzeichen am Rand sowie Groß- und Kleinschreibung zählen nicht, „Abos“ ist eine andere Kategorie. | niedrigste Notwendigkeit zuerst, bei gleicher Stufe der höhere Betrag, dann die Reihenfolge im Budget |
| `lowNecessity` (Niedrige Notwendigkeit) | aktive Ausgaben der beiden unteren Stufen `optional` und `unnecessary` | wie oben |

Rücklagen und inaktive Posten zählen nie. Ein Abo mit niedriger Notwendigkeit steht in beiden Hinweisen, die Beträge der Hinweise darf man deshalb nicht addieren.

| Feld | Bedeutung |
| --- | --- |
| `monthlyCents`, `yearlyCents` | Summe der mitzählenden Posten pro Monat und pro Jahr (Monat × 12, exakt). Bei `lowNecessity` ist das der Betrag, der frei würde, wenn die Posten wegfielen. |
| `status` | `open`, wenn mindestens ein Posten mitzählt; `waived`, wenn alle Posten „bewusst so“ sind. Dann sind beide Beträge 0. |
| `reason` | Grund in ruhigen Sätzen. Er nennt keine Beträge, weil die App Beträge ausblenden kann, und empfiehlt weder Anbieter noch Tarife. |
| `steps` | Rechenweg wie bei Kennzahlen: jeder mitzählende Posten als `plus`, ausgeblendete als `note`, Summe im Monat, `note` „Monate im Jahr“ mit `count` 12, Summe im Jahr. Bei `subscriptions` folgen je eine `note` für jede Gruppe gleicher Art (`count`) und für jeden letzten Kündigungstag (`day`). |
| `items` | alle Posten des Hinweises, auch ausgeblendete: `label`, `category`, `necessity`, `contractType`, `monthlyCents`, `yearlyCents`, `status` (`open`, `waived`, `reopened`) und `cancellation` |
| `sameTypeGroups` | nur bei `subscriptions`: ab zwei mitzählenden Posten derselben Art eine Gruppe mit `contractType`, `itemIds` und Summe pro Monat und Jahr |

**Gleiche Art.** Die Art steht im Feld `contractType`, freier Text wie „Streaming“. Verglichen wird ohne Leerzeichen am Rand und ohne Groß- und Kleinschreibung, angezeigt wird die Schreibweise des ersten Postens. Posten ohne Art bilden keine Gruppe. Am Namen erkennt accura keine Anbieter.

**Bewusst so.** `hints:setWaived` mit `waived: true` speichert den Zeitpunkt (`waivedHintAt`) und einen Fingerabdruck des Postens (`waivedHintFingerprint`). Der Fingerabdruck enthält Betrag, Notwendigkeit, Ausgabe oder Rücklage, Kategorie, Art, Vertragsende und Kündigungsfrist. Solange der Posten dazu passt, ist er `waived` und zählt in keinem Hinweis mit. Ändert sich eines dieser Felder, ist er `reopened` und zählt wieder, bis Steven ihn erneut ausblendet. Name, Notiz, Reihenfolge und Fälligkeitstag gehören nicht dazu: Ein neuer Name holt den Hinweis nicht zurück. `waived: false` entfernt beide Felder.

### Letzter Kündigungstag (`lib/notice.ts`)

Bis zum letzten Kündigungstag muss die Kündigung beim Anbieter angekommen sein, damit der Vertrag zum erfassten Vertragsende endet. Er steht in `cancellation` jedes Postens, sobald Vertragsende oder Kündigungsfrist erfasst sind. Gerechnet wird ohne Uhr mit dem übergebenen `today`, nach §§ 187 und 188 BGB rückwärts vom Vertragsende:

- Frist in Tagen (`noticePeriodDays`): Vertragsende minus N Tage. Vier Wochen sind 28 Tage.
- Frist in Monaten (`noticePeriodMonths`): vom Tag nach dem Vertragsende N Monate zurück, davon der Vortag. Gibt es den Tag im Zielmonat nicht (30. Februar), beginnt die Frist am Ersten des Folgemonats.
- Wochenenden und Feiertage verschieben nichts. § 193 BGB gilt für Kündigungsfristen nicht.

| Vertragsende | Frist | Letzter Kündigungstag |
| --- | --- | --- |
| 31.12.2026 | 30 Tage | 01.12.2026 |
| 31.12.2026 | 3 Monate | 30.09.2026 |
| 31.03.2026 / 31.03.2028 | 1 Monat | 28.02.2026 / 29.02.2028 |
| 30.05.2026 | 3 Monate, einen 31. Februar gibt es nicht | 28.02.2026 |
| 01.03.2028 | 1 Tag | 29.02.2028 |

`state` ist `open` (heute oder später, `daysUntilLastNoticeDay` ab 0), `passed` (vorbei, die Zahl ist negativ), `incomplete` (Ende oder Frist fehlt) oder `invalid`. Ungültig sind ein Vertragsende, das kein Kalendertag ist, eine negative Frist, eine Frist über zehn Jahre (3.660 Tage, 120 Monate) und eine Frist in Tagen und Monaten zugleich. Bei `passed` sagt `reason`, ob nur der Kündigungstag oder schon das Vertragsende vorbei ist. Wie sich ein Vertrag verlängert, weiß accura nicht, also rechnet es keinen nächsten Termin aus. Steven trägt dann das neue Vertragsende ein.

Ein Test gleicht die Rückwärtsrechnung für jeden Tag der Jahre 2027 und 2028 und Fristen von 0 bis 13 Monaten mit der Vorwärtsregel aus § 188 BGB ab.

## Noch nicht gebaut

Lebensmittel-Richtwert, Plan gegen Ist-Ausgaben, Sparziele, „Was wäre wenn“ jenseits der Sondertilgung, Verlauf und Monatsvergleich sowie alle schreibenden Funktionen außer `users:ensureUser` und `hints:setWaived`.
