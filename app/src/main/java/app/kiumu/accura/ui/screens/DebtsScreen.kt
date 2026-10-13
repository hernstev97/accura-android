package app.kiumu.accura.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.DebtState
import app.kiumu.accura.data.model.DebtView
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.ScheduleWarning
import app.kiumu.accura.ui.format.formatBps
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.format.formatSignedCents
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.DatenalterChip
import app.kiumu.accura.ui.katalog.HauptzahlKarte
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.Kennzahl
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.SoGerechnet
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost
import app.kiumu.accura.ui.katalog.metricDisplayValue
import java.time.LocalDate

@Composable
fun DebtsScreen(state: ViewState<DebtsModel>, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = { Leerzustand(stringResource(R.string.debts_empty_title), stringResource(R.string.debts_empty_text)) },
    ) { model, banner -> DebtsContent(model, banner) }
}

@Composable
private fun DebtsContent(model: DebtsModel, banner: @Composable () -> Unit) {
    val today = model.today
    Ansicht(banner) {
        HauptzahlKarte(
            question = stringResource(R.string.debts_main_question),
            metric = model.remaining,
            today = today,
            tone = Tone.Debt,
            supporting = model.debtFreeDay.day?.let { stringResource(R.string.debts_debt_free, formatMonth(java.time.YearMonth.from(it))) },
        )
        Kennzahl(stringResource(R.string.metric_payoff_max), model.payoffMax, today, tone = Tone.Debt)
        Kennzahl(stringResource(R.string.metric_interest_to_end), model.interestToEnd, today, tone = Tone.Debt)
        Kennzahl(stringResource(R.string.metric_extra_cost), model.extraCostVsPayoff, today, tone = Tone.Debt)

        Abschnitt(stringResource(R.string.section_debt_list))
        model.debts.forEach { debt -> DebtCard(debt, today) }

        if (model.relief.isNotEmpty()) {
            Abschnitt(stringResource(R.string.section_relief))
            model.relief.forEach { group ->
                ListenZeile(
                    title = stringResource(R.string.relief_from, formatMonth(group.freeFromMonth)),
                    supporting = group.events.joinToString { it.lender },
                    amountCents = group.monthlyReliefCents,
                )
            }
        }
    }
}

@Composable
private fun DebtCard(debt: DebtView, today: LocalDate) {
    OutlinedCard(modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(debt.lender, style = MaterialTheme.typography.titleMedium)
            Text(
                metricDisplayValue(debt.balance),
                style = MaterialTheme.typography.headlineSmall.copy(fontFeatureSettings = "tnum"),
                maxLines = 1,
                softWrap = false,
            )
            DatenalterChip(debt.balance, today)
            if (debt.state == DebtState.INVALID) {
                HinweisKarte(stringResource(R.string.debts_invalid_title), debt.issues.joinToString(" "))
            } else {
                debt.nextPayment?.let {
                    Text(stringResource(R.string.debts_next_payment, formatDay(it.day, today), formatCents(it.cents)))
                }
                debt.lastPaymentDay?.let { Text(stringResource(R.string.debts_last_payment, formatDay(it))) }
                Text(
                    stringResource(
                        R.string.debts_remaining,
                        pluralStringResource(R.plurals.payments_count, debt.remainingPaymentCount, debt.remainingPaymentCount),
                        formatCents(debt.remainingTotalCents),
                    ),
                )
                Text(stringResource(R.string.debts_rates, formatBps(debt.terms.nominalRateBps), formatBps(debt.terms.effectiveRateBps)))
                debt.deviation?.let {
                    Text(stringResource(R.string.debts_deviation, formatSignedCents(it.differenceCents), formatDay(it.day, today)))
                }
                debt.warnings.forEach { warning ->
                    HinweisKarte(stringResource(R.string.debts_warning_title), stringResource(warning.textRes()))
                }
            }
            SoGerechnet(debt.balance)
        }
    }
}

private fun ScheduleWarning.textRes(): Int = when (this) {
    ScheduleWarning.PAYMENT_BELOW_INTEREST -> R.string.warning_payment_below_interest
    ScheduleWarning.UNEXPECTED_RESIDUAL -> R.string.warning_unexpected_residual
    ScheduleWarning.FINAL_PAYMENT_FAR_FROM_RATE -> R.string.warning_final_payment_far
}
