package app.kiumu.accura.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.format.formatMetricNumber
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.BetragGross
import app.kiumu.accura.ui.katalog.DatenalterChip
import app.kiumu.accura.ui.katalog.FlagIcon
import app.kiumu.accura.ui.katalog.RateLaeuftAusZeichen
import app.kiumu.accura.ui.katalog.SoGerechnet
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.colors
import app.kiumu.accura.ui.katalog.metricDisplayValue
import java.time.YearMonth

/** Breite der Leiste links; der Punkt sitzt mittig, die Verbindungslinie läuft durch seine Mitte. */
private val RailWidth = 48.dp

/**
 * Variante „Zeitleiste“: die Übersicht als Weg von heute nach vorn. Heute (Konten, bis Gehalt), jeden
 * Monat (frei, Puffer), wann eine Rate ausläuft, wann du schuldenfrei bist. Darunter Konten und Pockets.
 * Expressive-Höhepunkt: der Stern „Eine Rate läuft aus“, der beim Erscheinen aus einem Kreis wächst.
 */
@Composable
internal fun UebersichtZeitleiste(model: OverviewModel, banner: @Composable () -> Unit) {
    val today = model.today
    val relief = model.nextRelief
    val debtFree = model.debtFreeDay.day
    Ansicht(banner) {
        Text(
            stringResource(R.string.overview_timeline_question),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() },
        )
        AlteStaendeHinweis(model)

        Column {
            Station(
                wann = stringResource(R.string.timeline_today, formatDay(today, today)),
                punkt = { Punkt(Tone.Neutral) },
                first = true,
            ) {
                Text(stringResource(R.string.timeline_accounts), style = MaterialTheme.typography.titleSmall)
                BetragGross(metricDisplayValue(model.accountsTotal), style = MaterialTheme.typography.headlineMedium)
                DatenalterChip(model.accountsTotal, today)
                val until = formatMetricNumber(model.availableUntilSalary)
                val perDay = formatMetricNumber(model.dailyAllowance)
                Text(
                    when {
                        until == null -> stringResource(R.string.timeline_until_salary_missing, salaryMissingHint(model.salaryStatus) ?: stringResource(R.string.value_unavailable))
                        perDay == null -> stringResource(R.string.timeline_until_salary, until)
                        else -> stringResource(R.string.timeline_until_salary_daily, until, perDay)
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
                SoGerechnet(model.availableUntilSalary)
            }
            Station(
                wann = stringResource(R.string.timeline_monthly),
                punkt = { Punkt(Tone.Free) },
                last = relief == null && debtFree == null,
            ) {
                Text(stringResource(R.string.metric_free_monthly), style = MaterialTheme.typography.titleSmall)
                BetragGross(metricDisplayValue(model.freeMonthly), style = MaterialTheme.typography.headlineMedium)
                Text(
                    stringResource(R.string.timeline_buffer, metricDisplayValue(model.bufferMonths)),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            relief?.let {
                Station(
                    wann = stringResource(R.string.relief_from, formatMonth(it.freeFromMonth)),
                    punkt = { RateLaeuftAusZeichen() },
                    last = debtFree == null,
                ) {
                    Text(
                        pluralStringResource(R.plurals.timeline_relief_title, it.events.size, it.events.size),
                        style = MaterialTheme.typography.titleSmall,
                    )
                    it.events.forEach { event ->
                        Text(
                            stringResource(R.string.timeline_relief_event, event.lender, formatDay(event.lastPaymentDay, today)),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    BetragGross(
                        stringResource(R.string.timeline_relief_more, formatCents(it.monthlyReliefCents)),
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    it.freeAfterCents?.let { after ->
                        Text(stringResource(R.string.relief_free_after, formatCents(after)), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            debtFree?.let { day ->
                Station(
                    wann = formatMonth(YearMonth.from(day)),
                    punkt = { Punkt(Tone.Debt, FlagIcon) },
                    last = true,
                ) {
                    Text(stringResource(R.string.timeline_debt_free), style = MaterialTheme.typography.titleSmall)
                    Text(
                        stringResource(R.string.timeline_debt_remaining, metricDisplayValue(model.debtRemaining)),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    DatenalterChip(model.debtFreeDay, today)
                }
            }
        }

        KontenUndPockets(model)
    }
}

/**
 * Eine Station der Zeitleiste: links Punkt und Linie, rechts Zeitpunkt und Inhalt. Für TalkBack ist
 * eine Station ein Eintrag; „So gerechnet“ darin bleibt einzeln bedienbar.
 */
@Composable
private fun Station(
    wann: String,
    punkt: @Composable () -> Unit,
    first: Boolean = false,
    last: Boolean = false,
    content: @Composable () -> Unit,
) {
    val lineColor = MaterialTheme.colorScheme.outline
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { }
            .drawBehind {
                val x = RailWidth.toPx() / 2
                val nodeCenter = RailWidth.toPx() / 2
                val stroke = 2.dp.toPx()
                if (!first) drawLine(lineColor, Offset(x, 0f), Offset(x, nodeCenter), stroke)
                if (!last) drawLine(lineColor, Offset(x, nodeCenter), Offset(x, size.height), stroke)
            },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(modifier = Modifier.size(RailWidth), contentAlignment = Alignment.Center) { punkt() }
        Column(
            modifier = Modifier.weight(1f).padding(top = 12.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                wann,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.semantics { heading() },
            )
            content()
        }
    }
}

/** Gewöhnlicher Punkt der Zeitleiste in einer Farbrolle, optional mit Symbol. */
@Composable
private fun Punkt(tone: Tone, icon: ImageVector? = null) {
    val colors = tone.colors()
    if (icon == null) {
        Box(
            modifier = Modifier
                .size(16.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.background)
                .border(4.dp, colors.accent, CircleShape),
        )
    } else {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(colors.accent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.surface, modifier = Modifier.size(18.dp))
        }
    }
}
