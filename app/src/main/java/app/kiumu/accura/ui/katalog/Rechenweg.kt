package app.kiumu.accura.ui.katalog

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricKind
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.data.model.Step
import app.kiumu.accura.data.model.StepOp
import app.kiumu.accura.ui.format.formatBps
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.theme.AccuraTheme

/** Aufklappen mit der Bewegung des Expressive-Schemas; ohne Animationen sofort da. */
@Composable
fun aufklappen(): EnterTransition =
    if (AccuraTheme.reduceMotion) {
        EnterTransition.None
    } else {
        expandVertically(MaterialTheme.motionScheme.defaultSpatialSpec()) + fadeIn(MaterialTheme.motionScheme.defaultEffectsSpec())
    }

/** Zuklappen, Gegenstück zu [aufklappen]. */
@Composable
fun zuklappen(): ExitTransition =
    if (AccuraTheme.reduceMotion) {
        ExitTransition.None
    } else {
        shrinkVertically(MaterialTheme.motionScheme.fastSpatialSpec()) + fadeOut(MaterialTheme.motionScheme.fastEffectsSpec())
    }

@Composable
fun metricKindText(kind: MetricKind): String = stringResource(
    when (kind) {
        MetricKind.ACTUAL -> R.string.kind_actual
        MetricKind.PLANNED -> R.string.kind_planned
        MetricKind.ESTIMATED -> R.string.kind_estimated
        MetricKind.CALCULATED -> R.string.kind_calculated
    },
)

@Composable
fun metricStatusText(status: MetricStatus): String = stringResource(
    when (status) {
        MetricStatus.OK -> R.string.status_ok
        MetricStatus.STALE -> R.string.status_stale
        MetricStatus.UNAVAILABLE -> R.string.status_unavailable
    },
)

/** Schalter „So gerechnet“: klappt den Rechenweg einer Kennzahl auf. Zustand überlebt Drehen. */
@Composable
fun SoGerechnet(metric: Metric, modifier: Modifier = Modifier) {
    var expanded by rememberSaveable(metric.key) { mutableStateOf(false) }
    val stateText = stringResource(if (expanded) R.string.state_expanded else R.string.state_collapsed)
    Column(modifier = modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button, onClickLabel = stringResource(R.string.how_calculated_action)) { expanded = !expanded }
                .semantics { stateDescription = stateText },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(stringResource(R.string.how_calculated), style = MaterialTheme.typography.labelLarge)
            Icon(if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null)
        }
        AnimatedVisibility(visible = expanded, enter = aufklappen(), exit = zuklappen()) { Rechenweg(metric) }
    }
}

/** Rechenweg einer Kennzahl: Schritte, Art, Status, ältester Stand. */
@Composable
fun Rechenweg(metric: Metric, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        metric.reason?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        metric.steps.forEach { step ->
            if (step.op == StepOp.RESULT) HorizontalDivider()
            StepRow(step)
        }
        Text(
            stringResource(R.string.how_kind_status, metricKindText(metric.kind), metricStatusText(metric.status)),
            style = MaterialTheme.typography.bodySmall,
        )
        metric.oldestDataDay?.let {
            Text(stringResource(R.string.how_oldest, formatDay(it)), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun StepRow(step: Step) {
    val bold = if (step.op == StepOp.RESULT || step.op == StepOp.START) FontWeight.SemiBold else FontWeight.Normal
    val value = stepValue(step)
    val prefix = when (step.op) {
        StepOp.PLUS -> "+ "
        StepOp.MINUS -> "− "
        else -> ""
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Text(step.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, fontWeight = bold)
        if (value != null) {
            Text(
                prefix + value,
                modifier = Modifier.padding(start = 4.dp),
                style = MaterialTheme.typography.bodyMedium.copy(fontFeatureSettings = "tnum"),
                fontWeight = bold,
                softWrap = false,
                maxLines = 1,
            )
        }
    }
}

private fun stepValue(step: Step): String? = when {
    step.cents != null -> formatCents(if (step.op == StepOp.MINUS) kotlin.math.abs(step.cents) else step.cents)
    step.bps != null -> formatBps(step.bps)
    step.count != null -> step.count.toString()
    step.day != null -> formatDay(step.day)
    else -> null
}
