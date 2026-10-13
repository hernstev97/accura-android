# Bearbeiten, Stände und Export

Quelle: `convex/accounts.ts`, `pockets.ts`, `budgetItems.ts`, `debts.ts`, `household.ts`, `stands.ts`, `users.ts`, `records.ts`, `dataExport.ts`, gemeinsame Helfer in `convex/editing.ts` und `convex/lib/fields.ts`. Tests: `tests/editing.db.test.ts`, `tests/stands.db.test.ts`, `tests/export.db.test.ts`, `tests/editing.test.ts`, dazu jede Funktion in `tests/access.test.ts`.

Die Regeln für Tagesstände und Konfliktschutz stammen aus dem ACC-72-Editor des alten Repos (ADR 0015). Dort lief das über PostgreSQL und eine Planfunktion, hier ist jede Mutation eine Convex-Transaktion.

## Funktionen

Alle laufen über `ownerMutation` bzw. `ownerQuery`. Kein Argument nennt einen Besitzer, der Server nimmt immer den angemeldeten Nutzer. Ganzzahlen sind `int64`.

| Funktion | Argumente | Antwort |
| --- | --- | --- |
| `users:updateSettings` | `monthlyIncomeCents`, `salaryDay`, `homeTimeZone`, `expected` | `null` |
| `accounts:create` | `name`, `kind`, `order?` | `{ id }` |
| `accounts:update` | `id`, `name`, `kind`, `order`, `expected` | `null` |
| `accounts:setActive` | `id`, `active`, `expected` | `null` |
| `pockets:create` | `accountId`, `name`, `order?` | `{ id }` |
| `pockets:update` | `id`, `accountId`, `name`, `order`, `expected` | `null` |
| `pockets:setActive` | `id`, `active`, `expected` | `null` |
| `budgetItems:create` | `label`, `monthlyAmountCents`, `necessity`, `kind`, `category`, `dueDay?`, `contractType?`, `contractEndDay?`, `noticePeriodDays?`, `noticePeriodMonths?`, `note?`, `order?` | `{ id }` |
| `budgetItems:update` | `id`, alle Felder von `create` (Pflicht, `null` = leer), `expected` | `null` |
| `budgetItems:setActive` | `id`, `active`, `expected` | `null` |
| `debts:create` | `lender`, `kind`, `principalCents`, `nominalRateBps`, `effectiveRateBps`, `monthlyPaymentCents`, `firstPaymentDay`, `paymentCount`, `finalPaymentCents?`, `specialRepaymentYearlyCents?`, `note?`, `order?` | `{ id }` |
| `debts:update` | `id`, alle Felder von `create` (Pflicht, `null` = leer), `expected` | `null` |
| `debts:setActive` | `id`, `active`, `expected` | `null` |
| `household:create` | `label`, `dailyKcal` | `{ id }` |
| `household:update` | `id`, `label`, `dailyKcal`, `expected` | `null` |
| `household:setActive` | `id`, `active`, `expected` | `null` |
| `stands:record` | `day`, `accounts?`, `pockets?`, `debts?` (siehe unten) | `{ day, count }` |
| `records:list` | keine | alle Datensätze zum Bearbeiten |
| `dataExport:all` | keine | Export aller eigenen Daten |

Freiwillige Felder dürfen bei `create` fehlen oder `null` sein. Bei `update` sind alle Felder Pflicht: `update` ersetzt den ganzen Datensatz außer `active`, und ein vergessenes Feld soll nicht still gelöscht werden. Ohne `order` kommt ein neuer Datensatz hinter alle vorhandenen.

Haushaltsmitglieder haben nur Bezeichnung und Kalorienziel. Körperdaten nimmt der Validator nicht an, der Kalorienrechner gehört aufs Handy.

## Prüfungen beim Speichern

Der Server prüft jede Eingabe, die App muss nichts vorher richtig machen.

- Texte: Leerzeichen am Rand fallen weg. Namen höchstens 80 Zeichen, Kategorie und Art höchstens 40, Notizen höchstens 1.000. Steuerzeichen sind verboten, Zeilenumbrüche nur in Notizen. Ein leerer freiwilliger Text wird zu „nicht gesetzt“, ein leerer Pflichttext ist ein Fehler.
- Beträge: ganze Cent bis 1 Mrd. €. Kontostände und Pocket-Stände dürfen negativ sein, alles andere nicht.
- Tage: `JJJJ-MM-TT` und existierend, `2026-02-31` ist ein Fehler. Fälligkeitstag und Gehaltstag 1 bis 31. Reihenfolge 0 bis 1.000.000.
- Budgetposten: Kündigungsfrist in Tagen (0 bis 3.660) oder Monaten (0 bis 120), nicht beides. Damit kann kein Posten gespeichert werden, den `lib/notice.ts` beim Lesen als `invalid` einstuft.
- Kredite: Sollzins und Effektivzins 0 bis 10.000 Basispunkte, 1 bis 600 Raten, gültiger Tag der ersten Rate. Das sind die Regeln von `validateTerms`, gegen die jede Eingabe zusätzlich läuft.
- Zeitzone: gültiger IANA-Name, höchstens 64 Zeichen.

## Archivieren

`setActive` mit `active: false` archiviert, `active: true` holt zurück. Gelöscht wird nichts, auch keine Stände. Die Ansichten (`views:*`) lassen archivierte Datensätze weg, `records:list` und der Export enthalten sie.

Zwei Regeln halten Konten und Pockets zusammen. Ein Konto mit aktiven Pockets lässt sich nicht archivieren (`has_active_pockets`), sonst zählte Geld aus einem aufgelösten Konto weiter mit. Ein Pocket lässt sich nur in einem aktiven Konto anlegen, dorthin umziehen und zurückholen (`account_archived`).

## Konfliktschutz

Jede Änderung an einem bestehenden Datensatz oder Stand schickt in `expected` mit, was die App angezeigt hat. Das sind genau die Felder aus `records:list`: der Datensatz ohne `id` und `stand` für `update` und `setActive`, `stand` für `stands:record`. Weicht ein gespeicherter Wert ab, schreibt der Server nichts und antwortet mit:

```
{ code: "conflict", conflicts: [{ entity, id, current }] }
```

`current` hat dieselbe Form wie `expected`, die App kann also direkt beide Werte zeigen. `entity` ist `settings`, `account`, `pocket`, `budgetItem`, `debt`, `householdMember`, `accountStand`, `pocketStand` oder `debtStand`. Bei Ständen ist `id` die Kennung des Kontos, Pockets oder Kredits und `current` ist `null`, solange es keinen Stand gibt.

Verglichen werden alle bearbeitbaren Felder samt `active`, nicht nur die geänderten. „Bewusst so“ (`waivedHintAt`, `waivedHintFingerprint`) gehört nicht dazu, Ausblenden eines Hinweises löst also keinen Konflikt aus. Gegen eine Versionsnummer je Datensatz spricht, dass jede schreibende Funktion sie pflegen müsste. `expected` braucht kein neues Feld, und die App hat die Werte für die Anzeige ohnehin.

Die aktuellen Werte stehen nur in `data`. Der Fehlertext (`message`) ist nur `conflict`, weil Convex ihn in die Logs schreibt. Ob Convex auch `data` protokolliert, ist gegen ein echtes Deployment nicht geprüft.

## Stände

`stands:record` trägt Konto-, Pocket- und Kreditstände ein, einzeln oder als „Stände aktualisieren“ in einem Durchgang:

```
{
  day: "2026-08-12",
  accounts: [{ id, balanceCents, expected: { day, balanceCents } | null }
           | { id, unchanged: true, expected: { day, balanceCents } }],
  pockets:  [wie accounts],
  debts:    [{ id, balanceCents, payoffQuoteCents?, expected: { day, balanceCents, payoffQuoteCents } | null }],
}
```

- **Ein Stand je Kalendertag.** Gibt es für den Tag schon einen Stand, ersetzt der neue ihn. Ältere Stände bleiben als Verlauf.
- **Der Tag kommt von der App**, als heutiger Tag in Stevens Zeitzone. Die Uhr des Servers bestimmt ihn nie. Sie prüft nur, dass er höchstens einen Tag vom UTC-Datum abweicht; das deckt jede Zeitzone ab und fängt ein falsch gestelltes Gerätedatum. `recordedAt` ist der Zeitpunkt der Eintragung.
- **Kein Stand vor einem jüngeren.** Liegt der jüngste Stand schon nach `day`, kommt `date_conflict`. Der neue Stand würde sonst nie gelten.
- **„Unverändert“** (`unchanged: true`) übernimmt den Betrag des jüngsten Stands als Stand von `day`, das Datenalter beginnt neu. Das gibt es nur für Konten und Pockets. Bei Krediten rechnet der Tilgungsplan ab dem Tag des Bankstands: Ein alter Betrag mit neuem Datum würde die Raten dazwischen übergehen.
- **Ganz oder gar nicht.** Der Server prüft zuerst alle Einträge (Besitz, Beträge, `expected`, Tag) und schreibt erst danach. Ein Fehler in einem Eintrag oder ein Konflikt verwirft den ganzen Durchgang. Bei Konflikten nennt die Antwort alle betroffenen Einträge auf einmal.
- Höchstens 100 Einträge je Liste, keine Kennung doppelt. Ein Kredit-Bankstand ohne `payoffQuoteCents` ersetzt auch eine Ablösesumme vom selben Tag.

`expected` vergleicht der Server mit dem jüngsten gespeicherten Stand, unabhängig vom heutigen Tag. Diesen Stand liefert `records:list` als `stand`.

## Fehlercodes

Alle Fehler sind `ConvexError` mit `data.code`, ohne Beträge oder Namen (außer `current` bei `conflict`).

| Code | Bedeutung |
| --- | --- |
| `unauthenticated`, `forbidden` | Zugriffsschutz, siehe [zugriffsschutz.md](zugriffsschutz.md) |
| `invalid_argument` | Eingabe ungültig. `field` nennt das Argument, bei Ständen mit Pfad (`debts.0.balanceCents`). Fremde und unbekannte Kennungen ergeben denselben Fehler (`field: "id"`, `"accountId"` oder `"accounts.1.id"`). |
| `user_missing` | Es gibt noch keinen Nutzer-Datensatz. Erst `users:ensureUser` aufrufen. |
| `conflict` | Der gespeicherte Stand weicht von `expected` ab, siehe oben. |
| `date_conflict` | Es gibt schon einen jüngeren Stand. `field` nennt den Eintrag (`accounts.0`). |
| `has_active_pockets` | Konto mit aktiven Pockets soll archiviert werden. |
| `account_archived` | Pocket soll an ein archiviertes Konto. |

Falsche Typen, fehlende Pflichtfelder und unbekannte Felder weist schon der Convex-Validator ab, ohne `code`.

## Liste zum Bearbeiten (`records:list`)

Liefert die Einstellungen und alle Konten, Pockets, Budgetposten, Kredite und Haushaltsmitglieder mit allen bearbeitbaren Feldern, auch archivierte. Konten, Pockets und Kredite haben dazu `stand`, den jüngsten gespeicherten Stand oder `null`. Ohne Nutzer-Datensatz ist alles leer und `settings` ist `null`. Die Ansichten reichen zum Bearbeiten nicht, weil sie archivierte Datensätze, Notizen, Vertragsdaten und Reihenfolge nicht zeigen.

## Export (`dataExport:all`)

Ein Modell mit allen eigenen Daten für den Export in der App:

```
{ formatVersion: 1, settings, accounts, accountBalances, pockets, pocketBalances,
  budgetItems, debts, debtBalances, householdMembers }
```

Datensätze tragen ihre Kennung als `id`, Stände den Bezug (`accountId`, `pocketId`, `debtId`), Tag, Betrag und `recordedAt`. Dabei sind archivierte Datensätze, der ganze Verlauf der Stände und die Felder von „bewusst so“. Es fehlen Besitzer- und Clerk-Kennung und `_creationTime` (eine Kommazahl). Alle Werte sind Text, Wahrheitswert, `null` oder `int64`. `formatVersion` steigt, sobald sich Felder oder ihre Bedeutung ändern.

Einlesen über die App gibt es nicht und auch keine interne Import-Funktion. Für die Restore-Übung sieht der Plan `npx convex export` und `npx convex import` auf Stevens Rechner vor (Abschnitt „Sicherung“); das Skript dafür gibt es noch nicht.
