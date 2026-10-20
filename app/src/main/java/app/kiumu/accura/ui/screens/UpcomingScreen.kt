package app.kiumu.accura.ui.screens

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.PaymentSource
import app.kiumu.accura.data.model.SalaryStatus
import app.kiumu.accura.data.model.UpcomingModel
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.HauptzahlKarte
import app.kiumu.accura.ui.katalog.Kennzahl
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Marke
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost

@Composable
fun UpcomingScreen(state: ViewState<UpcomingModel>, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = { Leerzustand(stringResource(R.string.upcoming_empty_title), stringResource(R.string.upcoming_empty_text)) },
    ) { model, banner -> UpcomingContent(model, banner) }
}

@Composable
private fun UpcomingContent(model: UpcomingModel, banner: @Composable () -> Unit) {
    val today = model.today
    val salaryDay = model.nextSalaryDay
    val days = model.daysUntilSalary
    val salaryHint = salaryMissingHint(model.salaryStatus)
    Ansicht(banner) {
        HauptzahlKarte(
            question = stringResource(R.string.upcoming_main_question),
            metric = model.availableUntilSalary,
            today = today,
            // Ohne Gehaltstag gibt es kein freies Geld bis Gehalt: keine Farbe „Frei“.
            tone = if (model.salaryStatus == SalaryStatus.MISSING) Tone.Neutral else Tone.Free,
            missingHint = salaryHint,
            supporting = if (salaryDay != null && days != null) {
                stringResource(R.string.upcoming_salary, formatDay(salaryDay, today), pluralStringResource(R.plurals.days_in, days, days))
            } else {
                null
            },
        )
        Kennzahl(stringResource(R.string.metric_daily_allowance), model.dailyAllowance, today, tone = Tone.Free, missingHint = salaryHint)
        Kennzahl(stringResource(R.string.metric_pending), model.pendingPayments, today, missingHint = salaryHint)

        Abschnitt(stringResource(R.string.section_payments_until_salary))
        if (model.salaryStatus == SalaryStatus.MISSING) {
            Leerzustand(stringResource(R.string.upcoming_no_salary_title), stringResource(R.string.upcoming_no_salary_text))
        } else if (model.payments.isEmpty()) {
            Text(stringResource(R.string.upcoming_no_payments), style = MaterialTheme.typography.bodyMedium)
        } else {
            model.payments.forEach { payment ->
                val whenText = stringResource(
                    R.string.upcoming_due,
                    formatDay(payment.dueDay, today),
                    pluralStringResource(R.plurals.days_in_or_today, payment.daysUntilDue, payment.daysUntilDue),
                )
                val sourceText = stringResource(if (payment.source == PaymentSource.DEBT) R.string.source_debt else R.string.source_budget)
                ListenZeile(
                    title = payment.name,
                    supporting = "$whenText · $sourceText",
                    amountCents = payment.cents,
                    trailing = if (payment.isShortlyBeforeSalary) {
                        { Marke(stringResource(R.string.upcoming_shortly_before_salary)) }
                    } else {
                        null
                    },
                )
            }
        }
    }
}
