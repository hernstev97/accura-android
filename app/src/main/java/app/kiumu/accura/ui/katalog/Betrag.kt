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

/** Ein Betrag in einer Zeile. Er bricht nie um, sein Euro-Zeichen hängt per geschütztem Leerzeichen an der Zahl. */
@Composable
fun Betrag(
    cents: Long,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight? = null,
    textAlign: TextAlign? = null,
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
    )
}

/**
 * Die große Zahl einer Ansicht. Sie schrumpft bis [MinSize], statt abgeschnitten zu werden, wenn die
 * Schrift groß eingestellt ist.
 */
@Composable
fun BetragGross(text: String, modifier: Modifier = Modifier, color: Color = Color.Unspecified) {
    Text(
        text = text,
        modifier = modifier,
        style = MaterialTheme.typography.displayMedium.tabular(),
        fontWeight = FontWeight.SemiBold,
        color = color,
        softWrap = false,
        maxLines = 1,
        autoSize = TextAutoSize.StepBased(minFontSize = MinSize, maxFontSize = 44.sp, stepSize = 1.sp),
    )
}

private val MinSize = 16.sp
