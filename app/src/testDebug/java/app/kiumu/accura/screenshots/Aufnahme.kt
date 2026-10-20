package app.kiumu.accura.screenshots

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import app.kiumu.accura.ui.theme.AccuraTheme

/** Rahmen aller Screenshot-Tests: festes Farbschema (kein Dynamic Color), Hell oder Dunkel, Schriftgröße. */
@Composable
fun Aufnahme(dark: Boolean = false, fontScale: Float = 1f, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
        AccuraTheme(darkTheme = dark, dynamicColor = false) {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background, content = content)
        }
    }
}

/** Wohin die Referenzbilder geschrieben und womit sie verglichen werden (relativ zum Modul `app`). */
const val ReferenzOrdner = "src/test/screenshots"
