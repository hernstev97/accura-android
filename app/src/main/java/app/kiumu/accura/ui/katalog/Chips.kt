package app.kiumu.accura.ui.katalog

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricKind
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.theme.AccuraTheme
import java.time.LocalDate
import kotlin.math.roundToInt

/** Ecken des Chips in Prozent der Höhe: frisch rund wie eine Pille, alt fast eckig. */
private const val FreshCornerPercent = 50f
private const val StaleCornerPercent = 18f

/**
 * Datenalter-Chip. Form und Text tragen die Aussage, nicht nur die Farbe: Ein frischer Stand ist eine
 * runde Pille mit Haken, ein alter Stand ist fast eckig, hat einen gestrichelten Rand, eine Uhr und das
 * Wort „Alt“. Wechselt der Zustand, geht die Form mit (ohne Bewegung, wenn Animationen aus sind).
 * [today] kommt aus dem Modell, nicht von einer Uhr. [oldest] sagt „Ältester Stand“ (Zusammenfassung
 * über alle Stände einer Ansicht).
 */
@Composable
fun DatenalterChip(
    day: LocalDate,
    ageDays: Int,
    stale: Boolean,
    today: LocalDate,
    modifier: Modifier = Modifier,
    oldest: Boolean = false,
) {
    val whenText = when {
        oldest && ageDays == 0 -> stringResource(R.string.chip_oldest_today)
        oldest -> stringResource(R.string.chip_oldest_from, formatDay(day, today))
        ageDays == 0 -> stringResource(R.string.chip_data_today)
        else -> stringResource(R.string.chip_data_from, formatDay(day, today))
    }
    val text = if (stale) {
        stringResource(R.string.chip_data_stale, whenText, pluralStringResource(R.plurals.days_ago, ageDays, ageDays))
    } else {
        whenText
    }
    val corner by animateFloatAsState(
        targetValue = if (stale) StaleCornerPercent else FreshCornerPercent,
        animationSpec = if (AccuraTheme.reduceMotion) snap() else MaterialTheme.motionScheme.fastSpatialSpec(),
        label = "Ecken Datenalter",
    )
    val shape = RoundedCornerShape(corner.roundToInt())
    if (stale) {
        val colors = AccuraTheme.colors.attention
        val dash = PathEffect.dashPathEffect(floatArrayOf(12f, 8f))
        Surface(
            modifier = modifier.drawBehind {
                val radius = size.height * corner / 100f
                drawRoundRect(
                    color = colors.accent,
                    cornerRadius = CornerRadius(radius),
                    style = Stroke(width = 2.dp.toPx(), pathEffect = dash),
                )
            },
            shape = shape,
            color = colors.container,
            contentColor = colors.onContainer,
        ) { ChipContent(text = text, icon = ClockIcon) }
    } else {
        Surface(
            modifier = modifier.border(1.dp, MaterialTheme.colorScheme.outline, shape),
            shape = shape,
            color = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ) { ChipContent(text = text, icon = Icons.Default.Check) }
    }
}

/** Chip mit dem Alter der ältesten verwendeten Daten einer Kennzahl; ohne Wert „Nicht berechenbar“, ohne datierte Daten nichts. */
@Composable
fun DatenalterChip(metric: Metric, today: LocalDate, modifier: Modifier = Modifier) {
    if (metric.status == MetricStatus.UNAVAILABLE) {
        NichtBerechenbarChip(modifier)
        return
    }
    val day = metric.oldestDataDay ?: return
    DatenalterChip(
        day = day,
        ageDays = metric.dataAgeDays ?: 0,
        stale = metric.status == MetricStatus.STALE,
        today = today,
        modifier = modifier,
    )
}

/** Fehlt eine Angabe, steht das als eigene Form da: Strich statt Haken oder Uhr. */
@Composable
fun NichtBerechenbarChip(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Surface(
        modifier = modifier.border(1.dp, MaterialTheme.colorScheme.outline, shape),
        shape = shape,
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) { ChipContent(text = stringResource(R.string.chip_unavailable), icon = DashIcon) }
}

@Composable
private fun ChipContent(text: String, icon: ImageVector) {
    Row(
        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(text = text, style = MaterialTheme.typography.labelMedium)
    }
}

/** Schlichte Textmarke mit Rand für Art und Status einer Zahl (eingetragen, geplant, berechnet …). */
@Composable
fun Marke(text: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp)),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

/** Art eines Werts als Marke: Eingetragen, Geplant, Geschätzt, Berechnet. */
@Composable
fun ArtMarke(kind: MetricKind, modifier: Modifier = Modifier) {
    Marke(
        text = stringResource(
            when (kind) {
                MetricKind.ACTUAL -> R.string.badge_kind_actual
                MetricKind.PLANNED -> R.string.badge_kind_planned
                MetricKind.ESTIMATED -> R.string.badge_kind_estimated
                MetricKind.CALCULATED -> R.string.badge_kind_calculated
            },
        ),
        modifier = modifier,
    )
}

/** Zustand eines Werts auf einen Blick: Datenalter (oder „Nicht berechenbar“) und Art. Bricht bei großer Schrift um. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ZustandsChips(metric: Metric, today: LocalDate, modifier: Modifier = Modifier) {
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        DatenalterChip(metric, today)
        ArtMarke(metric.kind)
    }
}
