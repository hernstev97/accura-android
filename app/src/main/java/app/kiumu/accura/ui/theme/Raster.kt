package app.kiumu.accura.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * Ein Raster für alle Ansichten (Prototyp Runde 2, „geradeziehen“): 4-dp-Basis, wenige feste Abstände.
 * Neue Werte nur mit Grund.
 *
 * | Name | Wert | Wo |
 * | --- | --- | --- |
 * | [Rand] | 16 dp | Seitenrand und Innenabstand von Karten und Kacheln |
 * | [Luecke] | 12 dp | zwischen Kacheln, Karten und Blöcken eines Abschnitts |
 * | [Abschnitt] | 12 dp | zusätzlich über jeder Abschnittsüberschrift, mit der Lücke zusammen 24 dp |
 * | [Eng] | 8 dp | zwischen Zeilen in einer Karte, zwischen Chips |
 * | [Fuge] | 2 dp | zwischen den Zeilen einer Listengruppe |
 * | [Hauptkarte] | 20 dp | Innenabstand der einen großen Karte einer Ansicht |
 */
object Raster {
    val Rand = 16.dp
    val Luecke = 12.dp
    val Abschnitt = 12.dp
    val Eng = 8.dp
    val Fuge = 2.dp
    val Hauptkarte = 20.dp
}

/**
 * Radien: Karten, Kacheln und Listengruppen außen 24 dp (`large`), Flächen in einer Karte 12 dp
 * (`medium`), die inneren Ecken einer Listengruppe 4 dp (`extraSmall`), Knöpfe und Anteil-Pillen ganz
 * rund. `extraLarge` (28 dp) bleibt für das untere Blatt, wie in Material 3.
 */
val AccuraShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(28.dp),
)
