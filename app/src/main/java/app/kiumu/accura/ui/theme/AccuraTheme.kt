package app.kiumu.accura.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// Rückfall-Schema (Petrol, wie die alte App). Offen: Farbton und Schema-Variante entscheidet Steven (Leitfaden).
private val FallbackLight = lightColorScheme(
    primary = Color(0xFF2F667A),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFBDE9FF),
    onPrimaryContainer = Color(0xFF001F2A),
    secondary = Color(0xFF4D616B),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFD0E6F2),
    onSecondaryContainer = Color(0xFF081E27),
    tertiary = Color(0xFF5C5B7D),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFE2DFFF),
    onTertiaryContainer = Color(0xFF181837),
    background = Color(0xFFF6FAFD),
    onBackground = Color(0xFF171C1F),
    surface = Color(0xFFF6FAFD),
    onSurface = Color(0xFF171C1F),
    surfaceVariant = Color(0xFFDCE4E9),
    onSurfaceVariant = Color(0xFF40484C),
    outline = Color(0xFF70787D),
    outlineVariant = Color(0xFFC0C8CD),
)

private val FallbackDark = darkColorScheme(
    primary = Color(0xFF8BD0EA),
    onPrimary = Color(0xFF003546),
    primaryContainer = Color(0xFF0E4D62),
    onPrimaryContainer = Color(0xFFBDE9FF),
    secondary = Color(0xFFB4CAD6),
    onSecondary = Color(0xFF1F333C),
    secondaryContainer = Color(0xFF354A53),
    onSecondaryContainer = Color(0xFFD0E6F2),
    tertiary = Color(0xFFC5C3EA),
    onTertiary = Color(0xFF2E2E4D),
    tertiaryContainer = Color(0xFF444465),
    onTertiaryContainer = Color(0xFFE2DFFF),
    background = Color(0xFF0F1417),
    onBackground = Color(0xFFDFE3E7),
    surface = Color(0xFF0F1417),
    onSurface = Color(0xFFDFE3E7),
    surfaceVariant = Color(0xFF40484C),
    onSurfaceVariant = Color(0xFFC0C8CD),
    outline = Color(0xFF8A9297),
    outlineVariant = Color(0xFF40484C),
)

@Composable
private fun accuraColorScheme(dark: Boolean, dynamicColor: Boolean): ColorScheme {
    val context = LocalContext.current
    return when {
        dynamicColor ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> FallbackDark
        else -> FallbackLight
    }
}

/**
 * Theme der App: Material 3 Expressive mit Dynamic Color als Grundstimmung und den festen
 * Farbrollen aus [AccuraColors]. Expressive-APIs sind in Material 3 1.4 experimentell; sie stehen
 * nur hier und in `ui/katalog` unter `@OptIn` (AGENTS.md). Tests schalten `dynamicColor` aus.
 */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun AccuraTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalAccuraColors provides if (darkTheme) DarkAccuraColors else LightAccuraColors) {
        MaterialExpressiveTheme(
            colorScheme = accuraColorScheme(darkTheme, dynamicColor),
            motionScheme = MotionScheme.expressive(),
            content = content,
        )
    }
}

/** Zugriff auf die festen Farbrollen: `AccuraTheme.colors.free`. */
object AccuraTheme {
    val colors: AccuraColors
        @Composable get() = LocalAccuraColors.current

}
