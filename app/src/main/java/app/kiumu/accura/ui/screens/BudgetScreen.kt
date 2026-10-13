package app.kiumu.accura.ui.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.BudgetStatus
import app.kiumu.accura.data.model.Necessity
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatWholePercent
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.HauptzahlKarte
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost

@Composable
fun BudgetScreen(state: ViewState<BudgetModel>, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = { Leerzustand(stringResource(R.string.budget_empty_title), stringResource(R.string.budget_empty_text)) },
    ) { model, banner -> BudgetContent(model, banner) }
}

@Composable
private fun BudgetContent(model: BudgetModel, banner: @Composable () -> Unit) {
    val today = model.today
    Ansicht(banner) {
        val overdrawn = model.status == BudgetStatus.OVERDRAWN
        HauptzahlKarte(
            question = stringResource(R.string.budget_main_question),
            metric = model.freeMonthly,
            today = today,
            tone = if (overdrawn) Tone.Attention else Tone.Free,
            supporting = model.deficitCents?.let { stringResource(R.string.budget_overdrawn_text, formatCents(it)) },
        )
        if (model.status == BudgetStatus.INCOME_MISSING) {
            HinweisKarte(stringResource(R.string.budget_income_missing_title), stringResource(R.string.budget_income_missing_text))
        }

        Abschnitt(stringResource(R.string.section_planned))
        model.incomeCents?.let { ListenZeile(stringResource(R.string.budget_income), amountCents = it) }
        ListenZeile(stringResource(R.string.split_expenses), amountCents = model.expensesCents)
        ListenZeile(stringResource(R.string.split_reserves), amountCents = model.reservesCents)
        ListenZeile(stringResource(R.string.split_rates), amountCents = model.ratesCents)
        HorizontalDivider()
        ListenZeile(
            title = stringResource(R.string.budget_planned_total),
            supporting = model.utilizationBps?.let { stringResource(R.string.budget_utilization, formatWholePercent(it)) },
            amountCents = model.plannedCents,
        )

        if (model.necessityGroups.isNotEmpty()) {
            Abschnitt(stringResource(R.string.section_by_necessity))
            model.necessityGroups.forEach { group ->
                ListenZeile(
                    title = stringResource(group.necessity.labelRes()),
                    supporting = group.shareBps?.let { formatWholePercent(it) },
                    amountCents = group.totalCents,
                )
                group.items.forEach { item ->
                    ListenZeile(
                        title = item.label,
                        modifier = Modifier.padding(start = 16.dp),
                        supporting = item.dueDay?.let { stringResource(R.string.budget_due_day, it) },
                        amountCents = item.monthlyAmountCents,
                    )
                }
                HorizontalDivider()
            }
        }

        if (model.categories.isNotEmpty()) {
            Abschnitt(stringResource(R.string.section_by_category))
            model.categories.forEach { category ->
                ListenZeile(
                    title = category.category,
                    supporting = category.shareBps?.let { formatWholePercent(it) },
                    amountCents = category.totalCents,
                )
            }
        }
    }
}

private fun Necessity.labelRes(): Int = when (this) {
    Necessity.ESSENTIAL -> R.string.necessity_essential
    Necessity.NECESSARY -> R.string.necessity_necessary
    Necessity.WORTHWHILE -> R.string.necessity_worthwhile
    Necessity.OPTIONAL -> R.string.necessity_optional
    Necessity.UNNECESSARY -> R.string.necessity_unnecessary
}
