package app.kiumu.accura.screenshots

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.data.FinanceRepository
import app.kiumu.accura.data.Vertrag
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.fake.FakeFinanceRepository
import app.kiumu.accura.ui.screens.BudgetScreen
import app.kiumu.accura.ui.screens.DebtsScreen
import app.kiumu.accura.ui.screens.OverviewScreen
import app.kiumu.accura.ui.screens.UpcomingScreen
import com.github.takahirom.roborazzi.RoborazziOptions
import com.github.takahirom.roborazzi.captureRoboImage
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

private val Heute: LocalDate = LocalDate.of(2026, 8, 8)

private fun <T> zustand(scenario: DebugScenario, pick: FinanceRepository.(LocalDate) -> Flow<ViewState<T>>): ViewState<T> =
    runBlocking {
        FakeFinanceRepository(MutableStateFlow(scenario), readJson = Vertrag::read).pick(Heute).first()
    }

/** Die vier Ansichten, jede mit dem Bildschirm, der einen [ViewState] annimmt. */
enum class Ansicht(val ordner: String, val render: @Composable (DebugScenario) -> Unit) {
    Uebersicht("uebersicht", { OverviewScreen(zustand(it) { d -> overview(d) }, onRetry = {}) }),
    Demnaechst("demnaechst", { UpcomingScreen(zustand(it) { d -> upcoming(d) }, onRetry = {}) }),
    Budget("budget", { BudgetScreen(zustand(it) { d -> budget(d) }, onRetry = {}) }),
    Schulden("schulden", { DebtsScreen(zustand(it) { d -> debts(d) }, onRetry = {}) }),
}

/** Zustände und Darstellungen, die jede Ansicht durchläuft (Plan: Hell, Dunkel, große Schrift, leer, negativ, veraltet). */
enum class Variante(val datei: String, val szenario: DebugScenario, val dark: Boolean = false, val fontScale: Float = 1f) {
    Hell("hell", DebugScenario.STANDARD),
    Dunkel("dunkel", DebugScenario.STANDARD, dark = true),
    GrosseSchrift("grosse-schrift", DebugScenario.STANDARD, fontScale = 2f),
    Leer("leer", DebugScenario.LEER),
    Negativ("negativ", DebugScenario.NEGATIV),
    AlteStaende("alte-staende", DebugScenario.VERALTET),
    OfflineKopie("offline-kopie", DebugScenario.OFFLINE_KOPIE),
}

@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h760dp-xhdpi")
class AnsichtenScreenshotTest(private val ansicht: Ansicht, private val variante: Variante) {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun aufnahme() {
        rule.setContent { Aufnahme(variante.dark, variante.fontScale) { ansicht.render(variante.szenario) } }
        rule.onRoot().captureRoboImage(
            "$ReferenzOrdner/${ansicht.ordner}/${variante.datei}.png",
            roborazziOptions = Toleranz,
        )
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0} {1}")
        fun parameter(): List<Array<Any>> = Ansicht.entries.flatMap { a -> Variante.entries.map { v -> arrayOf<Any>(a, v) } }
    }
}

/** Kleine Abweichungen durch Schrift-Rendering zählen nicht als Änderung. */
val Toleranz = RoborazziOptions(compareOptions = RoborazziOptions.CompareOptions(changeThreshold = 0.005f))
