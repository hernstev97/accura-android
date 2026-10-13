package app.kiumu.accura.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.StateRestorationTester
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.v2.runAndroidComposeUiTest
import app.kiumu.accura.AppGraph
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.DebugTools
import app.kiumu.accura.auth.FakeAuthGateway
import app.kiumu.accura.data.Vertrag
import app.kiumu.accura.data.fake.FakeFinanceRepository
import app.kiumu.accura.ui.screens.OverviewVariant
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Anmelde-Ablauf und Navigation der ganzen App gegen Fake-Anmeldung und Fake-Daten. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h760dp-xhdpi")
class AppFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val scenario = MutableStateFlow(DebugScenario.STANDARD)
    private val variant = MutableStateFlow(OverviewVariant.Standard)
    private val tools = object : DebugTools {
        override val scenario: StateFlow<DebugScenario> = this@AppFlowTest.scenario
        override fun select(scenario: DebugScenario) {
            this@AppFlowTest.scenario.value = scenario
        }
        override val overviewVariant: StateFlow<OverviewVariant> = this@AppFlowTest.variant
        override fun selectOverviewVariant(variant: OverviewVariant) {
            this@AppFlowTest.variant.value = variant
        }
    }
    private val graph = AppGraph(
        auth = FakeAuthGateway(),
        finance = FakeFinanceRepository(scenario, readJson = Vertrag::read),
        clock = Clock.fixed(Instant.parse("2026-08-08T10:00:00Z"), ZoneId.of("Europe/Berlin")),
        debugTools = tools,
    )

    private fun start() = rule.setContent { AccuraApp(graph, dynamicColor = false) }

    private fun text(value: String) = rule.onNodeWithText(value)

    private fun signIn() {
        text("E-Mail-Adresse").performTextInput("test@example.test")
        text("Code senden").performClick()
        text("Code").performTextInput("123456")
        text("Anmelden").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("1.350,75 €")).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun openTab(label: String) = rule.onNode(hasClickAction() and hasText(label)).performClick()

    @Test
    fun `Start zeigt die Anmeldung und keine Ansicht`() {
        start()
        text("E-Mail-Adresse").assertExists()
        text("Code senden").assertIsNotEnabled()
        rule.onAllNodes(hasText("Übersicht")).assertCountEquals0()
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun `Code-Schritt bleibt nach Drehen oder Prozess-Ende stehen`() = runAndroidComposeUiTest<ComponentActivity> {
        val tester = StateRestorationTester(this)
        tester.setContent { AccuraApp(graph, dynamicColor = false) }
        onNodeWithText("E-Mail-Adresse").performTextInput("test@example.test")
        onNodeWithText("Code senden").performClick()
        onNodeWithText("Anmelden").assertExists()

        tester.emulateSaveAndRestore()

        onNodeWithText("Anmelden").assertExists()
        check(onAllNodes(hasText("E-Mail-Adresse")).fetchSemanticsNodes().isEmpty()) { "Der erste Schritt ist wieder sichtbar" }
    }

    @Test
    fun `Anmelden mit E-Mail und Code führt zur Übersicht mit Daten`() {
        start()
        signIn()
        text("Wie viel ist auf deinen Konten?").assertExists()
        rule.onNode(hasClickAction() and hasText("Budget")).assertExists()
    }

    @Test
    fun `Ungültige E-Mail zeigt Fehler und bleibt auf der Anmeldung`() {
        start()
        text("E-Mail-Adresse").performTextInput("kaputt")
        text("Code senden").assertIsEnabled().performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Das ist keine gültige E-Mail-Adresse.")).fetchSemanticsNodes().isNotEmpty() }
        text("Code senden").assertExists()
    }

    @Test
    fun `Falscher Code zeigt Fehler und meldet nicht an`() {
        start()
        text("E-Mail-Adresse").performTextInput("test@example.test")
        text("Code senden").performClick()
        text("Code").performTextInput("111111")
        text("Anmelden").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Der Code stimmt nicht. Prüfe ihn oder fordere einen neuen an.")).fetchSemanticsNodes().isNotEmpty() }
        text("Code eingeben").assertExists()
    }

    @Test
    fun `Andere E-Mail-Adresse führt zurück zum ersten Schritt`() {
        start()
        text("E-Mail-Adresse").performTextInput("test@example.test")
        text("Code senden").performClick()
        text("Andere E-Mail-Adresse").performClick()
        text("E-Mail-Adresse").assertExists()
    }

    @Test
    fun `Alle vier Ansichten sind über die Leiste erreichbar`() {
        start()
        signIn()
        openTab("Demnächst")
        text("Wie viel kann ich bis zum Gehalt noch ausgeben?").assertExists()
        text("904,30 €").assertExists()
        openTab("Budget")
        text("Wie viel bleibt im Monat frei?").assertExists()
        openTab("Schulden")
        text("Wie hoch ist deine Restschuld?").assertExists()
        openTab("Übersicht")
        text("Wie viel ist auf deinen Konten?").assertExists()
    }

    @Test
    fun `So gerechnet klappt den Rechenweg auf`() {
        start()
        signIn()
        rule.onAllNodes(hasClickAction() and hasText("So gerechnet"))[0].performClick()
        text("Auf den Konten").assertExists()
    }

    @Test
    fun `Abmelden führt zur Anmeldung zurück, danach sind keine Daten mehr zu sehen`() {
        start()
        signIn()
        rule.onNodeWithContentDescription("Konto").performClick()
        text("Abmelden").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("E-Mail-Adresse")).fetchSemanticsNodes().isNotEmpty() }
        rule.onAllNodes(hasText("1.350,75 €")).assertCountEquals0()
        // und wieder anmelden
        signIn()
    }

    @Test
    fun `Debug-Menü schaltet das Szenario um und die Übersicht wird leer`() {
        start()
        signIn()
        rule.onNodeWithContentDescription("Konto").performClick()
        text("Entwicklung").performClick()
        text("Leer").performClick()
        rule.onNodeWithContentDescription("Zurück").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Noch nichts erfasst")).fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun `Debug-Menü schaltet die Variante der Übersicht um`() {
        start()
        signIn()
        rule.onNodeWithContentDescription("Konto").performClick()
        text("Entwicklung").performClick()
        text("Zeitleiste").performClick()
        rule.onNodeWithContentDescription("Zurück").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Was kommt auf dich zu?")).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithContentDescription("Konto").performClick()
        text("Entwicklung").performClick()
        text("Spielraum zuerst").performClick()
        rule.onNodeWithContentDescription("Zurück").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Wie viel kannst du bis zum Gehalt ausgeben?")).fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun `Testdaten wechseln schaltet auf der Übersicht zu alten Ständen`() {
        start()
        signIn()
        rule.onNodeWithContentDescription("Testdaten wechseln").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Einige Stände sind alt")).fetchSemanticsNodes().isNotEmpty() }
    }
}

private fun androidx.compose.ui.test.SemanticsNodeInteractionCollection.assertCountEquals0() =
    assertCountEquals(0)
