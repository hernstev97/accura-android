@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3ExpressiveApi::class, ExperimentalLayoutApi::class)

package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.ui.theme.Raster
import java.time.LocalDate

/*
 * Kachelsystem (Prototyp Runde 2, nach Google Health): Jede Fläche ist eine Kachel mit Radius 24 dp.
 * Gedämpft (Fläche „surfaceContainer“) für alles, kräftig (Fläche der Farbrolle) für den einen Fokus
 * eines Abschnitts. Eine Zahl tippt man an, um Datenalter, Art und „So gerechnet“ im Blatt zu sehen.
 */

/** Fläche einer Kachel: gedämpft für den Rest, kräftig (Fläche der Farbrolle) für den Fokus. */
@Composable
fun Tone.kachelFlaeche(betont: Boolean): Color = if (betont) colors().container else MaterialTheme.colorScheme.surfaceContainer

/** Text auf einer Kachel. */
@Composable
fun Tone.kachelText(betont: Boolean): Color = if (betont) colors().onContainer else MaterialTheme.colorScheme.onSurface

/** Zusatztext auf einer Kachel: auf gedämpfter Fläche etwas leiser, auf kräftiger die Textfarbe der Rolle. */
@Composable
fun Tone.kachelZusatz(betont: Boolean): Color = if (betont) colors().onContainer else MaterialTheme.colorScheme.onSurfaceVariant

/**
 * Kachel: Fläche mit Radius 24 dp, gedämpft oder kräftig ([betont]). Mit [onClick] ist die ganze
 * Kachel ein Ziel ab 48 dp.
 */
@Composable
fun Kachel(
    modifier: Modifier = Modifier,
    tone: Tone = Tone.Neutral,
    betont: Boolean = false,
    innen: Dp = Raster.Rand,
    onClick: (() -> Unit)? = null,
    onClickLabel: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val click = if (onClick != null) {
        Modifier.clickable(role = Role.Button, onClickLabel = onClickLabel, onClick = onClick)
    } else {
        Modifier
    }
    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.large,
        color = tone.kachelFlaeche(betont),
        contentColor = tone.kachelText(betont),
    ) {
        Column(
            modifier = Modifier.then(click).heightIn(min = 48.dp).padding(innen),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            content = content,
        )
    }
}

/**
 * Wert-Kachel nach dem Raster „Die wichtigsten Messwerte“: Name, Wert groß, ein Satz dazu, darunter
 * der Platz für einen kleinen Verlauf. Verläufe gibt es erst mit mehreren Ständen; bis dahin steht dort
 * ehrlich „Noch kein Verlauf“. Ist der Wert alt oder nicht berechenbar, steht das als Chip daneben.
 * Ein Tipp öffnet das Blatt mit Datenalter, Art und „So gerechnet“.
 */
@Composable
fun WertKachel(
    title: String,
    metric: Metric,
    today: LocalDate,
    modifier: Modifier = Modifier,
    tone: Tone = Tone.Neutral,
    betont: Boolean = false,
    supporting: String? = null,
    missingHint: String? = null,
) {
    var offen by rememberSaveable(metric.key) { mutableStateOf(false) }
    val hint = missingHintFor(metric, missingHint)
    val zusatz = tone.kachelZusatz(betont)
    Kachel(
        modifier = modifier,
        tone = tone,
        betont = betont,
        onClick = { offen = true },
        onClickLabel = stringResource(R.string.how_calculated_open),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Eng), verticalAlignment = Alignment.CenterVertically) {
            if (!betont) RollenPunkt(tone)
            Text(title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
        }
        if (hint != null) {
            Text(hint, style = MaterialTheme.typography.titleMedium, color = zusatz)
        } else {
            Text(
                metricDisplayValue(metric),
                style = MaterialTheme.typography.headlineSmall.copy(fontFeatureSettings = "tnum"),
                maxLines = 1,
                softWrap = false,
                autoSize = TextAutoSize.StepBased(minFontSize = 12.sp, maxFontSize = MaterialTheme.typography.headlineSmall.fontSize),
            )
        }
        supporting?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = zusatz) }
        Spacer(Modifier.weight(1f))
        FlowRow(
            modifier = Modifier.padding(top = Raster.Eng),
            horizontalArrangement = Arrangement.spacedBy(Raster.Eng),
            verticalArrangement = Arrangement.spacedBy(Raster.Eng),
        ) {
            when (metric.status) {
                MetricStatus.UNAVAILABLE -> NichtBerechenbarChip()
                MetricStatus.STALE -> {
                    DatenalterChip(metric, today)
                    KeinVerlaufChip()
                }
                MetricStatus.OK -> KeinVerlaufChip()
            }
        }
    }
    if (offen) KennzahlBlatt(title, metric, today, onDismiss = { offen = false }, supporting = supporting, missingHint = missingHint)
}

/** Kleiner Punkt in der Akzentfarbe einer Rolle, vor dem Namen einer gedämpften Kachel. */
@Composable
fun RollenPunkt(tone: Tone, modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(10.dp).clip(CircleShape).background(tone.colors().accent))
}

/**
 * Platzhalter für einen Verlauf, nach dem Chip „Keine Daten“ aus Google Health: leise gefüllt, ohne
 * Rand. Steht, solange es nur einen Stand gibt; accura erfindet keine Linie.
 */
@Composable
fun KeinVerlaufChip(modifier: Modifier = Modifier) {
    val farbe = LocalContentColor.current
    Text(
        text = stringResource(R.string.chip_no_history),
        style = MaterialTheme.typography.labelMedium,
        color = farbe,
        modifier = modifier
            .clip(CircleShape)
            .background(farbe.copy(alpha = 0.08f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/**
 * Kacheln im Raster: zwei Spalten, ab 130 % Schrift eine Spalte, damit kein Betrag schrumpfen oder
 * brechen muss. Kacheln einer Zeile sind gleich hoch.
 */
@Composable
fun KachelRaster(items: List<@Composable (Modifier) -> Unit>, modifier: Modifier = Modifier, spalten: Int = 2) {
    val columns = if (LocalDensity.current.fontScale >= StackedFontScale) 1 else spalten
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Raster.Luecke)) {
        items.chunked(columns).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Max),
                horizontalArrangement = Arrangement.spacedBy(Raster.Luecke),
            ) {
                row.forEach { item -> item(Modifier.weight(1f).fillMaxHeight()) }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * Pillen-Knopf für die Hauptaktion einer Ansicht (Google Health: „Eintragen“, „Starten“): 56 dp hoch,
 * ganz rund, Fläche „primaryContainer“. Beim Drücken wird die Form etwas eckiger (Material 3 Expressive).
 */
@Composable
fun PillenKnopf(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    val hoehe = ButtonDefaults.MediumContainerHeight
    Button(
        onClick = onClick,
        shapes = ButtonDefaults.shapesFor(hoehe),
        modifier = modifier.heightIn(min = hoehe),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        ),
        contentPadding = ButtonDefaults.contentPaddingFor(hoehe),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(ButtonDefaults.iconSizeFor(hoehe)))
            Spacer(Modifier.width(ButtonDefaults.iconSpacingFor(hoehe)))
        }
        Text(text, style = ButtonDefaults.textStyleFor(hoehe))
    }
}

/**
 * Unteres Blatt für Einzelheiten zu einer Zahl oder einem Posten. Schließt mit Wischen, Zurück oder
 * Tipp daneben; der Griff oben ist für TalkBack ein eigenes Ziel.
 */
@Composable
fun Blatt(titel: String, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = Raster.Rand, end = Raster.Rand, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(Raster.Eng),
        ) {
            Text(titel, style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
            content()
        }
    }
}

/** Blatt zu einer Kennzahl: Wert, Zustand (Datenalter, Art) und „So gerechnet“. */
@Composable
fun KennzahlBlatt(
    title: String,
    metric: Metric,
    today: LocalDate,
    onDismiss: () -> Unit,
    supporting: String? = null,
    missingHint: String? = null,
) {
    Blatt(titel = title, onDismiss = onDismiss) {
        val hint = missingHintFor(metric, missingHint)
        if (hint != null) {
            Text(hint, style = MaterialTheme.typography.headlineSmall)
        } else {
            BetragGross(metricDisplayValue(metric), style = MaterialTheme.typography.displaySmall)
        }
        supporting?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        ZustandsChips(metric, today)
        Text(
            stringResource(R.string.how_calculated),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = Raster.Eng).semantics { heading() },
        )
        Rechenweg(metric)
    }
}
