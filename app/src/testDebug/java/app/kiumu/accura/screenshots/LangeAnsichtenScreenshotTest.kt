package app.kiumu.accura.screenshots

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import app.kiumu.accura.DebugScenario
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Jede Ansicht in voller Länge (hoher Bildschirm), damit auch der Teil unter dem Bildschirmrand eingefroren ist. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h3200dp-xhdpi")
class LangeAnsichtenScreenshotTest(private val ansicht: Ansicht) {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun aufnahme() {
        rule.setContent { Aufnahme { ansicht.render(DebugScenario.STANDARD) } }
        rule.onRoot().captureRoboImage("$ReferenzOrdner/${ansicht.ordner}/lang.png", roborazziOptions = Toleranz)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun parameter(): List<Array<Any>> = Ansicht.entries.map { arrayOf<Any>(it) }
    }
}
