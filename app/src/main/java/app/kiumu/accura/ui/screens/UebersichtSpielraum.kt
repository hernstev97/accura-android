package app.kiumu.accura.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.ui.format.formatMetricNumber
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.HauptzahlInhalt
import app.kiumu.accura.ui.katalog.Kennzahl
import app.kiumu.accura.ui.katalog.StackedFontScale
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ZahlMitRichtung
import app.kiumu.accura.ui.theme.AccuraTheme

/**
 * Variante „Spielraum zuerst“: Antwort auf „Wie viel kannst du bis zum Gehalt ausgeben?“, groß und
 * ohne Karte, mit dem Tagesrahmen als Satz. Darunter vier Kacheln (Frei im Monat, Puffer, Konten,
 * Restschuld), der nächste Spielraum, Konten und Pockets.
 * Expressive-Höhepunkt: Ändert sich die Zahl, während sie zu sehen ist, kommt die neue Zahl von unten
 * (mehr) oder von oben (weniger).
 */
@Composable
internal fun UebersichtSpielraum(model: OverviewModel, banner: @Composable () -> Unit) {
    val today = model.today
    val available = model.availableUntilSalary
    val negative = (available.value ?: 0L) < 0L
    val numberColor = if (negative) AccuraTheme.colors.attention.accent else AccuraTheme.colors.free.accent
    Ansicht(banner) {
        HauptzahlInhalt(
            question = stringResource(R.string.overview_spielraum_question),
            metric = available,
            today = today,
            modifier = Modifier.padding(vertical = 8.dp),
            supporting = formatMetricNumber(model.dailyAllowance)?.let { stringResource(R.string.overview_spielraum_daily, it) },
            missingHint = salaryMissingHint(model.salaryStatus),
            zahl = { text ->
                ZahlMitRichtung(
                    wert = available.value,
                    text = text,
                    style = MaterialTheme.typography.displayLarge.copy(fontWeight = FontWeight.SemiBold),
                    color = numberColor,
                )
            },
        )
        AlteStaendeHinweis(model)

        Kacheln(
            listOf(
                { mod -> Kennzahl(stringResource(R.string.metric_free_monthly), model.freeMonthly, today, mod, Tone.Free, kompakt = true) },
                { mod -> Kennzahl(stringResource(R.string.metric_buffer), model.bufferMonths, today, mod, Tone.Reserve, kompakt = true) },
                { mod -> Kennzahl(stringResource(R.string.overview_spielraum_accounts), model.accountsTotal, today, mod, Tone.Neutral, kompakt = true) },
                { mod -> Kennzahl(stringResource(R.string.metric_debt_remaining), model.debtRemaining, today, mod, Tone.Debt, kompakt = true) },
            ),
        )
        model.nextRelief?.let { NaechsterSpielraumKarte(it) }
        KontenUndPockets(model)
    }
}

/** Zwei Kacheln nebeneinander; bei großer Schrift eine Spalte, damit kein Betrag schrumpfen muss. */
@Composable
private fun Kacheln(items: List<@Composable (Modifier) -> Unit>) {
    val columns = if (LocalDensity.current.fontScale >= StackedFontScale) 1 else 2
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(columns).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                row.forEach { item -> item(Modifier.weight(1f)) }
            }
        }
    }
}
