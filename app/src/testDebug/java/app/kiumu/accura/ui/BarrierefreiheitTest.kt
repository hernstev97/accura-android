package app.kiumu.accura.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.screenshots.Aufnahme
import app.kiumu.accura.screenshots.uebersichtZustand
import app.kiumu.accura.ui.screens.OverviewScreen
import app.kiumu.accura.ui.screens.OverviewVariant
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Barrierefreiheit der Übersicht in jeder Variante und jedem Szenario mit Daten: Jedes Bedienelement
 * ist mindestens 48 × 48 dp groß und hat einen Namen; bei 200 % Schrift wird kein Text abgeschnitten
 * (Beträge schrumpfen oder brechen in eine eigene Zeile, statt abgeschnitten zu werden).
 * Der hohe Bildschirm sorgt dafür, dass alles einmal gemessen wird, auch unterhalb des Rands.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h3200dp-xhdpi")
class BarrierefreiheitTest(private val variante: OverviewVariant, private val szenario: DebugScenario) {
    @get:Rule
    val rule = createComposeRule()

    private fun zeigen(fontScale: Float) = rule.setContent {
        Aufnahme(fontScale = fontScale) { OverviewScreen(uebersichtZustand(szenario), onRetry = {}, variant = variante) }
    }

    private fun SemanticsNode.name(): String =
        (config.getOrNull(SemanticsProperties.ContentDescription).orEmpty() + config.getOrNull(SemanticsProperties.Text).orEmpty())
            .joinToString(" ")

    @Test
    fun `Bedienelemente sind mindestens 48 dp groß und haben einen Namen`() {
        zeigen(1f)
        val min = with(Density(RuntimeEnvironment.getApplication())) { 48.dp.toPx() } - 0.5f
        val nodes = rule.onAllNodes(hasClickAction()).fetchSemanticsNodes()
        assertTrue("keine Bedienelemente gefunden", nodes.isNotEmpty())
        nodes.forEach { node ->
            assertTrue("„${node.name()}“ ist ${node.size} px", node.size.height >= min && node.size.width >= min)
            assertTrue("Bedienelement ohne Namen", node.name().isNotBlank())
        }
    }

    @Test
    fun `Bei 200 Prozent Schrift wird kein Text abgeschnitten`() {
        zeigen(2f)
        val texts = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true)
            .fetchSemanticsNodes()
        assertTrue("keine Texte gefunden", texts.isNotEmpty())
        texts.forEach { node ->
            val layouts = mutableListOf<TextLayoutResult>()
            node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
            layouts.forEach { layout -> assertTrue(beschreibung(layout), !abgeschnitten(layout)) }
        }
    }

    @Test
    fun `Die Prüfung erkennt einen abgeschnittenen Betrag`() {
        rule.setContent {
            Aufnahme(fontScale = 2f) {
                Column { Box(Modifier.width(100.dp)) { Text("1.350,75 € 1.350,75 €", softWrap = false, maxLines = 1) } }
            }
        }
        val node = rule.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true).fetchSemanticsNode()
        val layouts = mutableListOf<TextLayoutResult>()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        assertTrue(beschreibung(layouts.single()) + " / Absatz ${layouts.single().multiParagraph.width}", abgeschnitten(layouts.single()))
    }

    /**
     * Gemessen wird, wo die Zeilen wirklich liegen. `hasVisualOverflow` meldet bei Texten mit
     * Zeichenabstand eine Überbreite, obwohl die Zeile in den Rahmen passt (im Bild geprüft).
     */
    private fun abgeschnitten(layout: TextLayoutResult): Boolean =
        layout.didOverflowHeight ||
            (0 until layout.lineCount).any { line -> layout.getLineRight(line) > layout.size.width + 1f || layout.getLineLeft(line) < -1f }

    private fun beschreibung(layout: TextLayoutResult) =
        "„${layout.layoutInput.text}“ ist abgeschnitten: Größe ${layout.size}, " +
            "Zeilen ${(0 until layout.lineCount).map { layout.getLineLeft(it) to layout.getLineRight(it) }}, Höhe über ${layout.didOverflowHeight}"

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0} {1}")
        fun parameter(): List<Array<Any>> {
            val szenarien = listOf(DebugScenario.STANDARD, DebugScenario.VERALTET, DebugScenario.NEGATIV, DebugScenario.OHNE_GEHALTSTAG)
            return OverviewVariant.entries.flatMap { v -> szenarien.map { s -> arrayOf<Any>(v, s) } }
        }
    }
}
