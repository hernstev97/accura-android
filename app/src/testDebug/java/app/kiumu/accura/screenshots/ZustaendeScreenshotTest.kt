package app.kiumu.accura.screenshots

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import app.kiumu.accura.auth.AuthError
import app.kiumu.accura.data.ErrorKind
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.ui.anmeldung.SignInScreen
import app.kiumu.accura.ui.anmeldung.SignInStep
import app.kiumu.accura.ui.anmeldung.SignInUiState
import app.kiumu.accura.ui.katalog.Bausteinkatalog
import app.kiumu.accura.ui.screens.OverviewScreen
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Zustände, die alle Ansichten gleich behandeln (Laden, Fehler), und der Bausteinkatalog. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h760dp-xhdpi")
class ZustaendeScreenshotTest {
    @get:Rule
    val rule = createComposeRule()

    private fun aufnahme(name: String, dark: Boolean = false, fontScale: Float = 1f, content: @androidx.compose.runtime.Composable () -> Unit) {
        rule.setContent { Aufnahme(dark, fontScale, content) }
        rule.onRoot().captureRoboImage("$ReferenzOrdner/$name.png", roborazziOptions = Toleranz)
    }

    @Test
    fun laden() = aufnahme("zustaende/laden") { OverviewScreen(ViewState.Loading, onRetry = {}) }

    @Test
    fun fehlerServer() = aufnahme("zustaende/fehler-server") { OverviewScreen(ViewState.Error(ErrorKind.SERVER), onRetry = {}) }

    @Test
    fun fehlerNichtVerbunden() =
        aufnahme("zustaende/fehler-nicht-verbunden") { OverviewScreen(ViewState.Error(ErrorKind.NOT_CONNECTED), onRetry = {}) }

    @Test
    fun katalogHell() = aufnahme("katalog/hell") { Bausteinkatalog() }

    @Test
    fun katalogDunkel() = aufnahme("katalog/dunkel", dark = true) { Bausteinkatalog() }

    @Test
    fun katalogGrosseSchrift() = aufnahme("katalog/grosse-schrift", fontScale = 2f) { Bausteinkatalog() }

    private val leer = SignInUiState()

    private fun anmeldung(name: String, state: SignInUiState, dark: Boolean = false, fontScale: Float = 1f) =
        aufnahme("anmeldung/$name", dark, fontScale) {
            SignInScreen(state, onEmailChange = {}, onCodeChange = {}, onSubmit = {}, onBack = {}, hint = null)
        }

    @Test
    fun anmeldungEmail() = anmeldung("email", leer)

    @Test
    fun anmeldungEmailDunkel() = anmeldung("email-dunkel", leer.copy(email = "test@example.test"), dark = true)

    @Test
    fun anmeldungEmailFehler() = anmeldung("email-fehler", leer.copy(email = "kaputt", error = AuthError.INVALID_EMAIL))

    @Test
    fun anmeldungCode() = anmeldung("code", leer.copy(step = SignInStep.CODE, email = "test@example.test", code = "123"))

    @Test
    fun anmeldungCodeFehler() =
        anmeldung("code-fehler", leer.copy(step = SignInStep.CODE, email = "test@example.test", code = "111111", error = AuthError.CODE_INVALID))

    @Test
    fun anmeldungGrosseSchrift() = anmeldung("grosse-schrift", leer.copy(step = SignInStep.CODE, email = "test@example.test", code = "123456"), fontScale = 2f)
}
