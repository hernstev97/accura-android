package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.theme.AccuraTheme
import java.time.LocalDate

/**
 * Datenalter-Chip. Form und Text tragen die Aussage, nicht nur die Farbe: Ein alter Stand hat eine
 * Uhr, einen gestrichelten Rand und das Wort „Alt“. [today] kommt aus dem Modell, nicht von einer Uhr.
 */
@Composable
fun DatenalterChip(day: LocalDate, ageDays: Int, stale: Boolean, today: LocalDate, modifier: Modifier = Modifier) {
    val colors = AccuraTheme.colors.attention
    val whenText = if (ageDays == 0) stringResource(R.string.chip_data_today) else stringResource(R.string.chip_data_from, formatDay(day, today))
    val text = if (stale) {
        stringResource(R.string.chip_data_stale, whenText, pluralStringResource(R.plurals.days_ago, ageDays, ageDays))
    } else {
        whenText
    }
    val shape = RoundedCornerShape(8.dp)
    if (stale) {
        val dash = PathEffect.dashPathEffect(floatArrayOf(12f, 8f))
        Surface(
            modifier = modifier.drawBehind {
                drawRoundRect(
                    color = colors.accent,
                    size = Size(size.width, size.height),
                    cornerRadius = CornerRadius(8.dp.toPx()),
                    style = Stroke(width = 2.dp.toPx(), pathEffect = dash),
                )
            },
            shape = shape,
            color = colors.container,
            contentColor = colors.onContainer,
        ) {
            ChipContent(text = text, withClock = true)
        }
    } else {
        Surface(
            modifier = modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
            shape = shape,
            color = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ) {
            ChipContent(text = text, withClock = false)
        }
    }
}

@Composable
private fun ChipContent(text: String, withClock: Boolean) {
    Row(
        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (withClock) {
            Icon(ClockIcon, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text = text, style = MaterialTheme.typography.labelLarge)
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
