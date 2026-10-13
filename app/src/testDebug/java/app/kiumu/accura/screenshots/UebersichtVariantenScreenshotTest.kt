package app.kiumu.accura.screenshots

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.ui.screens.OverviewScreen
import app.kiumu.accura.ui.screens.OverviewVariant
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Was je Variante der Übersicht aufgenommen wird. */
enum class VariantenFall(val datei: String, val szenario: DebugScenario, val dark: Boolean = false, val fontScale: Float = 1f) {
    Hell("hell", DebugScenario.STANDARD),
    Dunkel("dunkel", DebugScenario.STANDARD, dark = true),
    GrosseSchrift("grosse-schrift", DebugScenario.STANDARD, fontScale = 2f),
    AlteStaende("alte-staende", DebugScenario.VERALTET),
    Negativ("negativ", DebugScenario.NEGATIV),
    OhneGehaltstag("ohne-gehaltstag", DebugScenario.OHNE_GEHALTSTAG),
}

/**
 * Die Varianten der Übersicht (Prototyp) im sichtbaren Ausschnitt eines Handys. Referenzen unter
 * `uebersicht-<variante>/`. Die Variante „Kontostand zuerst“ ist der Standard der App; sie steckt mit
 * denselben Fällen schon in [AnsichtenScreenshotTest] (Ordner `uebersicht/`) und fehlt hier.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h760dp-xhdpi")
class UebersichtVariantenScreenshotTest(private val variante: OverviewVariant, private val fall: VariantenFall) {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun aufnahme() {
        rule.setContent {
            Aufnahme(fall.dark, fall.fontScale) {
                OverviewScreen(uebersichtZustand(fall.szenario), onRetry = {}, variant = variante)
            }
        }
        rule.onRoot().captureRoboImage("$ReferenzOrdner/${variante.ordner()}/${fall.datei}.png", roborazziOptions = Toleranz)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0} {1}")
        fun parameter(): List<Array<Any>> =
            Weitere.flatMap { v -> VariantenFall.entries.map { f -> arrayOf<Any>(v, f) } }
    }
}

/** Jede Variante in voller Länge, damit auch der Teil unter dem Bildschirmrand eingefroren ist. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h3200dp-xhdpi")
class UebersichtVariantenLangScreenshotTest(private val variante: OverviewVariant) {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun aufnahme() {
        rule.setContent { Aufnahme { OverviewScreen(uebersichtZustand(DebugScenario.STANDARD), onRetry = {}, variant = variante) } }
        rule.onRoot().captureRoboImage("$ReferenzOrdner/${variante.ordner()}/lang.png", roborazziOptions = Toleranz)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun parameter(): List<Array<Any>> = Weitere.map { arrayOf<Any>(it) }
    }
}

/** Die Varianten neben dem Standard. */
private val Weitere = OverviewVariant.entries - OverviewVariant.Standard

fun OverviewVariant.ordner(): String = "uebersicht-" + name.lowercase()
