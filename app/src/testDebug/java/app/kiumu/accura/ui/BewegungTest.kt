package app.kiumu.accura.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.unit.dp
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.katalog.ZahlMitRichtung
import app.kiumu.accura.ui.theme.AccuraTheme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * „Animationen entfernen“: Zahlwechsel ohne Übergang. Mit Animationen sind kurz alte und neue Zahl zu
 * sehen (die neue gleitet herein), danach nur noch die neue.
 */
@RunWith(RobolectricTestRunner::class)
class BewegungTest {
    @get:Rule
    val rule = createComposeRule()

    private var wert by mutableLongStateOf(90_430L)
    private val alt = formatCents(90_430L)
    private val neu = formatCents(69_429L)

    private fun sichtbar(text: String) = rule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()

    /** Zeigt die Zahl, ändert sie und liefert, ob im ersten Bild mit der neuen Zahl die alte noch da ist. */
    private fun wechseln(reduceMotion: Boolean): Boolean {
        rule.mainClock.autoAdvance = false
        rule.setContent {
            AccuraTheme(dynamicColor = false, reduceMotion = reduceMotion) {
                Box(Modifier.width(320.dp)) { ZahlMitRichtung(wert, formatCents(wert)) }
            }
        }
        rule.mainClock.advanceTimeBy(100)
        rule.runOnUiThread { wert = 69_429L }
        repeat(30) {
            rule.mainClock.advanceTimeByFrame()
            if (sichtbar(neu)) return sichtbar(alt)
        }
        fail("Die neue Zahl erscheint nicht")
        return false
    }

    @Test
    fun `Ohne Animationen steht die neue Zahl sofort allein da`() {
        assertFalse("Die alte Zahl ist noch zu sehen", wechseln(reduceMotion = true))
    }

    @Test
    fun `Mit Animationen gleiten alte und neue Zahl kurz gemeinsam`() {
        assertTrue("Kein Übergang zu sehen", wechseln(reduceMotion = false))
        rule.mainClock.advanceTimeBy(2_000)
        rule.onAllNodesWithText(alt).assertCountEquals(0)
    }
}
