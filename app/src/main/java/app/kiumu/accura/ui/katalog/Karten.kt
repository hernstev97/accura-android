package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.ui.format.formatMetricNumber
import app.kiumu.accura.ui.theme.AccuraTheme
import app.kiumu.accura.ui.theme.RoleColors
import java.time.LocalDate

/** Welche feste Farbrolle eine Zahl trägt. [Neutral] folgt Dynamic Color. */
enum class Tone { Neutral, Free, Reserve, Attention, Debt }

@Composable
fun Tone.colors(): RoleColors = when (this) {
    Tone.Neutral -> RoleColors(
        MaterialTheme.colorScheme.primaryContainer,
        MaterialTheme.colorScheme.onPrimaryContainer,
        MaterialTheme.colorScheme.primary,
    )
    Tone.Free -> AccuraTheme.colors.free
    Tone.Reserve -> AccuraTheme.colors.reserve
    Tone.Attention -> AccuraTheme.colors.attention
    Tone.Debt -> AccuraTheme.colors.debt
}

/** Wert einer Kennzahl für die Anzeige, inklusive Einheitswort. Ohne Wert der Hinweis „nicht berechenbar“. */
@Composable
fun metricDisplayValue(metric: Metric): String {
    val number = formatMetricNumber(metric) ?: return stringResource(R.string.value_unavailable)
    return when (metric.unit) {
        app.kiumu.accura.data.model.MetricUnit.MONTHS_X100 -> stringResource(R.string.value_months, number)
        app.kiumu.accura.data.model.MetricUnit.DAYS ->
            androidx.compose.ui.res.pluralStringResource(R.plurals.days_count, (metric.value ?: 0).toInt(), number)
        else -> number
    }
}

/** Chip mit dem Alter der ältesten verwendeten Daten einer Kennzahl; ohne datierte Daten nichts. */
@Composable
fun DatenalterChip(metric: Metric, today: LocalDate, modifier: Modifier = Modifier) {
    val day = metric.oldestDataDay ?: return
    DatenalterChip(
        day = day,
        ageDays = metric.dataAgeDays ?: 0,
        stale = metric.status == MetricStatus.STALE,
        today = today,
        modifier = modifier,
    )
}

/**
 * Ruhiger Text statt einer Zahl, wenn eine Angabe fehlt (zum Beispiel „Gehaltstag eintragen“).
 * Steht nur, wenn die Kennzahl keinen Wert hat: Eine Zahl des Backends verdeckt er nie.
 */
private fun missingHintFor(metric: Metric, missingHint: String?): String? =
    missingHint?.takeIf { formatMetricNumber(metric) == null }

/**
 * Hauptzahl-Karte: Frage, Antwort groß, ein Satz Herleitung, Datenalter, „So gerechnet“. Eine pro Ansicht.
 * Fehlt eine Angabe, steht [missingHint] ruhig an der Stelle der Zahl.
 */
@Composable
fun HauptzahlKarte(
    question: String,
    metric: Metric,
    today: LocalDate,
    tone: Tone,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    missingHint: String? = null,
) {
    val colors = tone.colors()
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = colors.container, contentColor = colors.onContainer),
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(question, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
            val hint = missingHintFor(metric, missingHint)
            if (hint != null) {
                Text(hint, style = MaterialTheme.typography.headlineSmall)
            } else {
                BetragGross(text = metricDisplayValue(metric))
            }
            val note = supporting ?: metric.reason
            if (note != null) Text(note, style = MaterialTheme.typography.bodyMedium)
            DatenalterChip(metric, today)
            SoGerechnet(metric)
        }
    }
}

/** Kennzahl: Name, Wert, Art; „So gerechnet“ zum Aufklappen. Fehlt eine Angabe, steht [missingHint] statt der Zahl. */
@Composable
fun Kennzahl(
    title: String,
    metric: Metric,
    today: LocalDate,
    modifier: Modifier = Modifier,
    tone: Tone? = null,
    supporting: String? = null,
    missingHint: String? = null,
) {
    val accent = tone?.colors()?.accent ?: MaterialTheme.colorScheme.outlineVariant
    OutlinedCard(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
            val stacked = LocalDensity.current.fontScale >= 1.3f
            val titleBlock: @Composable (Modifier) -> Unit = { modifier ->
                Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    Box(modifier = Modifier.padding(top = 6.dp).size(10.dp).clip(CircleShape).background(accent))
                    Column {
                        Text(title, style = MaterialTheme.typography.titleSmall)
                        Text(
                            metricKindText(metric.kind),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            val hint = missingHintFor(metric, missingHint)
            val valueText: @Composable (Modifier) -> Unit = { modifier ->
                if (hint != null) {
                    Text(
                        hint,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = modifier,
                        textAlign = TextAlign.End,
                    )
                } else {
                    Text(
                        metricDisplayValue(metric),
                        style = MaterialTheme.typography.titleMedium.copy(fontFeatureSettings = "tnum"),
                        modifier = modifier,
                        textAlign = TextAlign.End,
                    )
                }
            }
            // Bei großer Schrift steht der Wert unter dem Namen, damit nichts mitten im Wort bricht.
            if (stacked) {
                Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    titleBlock(Modifier.fillMaxWidth())
                    valueText(Modifier.padding(start = 22.dp))
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    titleBlock(Modifier.weight(1f))
                    valueText(Modifier)
                }
            }
            (supporting ?: metric.reason)?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
            }
            DatenalterChip(metric, today, modifier = Modifier.padding(top = 8.dp))
            SoGerechnet(metric)
        }
    }
}

/** Hinweis in der Rolle „Achtung“: ruhig, nie Rot. */
@Composable
fun HinweisKarte(title: String, text: String, modifier: Modifier = Modifier) {
    val colors = AccuraTheme.colors.attention
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = colors.container, contentColor = colors.onContainer),
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.Info, contentDescription = null, tint = colors.accent)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(text, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

/** Leerzustand: was fehlt und ein Schritt zur Lösung. Nie eine leere Fläche. */
@Composable
fun Leerzustand(title: String, text: String, modifier: Modifier = Modifier) {
    OutlinedCard(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/** Abschnittsüberschrift. */
@Composable
fun Abschnitt(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title,
        modifier = modifier.padding(top = 8.dp).semantics { heading() },
        style = MaterialTheme.typography.titleMedium,
    )
}

data class Anteil(val label: String, val cents: Long, val shareText: String?, val tone: Tone)

/**
 * Aufteilungsbalken: Anteile des Einkommens. Die Liste trägt die Information, der Balken zeigt sie.
 * Die Balkenbreite ist reine Darstellung; negative Anteile bekommen keine Breite.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Aufteilungsbalken(parts: List<Anteil>, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val widths = remember(parts) { parts.map { it.cents.coerceAtLeast(0).toFloat() } }
        if (widths.sum() > 0f) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(16.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clearAndSetSemantics { },
            ) {
                parts.forEachIndexed { index, part ->
                    if (widths[index] > 0f) {
                        Box(modifier = Modifier.weight(widths[index]).height(16.dp).background(part.tone.colors().accent))
                    }
                }
            }
        }
        parts.forEach { part ->
            ListenZeile(
                title = part.label,
                supporting = part.shareText,
                amountCents = part.cents,
                leading = {
                    Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(part.tone.colors().accent))
                },
            )
        }
    }
}

