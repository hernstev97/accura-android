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
import app.kiumu.accura.data.model.IncomePartKey
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.SalaryStatus
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.format.formatPercent
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.Anteil
import app.kiumu.accura.ui.katalog.Aufteilungsbalken
import app.kiumu.accura.ui.katalog.DatenalterChip
import app.kiumu.accura.ui.katalog.HauptzahlKarte
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.Kennzahl
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost

@Composable
fun OverviewScreen(state: ViewState<OverviewModel>, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = { Leerzustand(stringResource(R.string.overview_empty_title), stringResource(R.string.overview_empty_text)) },
    ) { model, banner -> OverviewContent(model, banner) }
}

@Composable
private fun OverviewContent(model: OverviewModel, banner: @Composable () -> Unit) {
    val today = model.today
    Ansicht(banner) {
        HauptzahlKarte(
            question = stringResource(R.string.overview_main_question),
            metric = model.accountsTotal,
            today = today,
            tone = Tone.Neutral,
            supporting = stringResource(R.string.overview_main_support),
        )
        if (model.dataAge.staleCount > 0) {
            HinweisKarte(
                title = stringResource(R.string.overview_stale_title),
                text = pluralStringResource(R.plurals.overview_stale_text, model.dataAge.staleCount, model.dataAge.staleCount),
            )
        }

        Abschnitt(stringResource(R.string.section_room))
        val salaryHint = salaryMissingHint(model.salaryStatus)
        Kennzahl(
            stringResource(R.string.metric_available_until_salary),
            model.availableUntilSalary,
            today,
            tone = Tone.Free,
            missingHint = salaryHint,
        )
        Kennzahl(stringResource(R.string.metric_daily_allowance), model.dailyAllowance, today, tone = Tone.Free, missingHint = salaryHint)
        Kennzahl(stringResource(R.string.metric_free_monthly), model.freeMonthly, today, tone = Tone.Free)
        Kennzahl(stringResource(R.string.metric_buffer), model.bufferMonths, today, tone = Tone.Reserve)

        model.incomeSplit?.let { split ->
            Abschnitt(stringResource(R.string.section_income_split))
            Aufteilungsbalken(
                parts = split.parts.map { part ->
                    Anteil(
                        label = stringResource(part.key.labelRes()),
                        cents = part.cents,
                        shareText = part.sharePercent?.let(::formatPercent),
                        tone = part.key.tone(),
                    )
                },
            )
        }

        model.nextRelief?.let { relief ->
            OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.relief_title), style = MaterialTheme.typography.titleSmall)
                    Text(
                        stringResource(R.string.relief_text, formatMonth(relief.freeFromMonth), formatCents(relief.monthlyReliefCents)),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    relief.freeAfterCents?.let {
                        Text(stringResource(R.string.relief_free_after, formatCents(it)), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        Abschnitt(stringResource(R.string.section_debts))
        Kennzahl(stringResource(R.string.metric_debt_remaining), model.debtRemaining, today, tone = Tone.Debt)
        Kennzahl(stringResource(R.string.metric_debt_free), model.debtFreeDay, today, tone = Tone.Debt)
        Kennzahl(stringResource(R.string.metric_net_worth), model.netWorth, today)

        Abschnitt(stringResource(R.string.section_accounts))
        model.accounts.forEach { account ->
            ListenZeile(
                title = account.name,
                amountCents = account.stand?.cents,
                supporting = if (account.stand == null) stringResource(R.string.account_no_stand) else null,
                trailing = account.stand?.let { stand ->
                    { DatenalterChip(stand.day, stand.ageDays, stand.stale, today, Modifier.padding(top = 4.dp)) }
                },
            )
        }
        if (model.pockets.isNotEmpty()) {
            Abschnitt(stringResource(R.string.section_pockets))
            Text(
                stringResource(R.string.pockets_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            model.pockets.forEach { pocket ->
                ListenZeile(
                    title = pocket.name,
                    amountCents = pocket.stand?.cents,
                    supporting = if (pocket.stand == null) stringResource(R.string.account_no_stand) else null,
                )
            }
        }
    }
}

/** „Gehaltstag eintragen“ statt einer Zahl, solange der Gehaltstag fehlt. */
@Composable
fun salaryMissingHint(status: SalaryStatus): String? = when (status) {
    SalaryStatus.SET -> null
    SalaryStatus.MISSING -> stringResource(R.string.salary_missing_value)
}

private fun IncomePartKey.labelRes(): Int = when (this) {
    IncomePartKey.EXPENSES -> R.string.split_expenses
    IncomePartKey.RATES -> R.string.split_rates
    IncomePartKey.RESERVES -> R.string.split_reserves
    IncomePartKey.FREE -> R.string.split_free
}

private fun IncomePartKey.tone(): Tone = when (this) {
    IncomePartKey.EXPENSES -> Tone.Neutral
    IncomePartKey.RATES -> Tone.Debt
    IncomePartKey.RESERVES -> Tone.Reserve
    IncomePartKey.FREE -> Tone.Free
}

private fun Modifier.fillMaxWidth(): Modifier = this.then(Modifier.fillMaxWidth())
