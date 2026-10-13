@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package app.kiumu.accura.ui.katalog

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.toPath
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.graphics.shapes.Morph
import app.kiumu.accura.R
import app.kiumu.accura.ui.theme.AccuraTheme

/*
 * Expressive-Bausteine. Regel aus dem Leitfaden: Form und Bewegung zeigen einen Zustand (frisch oder
 * alt, gespeichert, eine Rate läuft aus), sie dekorieren nicht. Höchstens einer davon pro Bildschirm.
 * Jeder Zustand steht zusätzlich als Text da; die Formen selbst sind für TalkBack stumm.
 * Ist „Animationen entfernen“ an, steht sofort der Endzustand da, ohne Zwischenbild.
 */

/** Form aus einem Morph zwischen zwei Material-Formen; [progress] 0 ist die Start-, 1 die Zielform. */
private class MorphForm(private val morph: Morph, private val progress: Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        // Die Material-Formen liegen normiert im Einheitsquadrat und werden auf die Größe gezogen.
        val path = morph.toPath(progress = progress)
        path.transform(Matrix().apply { scale(size.width, size.height) })
        return Outline.Generic(path)
    }
}

/**
 * Fortschritt 0 → 1 zwischen zwei Zuständen, mit der räumlichen Feder des Expressive-Schemas (darf
 * leicht überschwingen). [startBeiNull]: beim ersten Erscheinen von 0 aus einblenden statt fertig dastehen.
 */
@Composable
private fun zustandsFortschritt(ziel: Boolean, startBeiNull: Boolean = false): Float {
    val reduce = AccuraTheme.reduceMotion
    val spec = MaterialTheme.motionScheme.slowSpatialSpec<Float>()
    val progress = remember { Animatable(if (ziel && !(startBeiNull && !reduce)) 1f else 0f) }
    LaunchedEffect(ziel, reduce) {
        val target = if (ziel) 1f else 0f
        if (reduce) {
            progress.snapTo(target)
        } else {
            nachDemWechsel()
            progress.animateTo(target, spec)
        }
    }
    return progress.value.coerceIn(-0.2f, 1.2f)
}

/**
 * Wartet ein Bild ab, bevor eine Bewegung startet. Kommt der neue Zustand mit neuen Daten, baut die
 * Ansicht im selben Bild komplett neu auf; das dauert auf langsamen Geräten länger als ein Bild. Startet
 * die Feder in diesem Bild, bekommt sie einen veralteten Zeitstempel und ist im nächsten Bild schon
 * fertig (im Emulator gesehen: Formwechsel ohne Zwischenbilder).
 */
private suspend fun nachDemWechsel() {
    withFrameNanos { }
}

/**
 * Frische eines Stands als Form: frisch ein Siegel (Keks mit neun Bögen) mit Haken, alt ein schlichtes
 * Quadrat mit Uhr in der Rolle „Achtung“. Wechselt der Zustand, wandelt sich die Form. Der
 * Datenalter-Chip daneben sagt dasselbe in Worten.
 */
@Composable
fun FrischeZeichen(stale: Boolean, modifier: Modifier = Modifier) {
    val morph = remember { Morph(MaterialShapes.Cookie9Sided, MaterialShapes.Square) }
    val progress = zustandsFortschritt(stale)
    val fill = lerp(MaterialTheme.colorScheme.primary, AccuraTheme.colors.attention.accent, progress.coerceIn(0f, 1f))
    val iconColor = if (stale) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.onPrimary
    Box(
        modifier = modifier
            .size(56.dp)
            .clip(MorphForm(morph, progress))
            .background(fill)
            .clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        Icon(if (stale) ClockIcon else Icons.Default.Check, contentDescription = null, tint = iconColor)
    }
}

/**
 * Bestätigung „Gespeichert“: Ein Kreis wächst und wird zum Stern mit Haken. Erscheint nur nach einer
 * erfolgreichen Speicherung, der Text daneben sagt es in Worten (und TalkBack liest ihn vor).
 */
@Composable
fun GespeichertZeichen(gespeichert: Boolean, modifier: Modifier = Modifier) {
    val morph = remember { Morph(MaterialShapes.Circle, MaterialShapes.SoftBurst) }
    val progress = zustandsFortschritt(gespeichert, startBeiNull = true)
    Row(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .graphicsLayer {
                    val scale = 0.4f + 0.6f * progress.coerceIn(0f, 1.2f)
                    scaleX = scale
                    scaleY = scale
                    alpha = progress.coerceIn(0f, 1f)
                }
                .clip(MorphForm(morph, progress))
                .background(MaterialTheme.colorScheme.primary)
                .clearAndSetSemantics { },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
        }
        if (gespeichert) Text(stringResource(R.string.saved), style = MaterialTheme.typography.labelLarge)
    }
}

/**
 * Meilenstein „Eine Rate läuft aus“: ein weicher Stern in der Rolle „Frei“ mit steigender Linie.
 * Beim ersten Erscheinen wächst er aus einem Kreis, danach steht er still. Der Text daneben nennt
 * Monat und Betrag.
 */
@Composable
fun RateLaeuftAusZeichen(modifier: Modifier = Modifier) {
    val morph = remember { Morph(MaterialShapes.Circle, MaterialShapes.SoftBurst) }
    val progress = zustandsFortschritt(ziel = true, startBeiNull = true)
    Box(
        modifier = modifier
            .size(48.dp)
            .clip(MorphForm(morph, progress))
            .background(AccuraTheme.colors.free.accent)
            .clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        Icon(TrendingUpIcon, contentDescription = null, tint = MaterialTheme.colorScheme.surface)
    }
}

/**
 * Große Zahl, die zeigt, in welche Richtung sie sich ändert: Steigt der Wert, kommt die neue Zahl von
 * unten, sinkt er, von oben. Ohne Änderung bewegt sich nichts. TalkBack liest die neue Zahl vor.
 * Ohne Animationen wird die Zahl einfach ersetzt.
 */
@Composable
fun ZahlMitRichtung(
    wert: Long?,
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.displayMedium,
    color: Color = Color.Unspecified,
) {
    val live = modifier.semantics { liveRegion = LiveRegionMode.Polite }
    if (AccuraTheme.reduceMotion) {
        // Ohne Animationen gar kein Übergang, auch kein Bild, in dem alte und neue Zahl übereinanderliegen.
        Box(live) { BetragGross(text, style = style, color = color) }
        return
    }
    val spatial = MaterialTheme.motionScheme.defaultSpatialSpec<IntOffset>()
    val effects = MaterialTheme.motionScheme.defaultEffectsSpec<Float>()
    // Neue Zahl ein Bild später übernehmen, damit der Übergang nicht im Neuaufbau der Ansicht untergeht.
    var shown by remember { mutableStateOf(wert to text) }
    LaunchedEffect(wert, text) {
        if (shown != wert to text) {
            nachDemWechsel()
            shown = wert to text
        }
    }
    AnimatedContent(
        targetState = shown,
        modifier = live,
        transitionSpec = {
            val steigt = (targetState.first ?: 0L) >= (initialState.first ?: 0L)
            (slideInVertically(spatial) { h -> if (steigt) h else -h } + fadeIn(effects)) togetherWith
                (slideOutVertically(spatial) { h -> if (steigt) -h else h } + fadeOut(effects)) using
                SizeTransform(clip = true)
        },
        label = "Zahl mit Richtung",
    ) { (_, shown) -> BetragGross(shown, style = style, color = color) }
}
