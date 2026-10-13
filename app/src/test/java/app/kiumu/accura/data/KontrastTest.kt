package app.kiumu.accura.data

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import app.kiumu.accura.ui.theme.AccuraColors
import app.kiumu.accura.ui.theme.DarkAccuraColors
import app.kiumu.accura.ui.theme.LightAccuraColors
import app.kiumu.accura.ui.theme.RueckfallDunkel
import app.kiumu.accura.ui.theme.RueckfallHell
import androidx.compose.material3.ColorScheme
import kotlin.math.max
import kotlin.math.min
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontraste nach WCAG 2.2: Text mindestens 4,5 zu 1, Symbole, Linien und Ränder mindestens 3 zu 1
 * (Leitfaden, Abschnitt „Farbrollen“). Geprüft werden die festen Rollen und das Rückfall-Schema;
 * Dynamic Color liefert das System, dafür bürgt Material.
 */
class KontrastTest {
    private fun contrast(a: Color, b: Color): Double {
        val la = a.luminance() + 0.05
        val lb = b.luminance() + 0.05
        return max(la, lb).toDouble() / min(la, lb)
    }

    private fun check(name: String, fg: Color, bg: Color, minimum: Double) {
        val ratio = contrast(fg, bg)
        assertTrue("$name: %.2f zu 1, nötig %.1f".format(ratio, minimum), ratio >= minimum)
    }

    private val themes: List<Triple<String, AccuraColors, ColorScheme>> = listOf(
        Triple("hell", LightAccuraColors, RueckfallHell),
        Triple("dunkel", DarkAccuraColors, RueckfallDunkel),
    )

    @Test
    fun `feste Farbrollen sind lesbar, auf ihrer Fläche und auf dem Hintergrund`() {
        themes.forEach { (theme, colors, scheme) ->
            mapOf("frei" to colors.free, "Rücklage" to colors.reserve, "Achtung" to colors.attention, "Schulden" to colors.debt)
                .forEach { (role, rc) ->
                    check("$theme $role Text auf Fläche", rc.onContainer, rc.container, 4.5)
                    check("$theme $role Akzent auf Hintergrund", rc.accent, scheme.background, 3.0)
                    check("$theme $role Akzent auf Fläche", rc.accent, scheme.surface, 3.0)
                }
            // Große Zahl in „Spielraum zuerst“ steht in der Akzentfarbe auf dem Hintergrund.
            check("$theme frei als Zahl", colors.free.accent, scheme.background, 4.5)
            check("$theme Achtung als Zahl", colors.attention.accent, scheme.background, 4.5)
            // Symbole in den Expressive-Zeichen: Fläche in Akzentfarbe, Symbol in der Oberflächenfarbe.
            check("$theme Symbol auf Achtung", scheme.surface, colors.attention.accent, 3.0)
            check("$theme Symbol auf frei", scheme.surface, colors.free.accent, 3.0)
            check("$theme Symbol auf Schulden", scheme.surface, colors.debt.accent, 3.0)
        }
    }

    @Test
    fun `Rückfall-Schema hat lesbaren Text und erkennbare Ränder`() {
        themes.forEach { (theme, _, s) ->
            check("$theme onPrimary", s.onPrimary, s.primary, 4.5)
            check("$theme onPrimaryContainer", s.onPrimaryContainer, s.primaryContainer, 4.5)
            check("$theme onSurface", s.onSurface, s.surface, 4.5)
            check("$theme onSurfaceVariant", s.onSurfaceVariant, s.surface, 4.5)
            check("$theme onSurfaceVariant auf Container", s.onSurfaceVariant, s.surfaceContainerHigh, 4.5)
            check("$theme Rand (outline)", s.outline, s.surface, 3.0)
            check("$theme Fehlertext", s.onErrorContainer, s.errorContainer, 4.5)
        }
    }
}
