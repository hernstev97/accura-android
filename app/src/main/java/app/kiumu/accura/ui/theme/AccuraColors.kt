package app.kiumu.accura.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Eine Farbrolle mit fester Bedeutung: Fläche, Text darauf, Akzent für Linien und Symbole. */
@Immutable
data class RoleColors(val container: Color, val onContainer: Color, val accent: Color)

/**
 * Farben mit fester Bedeutung, unabhängig von Dynamic Color und vom Hintergrundbild
 * (Design-Leitfaden, Abschnitt „Farbrollen“). Farbe trägt nie allein eine Information: Jede Rolle
 * steht immer mit Text oder Symbol.
 *
 * - [free]: Geld, das du ausgeben kannst
 * - [reserve]: Geld, das für etwas zurückliegt
 * - [attention]: eine Zahl ist alt, unvollständig oder überplant (ruhiges Bernstein, nie Rot)
 * - [debt]: Schulden, ruhig und klar in Schiefergrau
 */
@Immutable
data class AccuraColors(
    val free: RoleColors,
    val reserve: RoleColors,
    val attention: RoleColors,
    val debt: RoleColors,
)

val LightAccuraColors = AccuraColors(
    free = RoleColors(Color(0xFFC6EDCF), Color(0xFF00210C), Color(0xFF1B6B35)),
    reserve = RoleColors(Color(0xFFDCE1FF), Color(0xFF071A4D), Color(0xFF3F55A5)),
    attention = RoleColors(Color(0xFFFFE3B3), Color(0xFF2A1800), Color(0xFF8A5100)),
    debt = RoleColors(Color(0xFFE1E3EC), Color(0xFF1A1D2A), Color(0xFF565C70)),
)

val DarkAccuraColors = AccuraColors(
    free = RoleColors(Color(0xFF0B3A1C), Color(0xFFC6EDCF), Color(0xFF8AD5A0)),
    reserve = RoleColors(Color(0xFF25397F), Color(0xFFDCE1FF), Color(0xFFB4C3FF)),
    attention = RoleColors(Color(0xFF4E3200), Color(0xFFFFE3B3), Color(0xFFFFB95B)),
    debt = RoleColors(Color(0xFF2C3040), Color(0xFFE1E3EC), Color(0xFFB9BED3)),
)

val LocalAccuraColors = staticCompositionLocalOf { LightAccuraColors }
