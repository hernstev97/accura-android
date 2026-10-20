package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import app.kiumu.accura.ui.theme.Raster

/** Abstand innerhalb einer Zeile einer [Listengruppe]. */
val GruppenZeileInnen = PaddingValues(horizontal = Raster.Rand, vertical = 10.dp)

/** Sammelt die Zeilen einer [Listengruppe]; [fuss] hebt eine Summenzeile („Gesamt“) leicht ab. */
class ListengruppeInhalt internal constructor() {
    internal val zeilen = mutableListOf<Pair<Boolean, @Composable () -> Unit>>()

    fun zeile(fuss: Boolean = false, inhalt: @Composable () -> Unit) {
        zeilen += fuss to inhalt
    }
}

/**
 * Listengruppe (Material 3 Expressive): Zeilen als einzelne Flächen mit 2 dp Fuge, außen 24 dp rund,
 * innen 4 dp. Ersetzt Trennlinien; jede Zeile ist eine [ListenZeile] mit [GruppenZeileInnen].
 */
@Composable
fun Listengruppe(modifier: Modifier = Modifier, aufbau: ListengruppeInhalt.() -> Unit) {
    val zeilen = ListengruppeInhalt().apply(aufbau).zeilen
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Raster.Fuge)) {
        zeilen.forEachIndexed { index, (fuss, inhalt) ->
            Surface(
                shape = gruppenForm(index, zeilen.size),
                color = if (fuss) MaterialTheme.colorScheme.surfaceContainerHighest else MaterialTheme.colorScheme.surfaceContainer,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ) { inhalt() }
        }
    }
}

private fun gruppenForm(index: Int, anzahl: Int): Shape {
    val aussen = 24.dp
    val innen = 4.dp
    val oben = if (index == 0) aussen else innen
    val unten = if (index == anzahl - 1) aussen else innen
    return RoundedCornerShape(topStart = oben, topEnd = oben, bottomStart = unten, bottomEnd = unten)
}

/** Runde Scheibe mit Symbol vor einer Listenzeile, in der Fläche einer Farbrolle. */
@Composable
fun IconScheibe(icon: ImageVector, tone: Tone, modifier: Modifier = Modifier) {
    val colors = tone.colors()
    Surface(modifier = modifier.size(40.dp), shape = CircleShape, color = colors.container, contentColor = colors.onContainer) {
        Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp)) }
    }
}
