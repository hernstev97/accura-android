package app.kiumu.accura.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext

@Composable
private fun accuraColorScheme(dark: Boolean, dynamicColor: Boolean): ColorScheme {
    val context = LocalContext.current
    return when {
        dynamicColor -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> RueckfallDunkel
        else -> RueckfallHell
    }
}

/**
 * Theme der App: Material 3 Expressive mit Dynamic Color als Grundstimmung, den festen Farbrollen aus
 * [AccuraColors], Google Sans Flex ([AccuraTypography]) und der Systemeinstellung zu Animationen
 * ([LocalReduceMotion]). Ohne Dynamic Color gilt das Rückfall-Schema aus Petrol (`RueckfallFarben.kt`).
 * Expressive-APIs sind experimentell; sie stehen nur hier und in `ui/katalog` unter `@OptIn` (AGENTS.md).
 * Tests schalten `dynamicColor` aus und setzen `reduceMotion` fest.
 */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun AccuraTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    reduceMotion: Boolean = systemReduceMotion(),
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalAccuraColors provides if (darkTheme) DarkAccuraColors else LightAccuraColors,
        LocalReduceMotion provides reduceMotion,
    ) {
        MaterialExpressiveTheme(
            colorScheme = accuraColorScheme(darkTheme, dynamicColor),
            motionScheme = MotionScheme.expressive(),
            typography = AccuraTypography,
            content = content,
        )
    }
}

/** Zugriff auf die festen Farbrollen und die Bewegungseinstellung: `AccuraTheme.colors.free`, `AccuraTheme.reduceMotion`. */
object AccuraTheme {
    val colors: AccuraColors
        @Composable get() = LocalAccuraColors.current

    val reduceMotion: Boolean
        @Composable get() = LocalReduceMotion.current
}
