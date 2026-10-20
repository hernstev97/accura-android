package app.kiumu.accura.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.Hyphens
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.kiumu.accura.R

/**
 * Google Sans Flex (OFL, Lizenz unter `assets/lizenzen/`), lokal eingebunden, keine Downloadable Fonts.
 * Die Datei ist eine variable Schrift mit der Achse `wght`; jedes Gewicht setzt die Achse ausdrücklich.
 */
private fun flex(weight: FontWeight) = Font(
    resId = R.font.google_sans_flex,
    weight = weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
)

val GoogleSansFlex = FontFamily(
    flex(FontWeight.Normal),
    flex(FontWeight.Medium),
    flex(FontWeight.SemiBold),
    flex(FontWeight.Bold),
)

/**
 * Alle Texte der App sind deutsch. Silbentrennung nach deutschen Regeln verhindert, dass lange Wörter
 * bei großer Schrift mitten im Wort ohne Trennstrich umbrechen („Restsch uld“), auch wenn das Gerät auf
 * eine andere Sprache eingestellt ist.
 */
private val Deutsch = LocaleList("de-DE")

private fun style(size: Int, lineHeight: Int, weight: FontWeight, tracking: Double = 0.0) = TextStyle(
    fontFamily = GoogleSansFlex,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    letterSpacing = tracking.em,
    localeList = Deutsch,
    hyphens = Hyphens.Auto,
    lineBreak = LineBreak.Paragraph,
)

/**
 * Typografie-Skala nach dem Design-Leitfaden, übertragen auf die Rollen von Material 3:
 *
 * | Leitfaden (Dummy, 100 %) | Rolle | Größe |
 * | --- | --- | --- |
 * | Hauptzahl bis 44 px | displayMedium | 44 sp, halbfett |
 * | Thema 24 px | headlineSmall | 24 sp |
 * | Ansichtstitel 22 px | titleLarge | 22 sp |
 * | Abschnitt 18 px | titleMedium | 18 sp |
 * | Text 16 px | bodyLarge, titleSmall (Namen von Kennzahlen) | 16 sp |
 * | Zusatz 14 px | bodyMedium | 14 sp |
 * | Chip 13 px | labelMedium, bodySmall | 13 sp |
 *
 * Die übrigen Rollen behalten die Größen von Material 3. Alle Größen in sp: Sie wachsen mit der
 * Schriftgröße des Systems bis 200 %.
 */
val AccuraTypography = Typography(
    displayLarge = style(57, 64, FontWeight.Normal, -0.0044),
    displayMedium = style(44, 52, FontWeight.SemiBold),
    displaySmall = style(36, 44, FontWeight.Medium),
    headlineLarge = style(32, 40, FontWeight.Normal),
    headlineMedium = style(28, 36, FontWeight.Normal),
    headlineSmall = style(24, 32, FontWeight.Medium),
    titleLarge = style(22, 28, FontWeight.Medium),
    titleMedium = style(18, 26, FontWeight.Medium),
    titleSmall = style(16, 24, FontWeight.Medium),
    bodyLarge = style(16, 24, FontWeight.Normal, 0.03),
    bodyMedium = style(14, 20, FontWeight.Normal, 0.018),
    bodySmall = style(13, 18, FontWeight.Normal, 0.03),
    labelLarge = style(14, 20, FontWeight.Medium, 0.007),
    labelMedium = style(13, 18, FontWeight.Medium, 0.03),
    labelSmall = style(12, 16, FontWeight.Medium, 0.04),
)
