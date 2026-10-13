package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import app.kiumu.accura.ui.format.formatCents

/** Tabellarische Ziffern: Beträge untereinander stehen bündig. */
private fun TextStyle.tabular(): TextStyle = copy(fontFeatureSettings = "tnum")

/**
 * Ein Betrag in einer Zeile. Er bricht nie um, sein Euro-Zeichen hängt per geschütztem Leerzeichen an
 * der Zahl. Mit [autoShrink] wird er kleiner statt abgeschnitten, wenn die Breite nicht reicht
 * (große Schrift, schmale Spalte); dafür braucht er eine begrenzte Breite.
 */
@Composable
fun Betrag(
    cents: Long,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight? = null,
    textAlign: TextAlign? = null,
    autoShrink: Boolean = false,
) {
    Text(
        text = formatCents(cents),
        modifier = modifier,
        style = style.tabular(),
        color = color,
        fontWeight = fontWeight,
        textAlign = textAlign,
        softWrap = false,
        maxLines = 1,
        autoSize = if (autoShrink) TextAutoSize.StepBased(minFontSize = MinSize, maxFontSize = style.fontSize, stepSize = 1.sp) else null,
    )
}

/**
 * Die große Zahl einer Ansicht. Sie schrumpft bis [MinSize], statt abgeschnitten zu werden, wenn die
 * Schrift groß eingestellt ist.
 */
@Composable
fun BetragGross(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    style: TextStyle = MaterialTheme.typography.displayMedium,
) {
    Text(
        text = text,
        modifier = modifier,
        style = style.tabular(),
        color = color,
        softWrap = false,
        maxLines = 1,
        autoSize = TextAutoSize.StepBased(minFontSize = MinSize, maxFontSize = style.fontSize, stepSize = 1.sp),
    )
}

private val MinSize = 12.sp
