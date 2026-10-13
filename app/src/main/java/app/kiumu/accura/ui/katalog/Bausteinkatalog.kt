package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricKind
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.data.model.MetricUnit
import app.kiumu.accura.data.model.Step
import app.kiumu.accura.data.model.StepOp
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
    val Alt = Frisch.copy(status = MetricStatus.STALE, dataAgeDays = 38, oldestDataDay = LocalDate.of(2026, 7, 1))
    val Negativ = Frisch.copy(value = -39_834)
    val NichtBerechenbar = Frisch.copy(
        value = null,
        status = MetricStatus.UNAVAILABLE,
        reason = "Der Gehaltstag fehlt.",
        oldestDataDay = null,
        dataAgeDays = null,
        steps = emptyList(),
    )
}

/** Alle Bausteine in ihren Zuständen untereinander. Erreichbar über das Debug-Menü, eingefroren durch Screenshot-Tests. */
@Composable
fun Bausteinkatalog(modifier: Modifier = Modifier) {
    Ansicht(banner = {}, modifier = modifier) { KatalogInhalt() }
}

/** Der Inhalt des Katalogs ohne eigenen Rahmen, damit das Debug-Menü ihn unter die Szenarienwahl setzen kann. */
@Composable
fun ColumnScope.KatalogInhalt() {
    val today = KatalogBeispiele.Heute
    run {
        Abschnitt("Hauptzahl-Karte")
        HauptzahlKarte("Bis Gehalt verfügbar", KatalogBeispiele.Frisch, today, Tone.Free, supporting = "Gehalt am 25. Aug.")
        HauptzahlKarte("Bis Gehalt verfügbar", KatalogBeispiele.Alt, today, Tone.Free)
        HauptzahlKarte("Frei im Monat", KatalogBeispiele.Negativ, today, Tone.Attention)
        HauptzahlKarte("Bis Gehalt verfügbar", KatalogBeispiele.NichtBerechenbar, today, Tone.Free)
        Abschnitt("Kennzahl")
        Kennzahl("Tagesrahmen", KatalogBeispiele.Frisch, today, tone = Tone.Free)
        Kennzahl("Restschuld", KatalogBeispiele.Alt, today, tone = Tone.Debt)
        Abschnitt("Datenalter-Chip")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            DatenalterChip(today, 0, stale = false, today = today)
            DatenalterChip(LocalDate.of(2026, 8, 1), 7, stale = false, today = today)
            DatenalterChip(LocalDate.of(2026, 7, 1), 38, stale = true, today = today)
        }
        Abschnitt("Hinweis und Leerzustand")
        HinweisKarte("2 Stände sind älter als 7 Tage", "Trag neue Stände ein, dann stimmen die Zahlen wieder.")
        Leerzustand("Noch nichts erfasst", "Sobald du ein Konto einträgst, siehst du hier, was du hast.")
        Abschnitt("Liste und Aufteilungsbalken")
        ListenZeile("Alltagskonto", amountCents = 120_025)
        ListenZeile("Konto im Minus", supporting = "Stand von heute", amountCents = -39_834)
        Aufteilungsbalken(
            listOf(
                Anteil("Ausgaben", 215_000, "72 %", Tone.Neutral),
                Anteil("Raten", 40_645, "14 %", Tone.Debt),
                Anteil("Rücklagen", 30_000, "10 %", Tone.Reserve),
                Anteil("Frei", 14_355, "5 %", Tone.Free),
            ),
        )
    }
}
