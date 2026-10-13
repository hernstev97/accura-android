package app.kiumu.accura.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.model.MetricStatus
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.FrischeZeichen
import app.kiumu.accura.ui.katalog.HauptzahlKarte
import app.kiumu.accura.ui.katalog.Kennzahl
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.aufklappen
import app.kiumu.accura.ui.katalog.zuklappen

/**
 * Variante „Kontostand zuerst“: Antwort auf „Wie viel ist auf deinen Konten?“, darunter drei
 * Kennzahlen, der nächste Spielraum, Konten und Pockets; alles Weitere unter „Alle Kennzahlen“.
 * Expressive-Höhepunkt: das Frische-Zeichen neben der Hauptzahl (Form zeigt frisch oder alt).
 */
@Composable
internal fun UebersichtKontostand(model: OverviewModel, banner: @Composable () -> Unit) {
    val today = model.today
    val salaryHint = salaryMissingHint(model.salaryStatus)
    Ansicht(banner) {
        val total = model.accountsTotal
        HauptzahlKarte(
            question = stringResource(R.string.overview_main_question),
            metric = total,
            today = today,
            tone = Tone.Neutral,
            supporting = stringResource(R.string.overview_main_support),
            zeichen = if (total.oldestDataDay != null) {
                { FrischeZeichen(stale = total.status == MetricStatus.STALE) }
            } else {
                null
            },
        )
        AlteStaendeHinweis(model)

        Abschnitt(stringResource(R.string.section_glance))
        Kennzahl(
            stringResource(R.string.metric_available_until_salary),
            model.availableUntilSalary,
            today,
            tone = Tone.Free,
            supporting = stringResource(R.string.desc_available_until_salary),
            missingHint = salaryHint,
        )
        Kennzahl(
            stringResource(R.string.metric_free_monthly),
            model.freeMonthly,
            today,
            tone = Tone.Free,
            supporting = stringResource(R.string.desc_free_monthly),
        )
        Kennzahl(
            stringResource(R.string.metric_buffer),
            model.bufferMonths,
            today,
            tone = Tone.Reserve,
            supporting = stringResource(R.string.desc_buffer),
        )
        model.nextRelief?.let { NaechsterSpielraumKarte(it) }

        KontenUndPockets(model)

        AlleKennzahlen {
            Kennzahl(
                stringResource(R.string.metric_daily_allowance),
                model.dailyAllowance,
                today,
                tone = Tone.Free,
                supporting = stringResource(R.string.desc_daily_allowance),
                missingHint = salaryHint,
            )
            Kennzahl(stringResource(R.string.metric_net_worth), model.netWorth, today, supporting = stringResource(R.string.desc_net_worth))
            Kennzahl(
                stringResource(R.string.metric_debt_remaining),
                model.debtRemaining,
                today,
                tone = Tone.Debt,
                supporting = stringResource(R.string.desc_debt_remaining),
            )
            Kennzahl(
                stringResource(R.string.metric_debt_free),
                model.debtFreeDay,
                today,
                tone = Tone.Debt,
                supporting = stringResource(R.string.desc_debt_free),
            )
            model.incomeSplit?.let { EinkommensAufteilung(it) }
        }
    }
}

/** „Alle Kennzahlen“: was nicht groß stehen muss, liegt bereit (Leitfaden, Regel 3). */
@Composable
private fun AlleKennzahlen(content: @Composable () -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val stateText = stringResource(if (expanded) R.string.state_expanded else R.string.state_collapsed)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClickLabel = stringResource(R.string.all_metrics_action)) { expanded = !expanded }
            .semantics {
                stateDescription = stateText
                heading()
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(stringResource(R.string.all_metrics), style = MaterialTheme.typography.titleMedium)
        Icon(if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null)
    }
    AnimatedVisibility(visible = expanded, enter = aufklappen(), exit = zuklappen()) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}
