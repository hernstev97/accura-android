package app.kiumu.accura.ui.katalog

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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.kiumu.accura.ui.theme.Raster

/** Breite der Leiste links; der Punkt sitzt mittig, die Verbindungslinie läuft durch seine Mitte. */
private val LeisteBreite = 48.dp

/*
 * Zeitleiste „Was kommt“ (aus Variante C der ersten Runde): Stationen von heute nach vorn, links Punkt
 * und Linie, rechts Zeitpunkt und Inhalt. Eingesetzt in Demnächst (heute, Zahlungen, Gehalt) und in
 * Schulden (auslaufende Raten, schuldenfrei); dort ist sie zugleich die Textfassung des Stufendiagramms.
 */

/**
 * Eine Station der Zeitleiste. [first] und [last] lassen die Linie oben oder unten enden. Für TalkBack
 * ist eine Station ein Eintrag; tippbare Elemente darin bleiben einzeln bedienbar.
 */
@Composable
fun Station(
    wann: String,
    punkt: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    first: Boolean = false,
    last: Boolean = false,
    content: @Composable () -> Unit,
) {
    val lineColor = MaterialTheme.colorScheme.outline
    Row(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { }
            .drawBehind {
                val x = LeisteBreite.toPx() / 2
                val mitte = LeisteBreite.toPx() / 2
                val stroke = 2.dp.toPx()
                if (!first) drawLine(lineColor, Offset(x, 0f), Offset(x, mitte), stroke)
                if (!last) drawLine(lineColor, Offset(x, mitte), Offset(x, size.height), stroke)
            },
        horizontalArrangement = Arrangement.spacedBy(Raster.Luecke),
    ) {
        Box(modifier = Modifier.size(LeisteBreite), contentAlignment = Alignment.Center) { punkt() }
        Column(
            modifier = Modifier.weight(1f).padding(top = Raster.Luecke, bottom = 20.dp),
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

/** Punkt der Zeitleiste in einer Farbrolle; mit [icon] eine gefüllte Scheibe (zum Beispiel Ziel, Gehalt). */
@Composable
fun Punkt(tone: Tone, icon: ImageVector? = null) {
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
