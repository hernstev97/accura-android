package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.kiumu.accura.ui.theme.fuellung

/** Ein Bogen des Rings: Gewicht (zum Beispiel Cent) und Farbe. Teile ohne positives Gewicht bekommen keinen Bogen. */
data class RingTeil(val gewicht: Long, val farbe: Color)

/** Lücke zwischen zwei Bögen in Grad. */
private const val LueckeGrad = 4f

/**
 * Ring nach Google Health: Bögen mit runden Enden und kleinen Lücken auf einer gedämpften Spur, in der
 * Mitte eine kurze Antwort. Die Bögen sind reine Darstellung (Anteile der positiven Gewichte, nichts
 * wird gerundet oder gerechnet, was danach als Zahl erscheint). Die Zahlen stehen daneben als Text,
 * zum Beispiel in [AnteilPille]; für TalkBack ist der Ring ein Eintrag mit [beschreibung].
 */
@Composable
fun Ring(
    teile: List<RingTeil>,
    beschreibung: String,
    modifier: Modifier = Modifier,
    staerke: Dp = 18.dp,
    mitte: @Composable ColumnScope.() -> Unit,
) {
    val spur = MaterialTheme.colorScheme.surfaceContainerHighest
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clearAndSetSemantics { contentDescription = beschreibung }
            .drawBehind {
                val stroke = staerke.toPx()
                val radius = (size.minDimension - stroke) / 2f
                drawCircle(spur, radius, center, style = Stroke(stroke))
                val positiv = teile.filter { it.gewicht > 0 }
                val summe = positiv.sumOf { it.gewicht }.toFloat()
                when {
                    summe <= 0f -> Unit
                    positiv.size == 1 -> drawCircle(positiv.single().farbe, radius, center, style = Stroke(stroke))
                    else -> {
                        // Runde Enden ragen um die halbe Strichbreite über den Bogen hinaus.
                        val kappe = Math.toDegrees((stroke / 2f / radius).toDouble()).toFloat()
                        val topLeft = Offset(center.x - radius, center.y - radius)
                        val bogenFlaeche = Size(radius * 2f, radius * 2f)
                        var start = -90f
                        positiv.forEach { teil ->
                            val bogen = teil.gewicht / summe * 360f
                            val sweep = (bogen - LueckeGrad - 2f * kappe).coerceAtLeast(0.1f)
                            drawArc(
                                color = teil.farbe,
                                startAngle = start + LueckeGrad / 2f + kappe,
                                sweepAngle = sweep,
                                useCenter = false,
                                topLeft = topLeft,
                                size = bogenFlaeche,
                                style = Stroke(stroke, cap = StrokeCap.Round),
                            )
                            start += bogen
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(staerke + 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            content = mitte,
        )
    }
}

/**
 * Anteil-Pille neben dem Ring: Name, Anteil in Prozent (vom Backend, die App rundet nicht) und Betrag.
 * Die Füllung im Farbton des Bogens zeigt den Anteil; über 100 % ist die Pille voll, negative Anteile
 * haben keine Füllung. Die Zahl steht immer als Text daneben. Für TalkBack ist die Pille ein Eintrag.
 */
@Composable
fun AnteilPille(
    name: String,
    anteil: String?,
    cents: Long,
    tone: Tone,
    fuellung: Float,
    modifier: Modifier = Modifier,
) {
    val rolle = tone.colors()
    // „Achtung“ (zum Beispiel „frei“ im Minus) zeigt die ganze Pille in der Fläche der Rolle, nicht nur die Füllung.
    val achtung = tone == Tone.Attention
    val spur = if (achtung) rolle.container else MaterialTheme.colorScheme.surfaceContainerHigh
    val fuellFarbe = rolle.fuellung(spur)
    val breite = fuellung.coerceIn(0f, 1f)
    val text = if (achtung) rolle.onContainer else MaterialTheme.colorScheme.onSurface
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(CircleShape)
            .background(spur)
            .drawBehind {
                val x = size.width * breite
                if (x > 0f) drawRect(fuellFarbe, size = Size(x, size.height))
            }
            .semantics(mergeDescendants = true) { }
            .heightIn(min = 56.dp)
            .padding(horizontal = 18.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(name, style = MaterialTheme.typography.labelLarge, color = text, modifier = Modifier.weight(1f))
                anteil?.let { Text(it, style = MaterialTheme.typography.labelLarge.copy(fontFeatureSettings = "tnum"), color = text) }
            }
            Betrag(cents, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = text, autoShrink = true)
        }
    }
}

/** Legende zu einem Ring in einer Karte: Punkt in der Farbe des Bogens, Name, Betrag. */
@Composable
fun LegendenZeile(name: String, cents: Long?, farbe: Color, modifier: Modifier = Modifier, zusatz: String? = null) {
    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(modifier = Modifier.padding(top = 5.dp).size(10.dp).clip(CircleShape).background(farbe))
        Column(modifier = Modifier.weight(1f)) {
            Text(name, style = MaterialTheme.typography.labelLarge)
            cents?.let { Betrag(it, style = MaterialTheme.typography.titleSmall, autoShrink = true) }
            zusatz?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
