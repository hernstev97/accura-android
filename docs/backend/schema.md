# Schema

Quelle: `convex/schema.ts`. Ausgangspunkt war Anhang B des Plans.

## Regeln

- **Jede Ganzzahl ist `int64`** (`bigint` in TypeScript, `Long` in Kotlin): Cent, Basispunkte, Tage, Anzahlen, Reihenfolge. Kommazahlen (`float64`) kommen weder in der Datenbank noch in Antworten vor. Der Rechenkern rechnet mit sicheren Integern und wandelt an der Grenze (`lib/wire.ts`). `toWire` bricht ab, wenn eine Kommazahl in einer Antwort auftaucht.
- **Kalendertage** sind Text `"JJJJ-MM-TT"` ohne Zeitzone. **Zeitpunkte** (`recordedAt`, `createdAt`) sind Millisekunden seit 1970 als `int64`.
- **Besitzer:** Jede Tabelle außer `users` hat `userId` und einen Index, der damit beginnt.
- **Stände** (`accountBalances`, `pocketBalances`, `debtBalances`) sind Zeilen mit Tag und `recordedAt`. Gerechnet wird mit dem jüngsten Stand bis einschließlich heute; spätere Stände zählen nicht. Bei mehreren Ständen am selben Tag gilt der zuletzt angelegte.

## Tabellen

| Tabelle | Felder | Index |
| --- | --- | --- |
| `users` | `clerkTokenIdentifier`, `homeTimeZone`, `monthlyIncomeCents?`, `salaryDay?`, `createdAt` | `by_token_identifier` |
| `accounts` | `userId`, `name`, `kind` (bank, wallet, cash), `order`, `active` | `by_user` |
| `accountBalances` | `userId`, `accountId`, `day`, `balanceCents`, `recordedAt` | `by_user_account_day` |
| `pockets` | `userId`, `accountId`, `name`, `order`, `active` | `by_user` |
| `pocketBalances` | `userId`, `pocketId`, `day`, `balanceCents`, `recordedAt` | `by_user_pocket_day` |
| `budgetItems` | `userId`, `label`, `monthlyAmountCents`, `necessity`, `kind` (expense, reserve), `category`, `dueDay?`, `contractEndDay?`, `noticePeriodDays?`, `waivedHintAt?`, `note?`, `order`, `active` | `by_user` |
| `debts` | `userId`, `lender`, `kind` (loan, installment), `principalCents`, `nominalRateBps`, `effectiveRateBps`, `monthlyPaymentCents`, `firstPaymentDay`, `paymentCount`, `finalPaymentCents?`, `specialRepaymentYearlyCents?`, `note?`, `order`, `active` | `by_user` |
| `debtBalances` | `userId`, `debtId`, `day`, `balanceCents`, `payoffQuoteCents?`, `recordedAt` | `by_user_debt_day` |
| `householdMembers` | `userId`, `label`, `dailyKcal` | `by_user` |

`necessity`: `essential`, `necessary`, `worthwhile`, `optional`, `unnecessary`. Sollzins und effektiver Jahreszins in Basispunkten (4,99 % = 499). Der effektive Jahreszins wird gespeichert und angezeigt, aber nicht gerechnet.

Es gibt keine Tabellen für Entlastungen, Meilensteine oder Summen. Alles folgt aus den Kreditdaten (siehe [rechenregeln.md](rechenregeln.md)). Die Tabelle `householdMembers` ist angelegt, es gibt aber noch keine Funktion dafür.

## Abweichungen vom Plan (Anhang B)

| Abweichung | Grund |
| --- | --- |
| Auch Nicht-Geld-Ganzzahlen (`salaryDay`, `dueDay`, `order`, `paymentCount`, Basispunkte, `dailyKcal`) sind `int64` statt `number`. | Der Kotlin-Client liest ein JavaScript-`number` nur als `Double` und `BigInt` als `Int`/`Long` ([Datentypen](https://docs.convex.dev/client/android/data-types)). Mit einer einzigen Regel „jede Ganzzahl ist `int64`“ braucht die App nirgends `Double` und kann keine Kommazahl für Geld verwenden. |
| `users.monthlyIncomeCents` und `users.salaryDay` sind optional. | Der Nutzer entsteht beim ersten Anmelden, Einkommen und Gehaltstag kennt erst die Ersterfassung. Ein erfundener Standardwert wäre eine falsche Zahl. Ohne Wert sind die abhängigen Kennzahlen „nicht berechenbar“. |
| `debtBalances.source: "bank"` entfällt. | Ein Feld mit genau einem möglichen Wert trägt keine Information. Die Tabelle steht für bestätigte Bankstände. |
| `users.homeTimeZone` ist beim Anlegen `Europe/Berlin`, falls die App nichts mitschickt. | Annahme für Stevens Wohnort. Die App kann sie beim Anlegen setzen. |
| Zusätzlicher Index über `(userId, Konto/Pocket/Kredit, day)` statt eines allgemeinen. | Erlaubt, je Konto genau den jüngsten Stand bis heute zu lesen, ohne die ganze Historie zu laden. |

Nicht umgesetzt (kommt mit den Phasen 3 und 4): Funktionen zum Anlegen und Ändern von Konten, Posten und Krediten samt Konfliktschutz; alles rund um Einspar-Hinweise und Haushalt.

## Prüfung der Daten

Die Abfragen nehmen gespeicherte Werte als gegeben, prüfen aber die Vertragsdaten eines Kredits (`validateTerms` in `lib/amortization.ts`): Beträge ganz und nicht negativ, Zins 0 bis 100 %, 1 bis 600 Raten, gültiger Tag der ersten Rate. Ein Kredit mit ungültigen Daten erscheint als `state: "invalid"` mit Hinweisen und lässt die Summen „nicht berechenbar“ werden, statt falsch zu rechnen. Die schreibenden Funktionen (Phase 4) müssen dieselben Regeln beim Speichern erzwingen, insbesondere gültige Kalendertage (`isCalendarDay`) und ganze Zahlen im sicheren Bereich.
