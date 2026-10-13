package app.kiumu.accura.ui.katalog

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.data.model.MetricUnit
import app.kiumu.accura.ui.format.formatCents
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

/** Ab dieser Schriftgröße stehen Name und Wert untereinander, damit nichts mitten im Wort bricht. */
const val StackedFontScale = 1.3f

/** Wert einer Kennzahl für die Anzeige, inklusive Einheitswort. Ohne Wert der Hinweis „nicht berechenbar“. */
@Composable
fun metricDisplayValue(metric: Metric): String {
    val number = formatMetricNumber(metric) ?: return stringResource(R.string.value_unavailable)
    return when (metric.unit) {
        MetricUnit.MONTHS_X100 -> stringResource(R.string.value_months, number)
        MetricUnit.DAYS -> pluralStringResource(R.plurals.days_count, (metric.value ?: 0).toInt(), number)
        else -> number
    }
}

/**
 * Ruhiger Text statt einer Zahl, wenn eine Angabe fehlt (zum Beispiel „Gehaltstag eintragen“).
 * Steht nur, wenn die Kennzahl keinen Wert hat: Eine Zahl des Backends verdeckt er nie.
 */
private fun missingHintFor(metric: Metric, missingHint: String?): String? =
    missingHint?.takeIf { formatMetricNumber(metric) == null }

/**
 * Inhalt der Hauptzahl ohne Rahmen: Frage, Antwort groß, ein Satz Herleitung, Datenalter und Art,
 * „So gerechnet“. [zahl] stellt die große Zahl dar (Standard: [BetragGross]), [zeichen] ist Platz für
 * den einen Expressive-Höhepunkt neben der Zahl. Fehlt eine Angabe, steht [missingHint] ruhig an der
 * Stelle der Zahl.
 */
@Composable
fun HauptzahlInhalt(
    question: String,
    metric: Metric,
    today: LocalDate,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    missingHint: String? = null,
    zahl: @Composable (text: String) -> Unit = { BetragGross(it) },
    zeichen: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(question, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
                val hint = missingHintFor(metric, missingHint)
                if (hint != null) Text(hint, style = MaterialTheme.typography.headlineSmall) else zahl(metricDisplayValue(metric))
            }
            zeichen?.invoke()
        }
        val note = supporting ?: metric.reason
        if (note != null) Text(note, style = MaterialTheme.typography.bodyMedium)
        ZustandsChips(metric, today)
        SoGerechnet(metric)
    }
}

/**
 * Hauptzahl-Karte: Frage, Antwort groß, ein Satz Herleitung, Datenalter und Art, „So gerechnet“.
 * Eine pro Ansicht. Siehe [HauptzahlInhalt] für [zeichen] und [missingHint].
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
    zeichen: (@Composable () -> Unit)? = null,
) {
    val colors = tone.colors()
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = colors.container, contentColor = colors.onContainer),
    ) {
        HauptzahlInhalt(
            question = question,
            metric = metric,
            today = today,
            modifier = Modifier.padding(20.dp),
            supporting = supporting,
            missingHint = missingHint,
            zeichen = zeichen,
        )
    }
}

/**
 * Kennzahl: Name, Kurzbeschreibung, Wert und Art. Ein Tipp auf die Karte klappt Datenalter und
 * „So gerechnet“ auf. Ist der Wert alt oder nicht berechenbar, steht das auch zugeklappt da.
 * [kompakt] stellt Name und Wert untereinander (für schmale Spalten); ab 130 % Schrift geschieht das immer.
 */
@Composable
fun Kennzahl(
    title: String,
    metric: Metric,
    today: LocalDate,
    modifier: Modifier = Modifier,
    tone: Tone? = null,
    supporting: String? = null,
    missingHint: String? = null,
    kompakt: Boolean = false,
) {
    var expanded by rememberSaveable(metric.key) { mutableStateOf(false) }
    val stateText = stringResource(if (expanded) R.string.state_expanded else R.string.state_collapsed)
    val accent = tone?.colors()?.accent ?: MaterialTheme.colorScheme.outline
    val hint = missingHintFor(metric, missingHint)
    // Ein Hinweistext statt Zahl braucht Platz; er steht dann wie bei großer Schrift unter dem Namen.
    val stacked = kompakt || hint != null || LocalDensity.current.fontScale >= StackedFontScale
    val shape = MaterialTheme.shapes.large
    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = shape,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier
                .clip(shape)
                .clickable(role = Role.Button, onClickLabel = stringResource(R.string.how_calculated_action)) { expanded = !expanded }
                .semantics { stateDescription = stateText }
                .heightIn(min = 48.dp)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val dot: @Composable () -> Unit = {
                Box(modifier = Modifier.padding(top = 7.dp).size(10.dp).clip(CircleShape).background(accent))
            }
            val chevron: @Composable () -> Unit = {
                Icon(
                    if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            val names: @Composable (Modifier) -> Unit = { mod ->
                Column(modifier = mod) {
                    Text(title, style = MaterialTheme.typography.titleSmall)
                    supporting?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            val value: @Composable (Modifier, TextAlign) -> Unit = { mod, align ->
                if (hint != null) {
                    Text(hint, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = mod, textAlign = align)
                } else {
                    Text(
                        metricDisplayValue(metric),
                        style = MaterialTheme.typography.titleMedium.copy(fontFeatureSettings = "tnum"),
                        modifier = mod,
                        textAlign = align,
                        maxLines = 1,
                        softWrap = false,
                        autoSize = TextAutoSize.StepBased(minFontSize = 12.sp, maxFontSize = MaterialTheme.typography.titleMedium.fontSize),
                    )
                }
            }
            if (stacked) {
                // Untereinander: Der Name bekommt die ganze Breite, der Pfeil steht in der Wertzeile.
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    dot()
                    names(Modifier.weight(1f))
                }
                Row(
                    modifier = Modifier.padding(start = 22.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    value(Modifier.weight(1f), TextAlign.Start)
                    chevron()
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    dot()
                    names(Modifier.weight(1f))
                    value(Modifier.padding(top = 2.dp), TextAlign.End)
                    chevron()
                }
            }
            Text(
                metricKindText(metric.kind),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 22.dp),
            )
            if (!expanded && metric.status != MetricStatus.OK) {
                metric.reason?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                DatenalterChip(metric, today)
            }
            AnimatedVisibility(visible = expanded, enter = aufklappen(), exit = zuklappen()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                    ZustandsChips(metric, today)
                    Rechenweg(metric)
                }
            }
        }
    }
}

/** Hinweis in der Rolle „Achtung“: ruhig, nie Rot. Optional mit einem Schritt zur Lösung. */
@Composable
fun HinweisKarte(
    title: String,
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Default.Info,
    aktion: String? = null,
    onAktion: () -> Unit = {},
) {
    val colors = AccuraTheme.colors.attention
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = colors.container, contentColor = colors.onContainer),
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, contentDescription = null, tint = colors.accent)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(text, style = MaterialTheme.typography.bodyMedium)
                if (aktion != null) {
                    FilledTonalButton(onClick = onAktion, modifier = Modifier.padding(top = 4.dp)) { Text(aktion) }
                }
            }
        }
    }
}

/**
 * Einspar-Hinweis: ruhige Karte mit Titel, Grund, Betrag pro Monat und pro Jahr, Rechenweg und
 * „Bewusst so“. Beide Beträge kommen aus dem Rechenkern; die Karte rechnet den Jahresbetrag nicht aus.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EinsparHinweisKarte(
    title: String,
    text: String,
    monthlyCents: Long,
    yearlyCents: Long,
    onBewusstSo: () -> Unit,
    modifier: Modifier = Modifier,
    rechenweg: Metric? = null,
) {
    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(LightbulbIcon, contentDescription = null, tint = AccuraTheme.colors.free.accent)
                Text(title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
            }
            Text(text, style = MaterialTheme.typography.bodyMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(stringResource(R.string.hint_per_month, formatCents(monthlyCents)), style = MaterialTheme.typography.titleSmall)
                Text(stringResource(R.string.hint_per_year, formatCents(yearlyCents)), style = MaterialTheme.typography.titleSmall)
            }
            rechenweg?.let { SoGerechnet(it) }
            FilledTonalButton(onClick = onBewusstSo) { Text(stringResource(R.string.hint_waive)) }
        }
    }
}

/** Leerzustand: was fehlt, ein Satz, ein Schritt zur Lösung. Nie eine leere Fläche. */
@Composable
fun Leerzustand(
    title: String,
    text: String,
    modifier: Modifier = Modifier,
    aktion: String? = null,
    onAktion: () -> Unit = {},
) {
    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
            Text(text, style = MaterialTheme.typography.bodyMedium)
            if (aktion != null) {
                FilledTonalButton(onClick = onAktion, modifier = Modifier.padding(top = 4.dp)) { Text(aktion) }
            }
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
                horizontalArrangement = Arrangement.spacedBy(2.dp),
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
