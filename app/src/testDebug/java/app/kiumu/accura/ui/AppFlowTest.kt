package app.kiumu.accura.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.StateRestorationTester
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.v2.runAndroidComposeUiTest
import app.kiumu.accura.AppGraph
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.DebugTools
import app.kiumu.accura.auth.FakeAuthGateway
import app.kiumu.accura.data.Vertrag
import app.kiumu.accura.data.fake.FakeFinanceRepository
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
    private val tools = object : DebugTools {
        override val scenario: StateFlow<DebugScenario> = this@AppFlowTest.scenario
        override fun select(scenario: DebugScenario) {
            this@AppFlowTest.scenario.value = scenario
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
        text("Hallo").assertExists()
        text("Dein August 2026 auf einen Blick.").assertExists()
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
        text("Dein Budget").assertExists()
        openTab("Schulden")
        text("Dein Weg auf null").assertExists()
        openTab("Übersicht")
        text("Hallo").assertExists()
    }

    @Test
    fun `Ein Tipp auf eine Kachel öffnet das Blatt mit Rechenweg`() {
        start()
        signIn()
        rule.onNode(hasClickAction() and hasText("Jetzt verfügbar")).performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("So gerechnet")).fetchSemanticsNodes().isNotEmpty() }
        // Steht nur im Rechenweg des Blatts, nicht auf der Übersicht.
        text("Art: eingetragen. Status: belastbar.").assertExists()
    }

    @Test
    fun `So gerechnet klappt den Rechenweg in der Hauptkarte auf`() {
        start()
        signIn()
        openTab("Demnächst")
        rule.onAllNodes(hasClickAction() and hasText("So gerechnet"))[0].performClick()
        text("Nächstes Gehalt").assertExists()
    }

    @Test
    fun `Stände aktualisieren zeigt im Prototyp einen Hinweis statt nichts`() {
        start()
        signIn()
        rule.onNode(hasClickAction() and hasText("Stände aktualisieren")).performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Eintragen kommt mit der Ersterfassung.")).fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun `Restschuldverlauf hat eine Beschreibung und eine Tabelle`() {
        start()
        signIn()
        openTab("Schulden")
        rule.onNode(hasContentDescription("Restschuld bei planmäßiger Zahlung", substring = true)).assertExists()
        rule.onNode(hasClickAction() and hasText("Werte als Tabelle")).performScrollTo().performClick()
        // „Januar 2027“ steht nur in der Tabelle.
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Januar 2027")).fetchSemanticsNodes().isNotEmpty() }
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
    fun `Testdaten wechseln schaltet auf der Übersicht zu alten Ständen`() {
        start()
        signIn()
        rule.onNodeWithContentDescription("Testdaten wechseln").performClick()
        rule.waitUntil(5_000) { rule.onAllNodes(hasText("Einige Stände sind alt")).fetchSemanticsNodes().isNotEmpty() }
    }
}

private fun androidx.compose.ui.test.SemanticsNodeInteractionCollection.assertCountEquals0() =
    assertCountEquals(0)
