package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.kiumu.accura.ui.format.achsenGrenze
import app.kiumu.accura.ui.format.formatAchse

/*
 * Diagramme mit Compose Canvas, ohne Diagramm-Bibliothek. Sie zeigen, was als Text schon dasteht:
 * Jedes Diagramm hat eine Beschreibung für TalkBack und daneben eine Tabelle oder Liste mit den
 * genauen Beträgen. Nur die Achsen sind gerundet (Leitfaden, Regel 6).
 */

/** Höhe der Zeichenfläche. */
private val DiagrammHoehe = 168.dp

/** Abstand der Zeichnung zum oberen und unteren Rand, damit Linie und Punkte nicht abgeschnitten werden. */
private val Rand = 8.dp

/** Achse von [min] bis [max] in Cent; schließt 0 immer ein. */
private class Achse(val min: Long, val max: Long) {
    fun anteil(wert: Long): Float = if (max == min) 0f else (wert - min).toFloat() / (max - min).toFloat()
}

private fun achseFuer(werte: List<Long>): Achse {
    val hoch = achsenGrenze(werte.maxOrNull() ?: 0L)
    val tief = -achsenGrenze(-(werte.minOrNull() ?: 0L))
    return if (hoch == tief) Achse(0, 100) else Achse(tief, hoch)
}

/**
 * Achsenbeschriftung links, Zeichenfläche rechts, darunter optional [unten] (Beschriftung der Zeit).
 * Die Beschriftungen sind Text (bei großer Schrift lesbar), die Zeichnung ist für TalkBack ein Eintrag
 * mit [beschreibung].
 */
@Composable
private fun DiagrammRahmen(
    achse: Achse,
    beschreibung: String,
    unten: (@Composable () -> Unit)? = null,
    zeichnen: DrawScope.(Achse) -> Unit,
) {
    val gitter = MaterialTheme.colorScheme.outlineVariant
    val beschriftung = MaterialTheme.colorScheme.onSurfaceVariant
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(modifier = Modifier.height(DiagrammHoehe), verticalArrangement = Arrangement.SpaceBetween) {
            Text(formatAchse(achse.max), style = MaterialTheme.typography.labelSmall, color = beschriftung)
            if (achse.min < 0 && achse.max > 0) {
                Text(formatAchse(0), style = MaterialTheme.typography.labelSmall, color = beschriftung)
            }
            Text(formatAchse(achse.min), style = MaterialTheme.typography.labelSmall, color = beschriftung)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Canvas(modifier = Modifier.fillMaxWidth().height(DiagrammHoehe).semantics { contentDescription = beschreibung }) {
                val strich = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))
                listOf(achse.max, 0L, achse.min).distinct().forEach { wert ->
                    val y = yFuer(achse, wert)
                    drawLine(gitter, Offset(0f, y), Offset(size.width, y), 1.dp.toPx(), pathEffect = strich)
                }
                zeichnen(achse)
            }
            unten?.invoke()
        }
    }
}

/** Beschriftung unter einem Diagramm, klein und leise. */
@Composable
private fun ZeitBeschriftung(text: String, modifier: Modifier = Modifier, textAlign: TextAlign = TextAlign.Start) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = textAlign,
        modifier = modifier,
    )
}

private fun DrawScope.yFuer(achse: Achse, wert: Long): Float {
    val rand = Rand.toPx()
    return rand + (1f - achse.anteil(wert)) * (size.height - 2 * rand)
}

/**
 * Verlauf als Linie mit Fläche darunter, zum Beispiel die Restschuld bei planmäßiger Zahlung. Die
 * Punkte stehen in gleichen Abständen (ein Punkt je Monat). Der erste Punkt (heute) ist betont.
 */
@Composable
fun Verlaufskurve(
    werte: List<Long>,
    tone: Tone,
    beschreibung: String,
    anfang: String,
    ende: String,
    modifier: Modifier = Modifier,
) {
    val farben = tone.colors()
    val linie = farben.accent
    val flaeche = farben.container
    Box(modifier = modifier.fillMaxWidth()) {
        DiagrammRahmen(
            achse = achseFuer(werte),
            beschreibung = beschreibung,
            unten = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ZeitBeschriftung(anfang, Modifier.weight(1f))
                    ZeitBeschriftung(ende, Modifier.weight(1f), TextAlign.End)
                }
            },
        ) { achse ->
            if (werte.isEmpty()) return@DiagrammRahmen
            val schritt = if (werte.size > 1) size.width / (werte.size - 1) else 0f
            val punkte = werte.mapIndexed { i, wert -> Offset(i * schritt, yFuer(achse, wert)) }
            val null0 = yFuer(achse, 0)
            val form = Path().apply {
                moveTo(punkte.first().x, null0)
                punkte.forEach { lineTo(it.x, it.y) }
                lineTo(punkte.last().x, null0)
                close()
            }
            drawPath(form, flaeche)
            val weg = Path().apply {
                moveTo(punkte.first().x, punkte.first().y)
                punkte.drop(1).forEach { lineTo(it.x, it.y) }
            }
            drawPath(weg, linie, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
            drawCircle(linie, 5.dp.toPx(), punkte.first())
            drawCircle(linie, 5.dp.toPx(), punkte.last())
        }
    }
}

/**
 * Stufen: ein Wert je Abschnitt, in gleichen Breiten nebeneinander, mit Stufen dazwischen (zum Beispiel
 * „Frei im Monat“ nach jeder auslaufenden Rate). [beschriftungen] stehen unter dem Beginn jeder Stufe.
 */
@Composable
fun Stufendiagramm(
    werte: List<Long>,
    beschriftungen: List<String>,
    tone: Tone,
    beschreibung: String,
    modifier: Modifier = Modifier,
) {
    val farben = tone.colors()
    val linie = farben.accent
    val flaeche = farben.container
    Box(modifier = modifier.fillMaxWidth()) {
        DiagrammRahmen(
            achse = achseFuer(werte),
            beschreibung = beschreibung,
            unten = {
                Row {
                    beschriftungen.forEach { text -> ZeitBeschriftung(text, Modifier.weight(1f).padding(end = 4.dp)) }
                }
            },
        ) { a ->
            if (werte.isEmpty()) return@DiagrammRahmen
            val breite = size.width / werte.size
            val null0 = yFuer(a, 0)
            werte.forEachIndexed { i, wert ->
                val y = yFuer(a, wert)
                drawRect(flaeche, topLeft = Offset(i * breite, minOf(y, null0)), size = Size(breite, kotlin.math.abs(null0 - y)))
            }
            val weg = Path()
            werte.forEachIndexed { i, wert ->
                val y = yFuer(a, wert)
                if (i == 0) weg.moveTo(0f, y) else weg.lineTo(i * breite, y)
                weg.lineTo((i + 1) * breite, y)
            }
            drawPath(weg, linie, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
            werte.forEachIndexed { i, wert -> drawCircle(linie, 5.dp.toPx(), Offset(i * breite + if (i == 0) 5.dp.toPx() else 0f, yFuer(a, wert))) }
        }
    }
}

/**
 * Balken einer Rangliste (Budget nach Kategorie oder Notwendigkeit): Name und Betrag, darunter der
 * Balken. Die Länge ist reine Darstellung ([anteil] am größten Wert); bei sehr großer Schrift steht
 * der Betrag unter dem Namen.
 */
@Composable
fun BalkenZeile(
    name: String,
    cents: Long,
    anteil: Float,
    farbe: Color,
    modifier: Modifier = Modifier,
    zusatz: String? = null,
) {
    val gestapelt = LocalDensity.current.fontScale >= 1.5f
    Column(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (gestapelt) {
            Text(name, style = MaterialTheme.typography.bodyLarge)
            Betrag(cents, style = MaterialTheme.typography.bodyLarge, autoShrink = true)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Betrag(cents, style = MaterialTheme.typography.bodyLarge)
            }
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(12.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHighest),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(anteil.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(CircleShape)
                    .background(farbe),
            )
        }
        zusatz?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
