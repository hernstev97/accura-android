package app.kiumu.accura.screenshots

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import app.kiumu.accura.AppGraph
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.auth.FakeAuthGateway
import app.kiumu.accura.data.Vertrag
import app.kiumu.accura.data.fake.FakeFinanceRepository
import app.kiumu.accura.ui.AccuraApp
import com.github.takahirom.roborazzi.captureRoboImage
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Die ganze App angemeldet, mit Leiste und Titel: fängt Fehler im Rahmen ab, die einzelne Bildschirme nicht zeigen. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h760dp-xhdpi")
class GeruestScreenshotTest {
    @get:Rule
    val rule = createComposeRule()

    private fun graph() = AppGraph(
        auth = FakeAuthGateway(signedIn = true),
        finance = FakeFinanceRepository(MutableStateFlow(DebugScenario.STANDARD), readJson = Vertrag::read),
        clock = Clock.fixed(Instant.parse("2026-08-08T10:00:00Z"), ZoneId.of("Europe/Berlin")),
    )

    private fun aufnahme(name: String, dark: Boolean = false, fontScale: Float = 1f) {
        // AccuraApp setzt ein eigenes Theme; Hell oder Dunkel muss deshalb ausdrücklich hinein.
        rule.setContent { Aufnahme(dark, fontScale) { AccuraApp(graph(), dynamicColor = false, darkTheme = dark) } }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage("$ReferenzOrdner/geruest/$name.png", roborazziOptions = Toleranz)
    }

    @Test
    fun hell() = aufnahme("hell")

    @Test
    fun dunkel() = aufnahme("dunkel", dark = true)

    @Test
    fun grosseSchrift() = aufnahme("grosse-schrift", fontScale = 2f)
}
