package app.kiumu.accura.screenshots

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import app.kiumu.accura.ui.katalog.Bausteinkatalog
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Der ganze Bausteinkatalog in einem Bild (hoher Bildschirm, niedrige Dichte, damit die Datei klein
 * bleibt). Friert jeden Baustein im Endzustand ein; die Bewegung selbst prüft `BewegungTest`.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h4800dp-mdpi")
class KatalogLangScreenshotTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun hell() {
        rule.setContent { Aufnahme { Bausteinkatalog() } }
        rule.onRoot().captureRoboImage("$ReferenzOrdner/katalog/lang.png", roborazziOptions = Toleranz)
    }

    @Test
    fun dunkel() {
        rule.setContent { Aufnahme(dark = true) { Bausteinkatalog() } }
        rule.onRoot().captureRoboImage("$ReferenzOrdner/katalog/lang-dunkel.png", roborazziOptions = Toleranz)
    }
}
