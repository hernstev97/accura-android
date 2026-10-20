package app.kiumu.accura.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
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
import app.kiumu.accura.data.model.UpcomingPayment
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.format.formatMetricNumber
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.Betrag
import app.kiumu.accura.ui.katalog.GruppenZeileInnen
import app.kiumu.accura.ui.katalog.HauptzahlKarte
import app.kiumu.accura.ui.katalog.KachelRaster
import app.kiumu.accura.ui.katalog.Kopfzeile
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Listengruppe
import app.kiumu.accura.ui.katalog.Marke
import app.kiumu.accura.ui.katalog.Punkt
import app.kiumu.accura.ui.katalog.Station
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost
import app.kiumu.accura.ui.katalog.WertKachel
import java.time.LocalDate

/**
 * Demnächst: was bis zum Gehalt verfügbar ist (Hauptkarte), zwei Kacheln und darunter „Was kommt“ als
 * Zeitleiste von heute über die fälligen Zahlungen bis zum Gehalt. Zahlungen am selben Tag stehen in
 * einer Listengruppe. Ohne Gehaltstag gibt es keinen Zeitraum und keine erfundene Zahl.
 */
@Composable
fun UpcomingScreen(
    state: ViewState<UpcomingModel>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onGehaltstagEintragen: () -> Unit = {},
) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = { Leerzustand(stringResource(R.string.upcoming_empty_title), stringResource(R.string.upcoming_empty_text)) },
    ) { model, banner -> UpcomingContent(model, banner, onGehaltstagEintragen) }
}

@Composable
private fun UpcomingContent(model: UpcomingModel, banner: @Composable () -> Unit, onGehaltstagEintragen: () -> Unit) {
    val today = model.today
    val salaryDay = model.nextSalaryDay
    val days = model.daysUntilSalary
    val salaryHint = salaryMissingHint(model.salaryStatus)
    val verfuegbar = model.availableUntilSalary
    Ansicht(banner) {
        Kopfzeile(
            titel = stringResource(R.string.upcoming_title),
            untertitel = if (salaryDay != null && days != null) {
                stringResource(R.string.upcoming_salary, formatDay(salaryDay, today), pluralStringResource(R.plurals.days_in, days, days))
            } else {
                stringResource(R.string.upcoming_no_salary_title)
            },
        )
        HauptzahlKarte(
            question = stringResource(R.string.upcoming_main_question),
            metric = verfuegbar,
            today = today,
            tone = when {
                // Ohne Gehaltstag gibt es kein freies Geld bis Gehalt: keine Farbe „Frei“.
                model.salaryStatus == SalaryStatus.MISSING -> Tone.Neutral
                (verfuegbar.value ?: 0L) < 0L -> Tone.Attention
                else -> Tone.Free
            },
            missingHint = salaryHint,
            supporting = formatMetricNumber(model.dailyAllowance)?.let { stringResource(R.string.upcoming_daily, it) },
        )
        KachelRaster(
            listOf(
                { mod ->
                    WertKachel(
                        stringResource(R.string.tile_accounts),
                        model.accountsTotal,
                        today,
                        mod,
                        tone = Tone.Neutral,
                    )
                },
                { mod ->
                    WertKachel(
                        stringResource(R.string.metric_pending),
                        model.pendingPayments,
                        today,
                        mod,
                        tone = Tone.Debt,
                        missingHint = salaryHint,
                    )
                },
            ),
        )

        Abschnitt(stringResource(R.string.section_whats_next))
        if (model.salaryStatus == SalaryStatus.MISSING || salaryDay == null) {
            Leerzustand(
                stringResource(R.string.upcoming_no_salary_title),
                stringResource(R.string.upcoming_no_salary_text),
                aktion = stringResource(R.string.salary_missing_value),
                onAktion = onGehaltstagEintragen,
            )
        } else {
            WasKommt(model, salaryDay)
        }
    }
}

/** Zeitleiste: heute, jeder Tag mit Zahlungen, das Gehalt. */
@Composable
private fun WasKommt(model: UpcomingModel, salaryDay: LocalDate) {
    val today = model.today
    val tage = model.payments.groupBy { it.dueDay }.toSortedMap()
    Column {
        Station(wann = stringResource(R.string.timeline_today, formatDay(today, today)), punkt = { Punkt(Tone.Neutral) }, first = true) {
            Text(stringResource(R.string.tile_accounts), style = MaterialTheme.typography.bodyMedium)
            model.accountsTotal.value?.let { Betrag(it, style = MaterialTheme.typography.titleLarge, autoShrink = true) }
            if (tage.isEmpty()) Text(stringResource(R.string.upcoming_no_payments), style = MaterialTheme.typography.bodyMedium)
        }
        tage.forEach { (tag, zahlungen) ->
            val abstand = zahlungen.first().daysUntilDue
            Station(
                wann = stringResource(
                    R.string.station_due,
                    formatDay(tag, today),
                    if (abstand == 0) stringResource(R.string.today) else pluralStringResource(R.plurals.days_in, abstand, abstand),
                ),
                punkt = { Punkt(Tone.Debt) },
            ) {
                Listengruppe { zahlungen.forEach { zahlung -> zeile { ZahlungsZeile(zahlung) } } }
            }
        }
        Station(
            wann = stringResource(R.string.station_salary, formatDay(salaryDay, today)),
            punkt = { Punkt(Tone.Free, Icons.Default.DateRange) },
            last = true,
        ) {
            Text(stringResource(R.string.station_salary_text), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun ZahlungsZeile(zahlung: UpcomingPayment) {
    ListenZeile(
        title = zahlung.name,
        supporting = stringResource(if (zahlung.source == PaymentSource.DEBT) R.string.source_debt else R.string.source_budget),
        amountCents = zahlung.cents,
        trailing = if (zahlung.isShortlyBeforeSalary) {
            { Marke(stringResource(R.string.upcoming_shortly_before_salary)) }
        } else {
            null
        },
        innen = GruppenZeileInnen,
        betragStil = MaterialTheme.typography.titleMedium,
    )
}
