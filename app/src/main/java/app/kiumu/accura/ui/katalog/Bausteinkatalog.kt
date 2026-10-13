package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricKind
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.data.model.MetricUnit
import app.kiumu.accura.data.model.Step
import app.kiumu.accura.data.model.StepOp
import app.kiumu.accura.ui.format.BetragEingabe
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.parseBetrag
import java.time.LocalDate

/** Ausgedachte Beispiele für den Katalog und die Screenshot-Tests. Kein Bezug zu echten Finanzen. */
object KatalogBeispiele {
    val Heute: LocalDate = LocalDate.of(2026, 8, 8)

    val Frisch = Metric(
        key = "availableUntilSalary",
        unit = MetricUnit.CENTS,
        kind = MetricKind.CALCULATED,
        value = 90_430,
        status = MetricStatus.OK,
        dataAgeDays = 0,
        oldestDataDay = Heute,
        steps = listOf(
            Step(StepOp.START, "Auf den Konten", cents = 135_075),
            Step(StepOp.MINUS, "Versicherungen", cents = 10_000),
            Step(StepOp.MINUS, "Ratenkredit", cents = 34_645),
            Step(StepOp.RESULT, "Bis Gehalt verfügbar", cents = 90_430),
        ),
    )
    val Alt = Frisch.copy(key = "restschuldAlt", status = MetricStatus.STALE, dataAgeDays = 38, oldestDataDay = LocalDate.of(2026, 7, 1), reason = "Die Kontostände sind nicht mehr frisch.")
    val Negativ = Frisch.copy(key = "freeMonthlyNegativ", kind = MetricKind.PLANNED, value = -39_834, oldestDataDay = null, dataAgeDays = null, steps = emptyList())
    val NichtBerechenbar = Frisch.copy(
        key = "dailyAllowanceFehlt",
        value = null,
        status = MetricStatus.UNAVAILABLE,
        reason = "Der Gehaltstag fehlt.",
        oldestDataDay = null,
        dataAgeDays = null,
        steps = listOf(Step(StepOp.NOTE, "Ohne Gehaltstag gibt es keinen Zeitraum bis zum Gehalt. Trage den Gehaltstag ein, dann rechnet accura.")),
    )
    val RestschuldAlt = Metric(
        key = "debtRemaining",
        unit = MetricUnit.CENTS,
        kind = MetricKind.CALCULATED,
        value = 885_078,
        status = MetricStatus.STALE,
        reason = "Ein Bankstand ist älter als 90 Tage.",
        dataAgeDays = 110,
        oldestDataDay = LocalDate.of(2026, 4, 20),
    )
    val Puffer = Metric(
        key = "bufferMonths",
        unit = MetricUnit.MONTHS_X100,
        kind = MetricKind.CALCULATED,
        value = 56,
        status = MetricStatus.OK,
        dataAgeDays = 0,
        oldestDataDay = Heute,
    )
    val Hinweis = Metric(
        key = "hinweisStreaming",
        unit = MetricUnit.CENTS,
        kind = MetricKind.CALCULATED,
        value = 1_799,
        status = MetricStatus.OK,
        steps = listOf(
            Step(StepOp.START, "Streaming A", cents = 1_299),
            Step(StepOp.PLUS, "Streaming B", cents = 500),
            Step(StepOp.RESULT, "Zusammen im Monat", cents = 1_799),
        ),
    )
}

/** Alle Bausteine in ihren Zuständen untereinander. Erreichbar über das Debug-Menü, eingefroren durch Screenshot-Tests. */
@Composable
fun Bausteinkatalog(modifier: Modifier = Modifier) {
    Ansicht(banner = {}, modifier = modifier) { KatalogInhalt() }
}

/**
 * Der Inhalt des Katalogs ohne eigenen Rahmen, damit das Debug-Menü ihn unter die Szenarienwahl setzen
 * kann. Reihenfolge wie im Design-Leitfaden (elf Bausteine), danach die Expressive-Zeichen. Texte und
 * Zahlen sind ausgedacht und stehen nur hier im Code, nicht in `strings.xml`.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColumnScope.KatalogInhalt() {
    val today = KatalogBeispiele.Heute
    Text("Bausteinkatalog", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })

    Abschnitt("1 · Hauptzahl-Karte")
    HauptzahlKarte("Bis Gehalt verfügbar", KatalogBeispiele.Frisch, today, Tone.Free, supporting = "Gehalt am 25. Aug., in 17 Tagen.")
    HauptzahlKarte("Bis Gehalt verfügbar", KatalogBeispiele.Alt, today, Tone.Free, zeichen = { FrischeZeichen(stale = true) })
    HauptzahlKarte("Frei im Monat", KatalogBeispiele.Negativ, today, Tone.Attention)
    HauptzahlKarte("Tagesrahmen bis Gehalt", KatalogBeispiele.NichtBerechenbar, today, Tone.Neutral, missingHint = "Gehaltstag eintragen")

    Abschnitt("2 · Kennzahl")
    Kennzahl("Tagesrahmen", KatalogBeispiele.Frisch, today, tone = Tone.Free, supporting = "Bis Gehalt verfügbar, verteilt auf die Tage")
    Kennzahl("Restschuld", KatalogBeispiele.RestschuldAlt, today, tone = Tone.Debt, supporting = "Was nach Plan noch offen ist")
    Kennzahl("Tagesrahmen bis Gehalt", KatalogBeispiele.NichtBerechenbar, today, tone = Tone.Free, missingHint = "Gehaltstag eintragen")
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Kennzahl("Puffer", KatalogBeispiele.Puffer, today, Modifier.weight(1f), Tone.Reserve, kompakt = true)
        Kennzahl("Frei im Monat", KatalogBeispiele.Negativ, today, Modifier.weight(1f), Tone.Attention, kompakt = true)
    }

    Abschnitt("3 · Rechenweg („So gerechnet“)")
    Rechenweg(KatalogBeispiele.Frisch)

    Abschnitt("4 · Liste")
    ListenZeile("Alltagskonto", amountCents = 120_025, trailing = { DatenalterChip(today, 0, stale = false, today = today) })
    ListenZeile("Konto im Minus", supporting = "Bankkonto", amountCents = -39_834)
    ListenZeile("Ratenkredit", supporting = "Nächste Rate am 20. Aug.", amountCents = 34_645, onClick = {}, onClickLabel = "Kredit öffnen")

    Abschnitt("5 · Hinweis")
    HinweisKarte(
        "2 Stände sind älter als 7 Tage",
        "Zahlen, die darauf beruhen, tragen den Hinweis „alt“.",
        icon = ClockIcon,
        aktion = "Stände aktualisieren",
    )
    EinsparHinweisKarte(
        title = "Zwei Streaming-Abos",
        text = "Beide laufen seit über einem Jahr. Wenn du eines kündigst, bleibt mehr frei.",
        monthlyCents = 1_799,
        yearlyCents = 21_588,
        onBewusstSo = {},
        rechenweg = KatalogBeispiele.Hinweis,
    )

    Abschnitt("6 · Leerzustand")
    Leerzustand(
        "Noch keine Kredite",
        "Wenn du Kredite oder Ratenkäufe einträgst, rechnet accura den Weg auf null.",
        aktion = "Kredit eintragen",
    )

    Abschnitt("7 · Datenalter-Chip und Art")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        DatenalterChip(today, 0, stale = false, today = today)
        DatenalterChip(LocalDate.of(2026, 8, 1), 7, stale = false, today = today)
        DatenalterChip(LocalDate.of(2026, 7, 1), 38, stale = true, today = today)
        NichtBerechenbarChip()
        MetricKind.entries.forEach { ArtMarke(it) }
    }

    Abschnitt("8 · Betragsfeld")
    BetragsfeldBeispiel()
    Betragsfeld(label = "Monatsrate", text = "12,345", onTextChange = {})

    Abschnitt("9 · Auswahl")
    var wahl by rememberSaveable { mutableIntStateOf(1) }
    AuswahlEinzeln("Notwendigkeit", listOf("Existenziell", "Notwendig", "Sinnvoll", "Optional", "Unnötig"), wahl, { wahl = it })
    var vorlagen by remember { mutableStateOf(setOf(0, 2)) }
    AuswahlMehrere(
        listOf("Miete", "Strom", "Internet", "Handyvertrag"),
        vorlagen,
        { index, an -> vorlagen = if (an) vorlagen + index else vorlagen - index },
    )

    Abschnitt("10 · Schrittanzeige")
    Schrittanzeige(nummer = 2, gesamt = 6, thema = "Konten", onZurueck = {}, onSpaeter = {})

    Abschnitt("11 · Aufteilungsbalken")
    Aufteilungsbalken(
        listOf(
            Anteil("Ausgaben", 215_000, "72 %", Tone.Neutral),
            Anteil("Raten", 40_645, "13 %", Tone.Debt),
            Anteil("Rücklagen", 30_000, "10 %", Tone.Reserve),
            Anteil("Frei", 14_355, "5 %", Tone.Free),
        ),
    )

    Abschnitt("12 · Kachel und Wert-Kachel (Runde 2)")
    KachelRaster(
        listOf(
            { mod -> WertKachel("Jetzt verfügbar", KatalogBeispiele.Frisch, today, mod, Tone.Neutral, betont = true, supporting = "Auf deinen Konten") },
            { mod -> WertKachel("Puffer", KatalogBeispiele.Puffer, today, mod, Tone.Reserve, supporting = "So lange reicht es") },
            { mod -> WertKachel("Restschuld", KatalogBeispiele.RestschuldAlt, today, mod, Tone.Debt) },
            { mod -> WertKachel("Bis Gehalt", KatalogBeispiele.NichtBerechenbar, today, mod, Tone.Free, missingHint = "Gehaltstag eintragen") },
        ),
    )
    PillenKnopf("Stände aktualisieren", onClick = {}, icon = Icons.Default.Refresh, modifier = Modifier.fillMaxWidth())

    Abschnitt("13 · Ring und Anteil-Pillen")
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Ring(
            teile = listOf(
                RingTeil(215_000, Tone.Neutral.colors().accent),
                RingTeil(40_645, Tone.Debt.colors().accent),
                RingTeil(30_000, Tone.Reserve.colors().accent),
                RingTeil(14_355, Tone.Free.colors().accent),
            ),
            beschreibung = "Beispiel: 5 % frei",
            modifier = Modifier.weight(0.5f),
        ) {
            BetragGross("5 %", style = MaterialTheme.typography.headlineMedium)
            Text("frei", style = MaterialTheme.typography.labelLarge)
        }
        Column(modifier = Modifier.weight(0.5f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            AnteilPille("Ausgaben", "72 %", 215_000, Tone.Neutral, 0.72f)
            AnteilPille("Rücklagen", "10 %", 30_000, Tone.Reserve, 0.10f)
            AnteilPille("Frei", "−90 %", -135_645, Tone.Attention, 0f)
        }
    }

    Abschnitt("14 · Listengruppe")
    Listengruppe {
        zeile { ListenZeile("Alltagskonto", supporting = "Bankkonto · Stand von heute", amountCents = 120_025, leading = { IconScheibe(BankIcon, Tone.Neutral) }, innen = GruppenZeileInnen) }
        zeile { ListenZeile("Reise-Wallet", supporting = "Wallet", amountCents = 12_050, leading = { IconScheibe(WalletIcon, Tone.Neutral) }, innen = GruppenZeileInnen) }
        zeile { ListenZeile("Bargeld", supporting = "Bargeld", amountCents = 3_000, leading = { IconScheibe(CashIcon, Tone.Neutral) }, innen = GruppenZeileInnen) }
        zeile(fuss = true) { ListenZeile("Gesamt", amountCents = 135_075, innen = GruppenZeileInnen) }
    }

    Abschnitt("15 · Zeitleiste „Was kommt“")
    Column {
        Station("Heute, 8. Aug.", punkt = { Punkt(Tone.Neutral) }, first = true) { Text("1.350,75 € auf den Konten") }
        Station("15. Aug. · in 7 Tagen", punkt = { Punkt(Tone.Debt) }) { Text("Versicherungen 100,00 €") }
        Station("25. Aug. · Gehalt", punkt = { Punkt(Tone.Free, FlagIcon) }, last = true) { Text("Neuer Zeitraum") }
    }

    Abschnitt("16 · Diagramme (Canvas, mit Textfassung)")
    Verlaufskurve(
        werte = listOf(894_500, 857_407, 820_235, 600_000, 300_000, 0),
        tone = Tone.Debt,
        beschreibung = "Beispiel: Restschuld fällt auf null",
        anfang = "8. Aug.",
        ende = "Dez. 2029",
    )
    Stufendiagramm(
        werte = listOf(26_355, 32_355, 55_000),
        beschriftungen = listOf("Okt. 2026", "Nov. 2026", "Jan. 2030"),
        tone = Tone.Free,
        beschreibung = "Beispiel: drei Stufen",
    )
    BalkenZeile("Wohnen", 125_000, 1f, MaterialTheme.colorScheme.primary, zusatz = "41,67 % des Einkommens")
    BalkenZeile("Freizeit", 5_000, 0.04f, MaterialTheme.colorScheme.primary)

    Abschnitt("Expressive: Form und Bewegung zeigen Zustände")
    Text(
        "Höchstens eines davon pro Bildschirm. Ohne Animationen steht sofort der Endzustand da.",
        style = MaterialTheme.typography.bodyMedium,
    )
    FrischeBeispiel()
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        RateLaeuftAusZeichen()
        Text("Rate läuft aus (wächst beim Erscheinen)", style = MaterialTheme.typography.bodyMedium)
    }
    ZahlBeispiel()
}

/** Betragsfeld mit „Im Minus“ und Speichern; nach dem Speichern erscheint das Zeichen „Gespeichert“. */
@Composable
private fun BetragsfeldBeispiel() {
    var text by rememberSaveable { mutableStateOf("1.482,6") }
    var minus by rememberSaveable { mutableStateOf(false) }
    var saved by rememberSaveable { mutableStateOf(false) }
    Betragsfeld(
        label = "Kontostand",
        text = text,
        onTextChange = {
            text = it
            saved = false
        },
        minus = minus,
        onMinusChange = {
            minus = it
            saved = false
        },
        hint = "So, wie es in der Banking-App steht.",
    )
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Button(onClick = { saved = true }, enabled = parseBetrag(text, minus) is BetragEingabe.Gueltig) { Text("Speichern") }
        GespeichertZeichen(gespeichert = saved)
    }
}

/** Frisch und alt nebeneinander, dazu ein Schalter, der den Formwechsel zeigt. */
@Composable
private fun FrischeBeispiel() {
    var stale by rememberSaveable { mutableStateOf(false) }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        FrischeZeichen(stale = stale)
        Column(modifier = Modifier.weight(1f)) {
            Text(if (stale) "Stand alt" else "Stand frisch", style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = { stale = !stale }) { Text("Frisch oder alt umschalten") }
        }
    }
}

/** Zahl mit Richtung: abwechselnd mehr und weniger. */
@Composable
private fun ZahlBeispiel() {
    val werte = listOf(90_430L, 69_429L, 120_000L)
    var index by rememberSaveable { mutableIntStateOf(0) }
    val wert = werte[index]
    Column(modifier = Modifier.fillMaxWidth()) {
        ZahlMitRichtung(wert = wert, text = formatCents(wert))
        OutlinedButton(onClick = { index = (index + 1) % werte.size }) { Text("Zahl ändern") }
    }
}
