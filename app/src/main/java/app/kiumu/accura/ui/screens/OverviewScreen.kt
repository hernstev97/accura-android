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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.IncomePartKey
import app.kiumu.accura.data.model.IncomeSplit
import app.kiumu.accura.data.model.NextRelief
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.SalaryStatus
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.format.formatWholePercent
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Anteil
import app.kiumu.accura.ui.katalog.Aufteilungsbalken
import app.kiumu.accura.ui.katalog.ClockIcon
import app.kiumu.accura.ui.katalog.DatenalterChip
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost

/**
 * Übersicht: Was habe ich, was kann ich ausgeben, was kommt. Wie die Antwort aussieht, entscheidet
 * [variant] (Prototyp, siehe [OverviewVariant]). Leer, Laden, Fehler und veraltet sind für alle
 * Varianten gleich.
 */
@Composable
fun OverviewScreen(
    state: ViewState<OverviewModel>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    variant: OverviewVariant = OverviewVariant.Standard,
) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = { Leerzustand(stringResource(R.string.overview_empty_title), stringResource(R.string.overview_empty_text)) },
    ) { model, banner ->
        when (variant) {
            OverviewVariant.KONTOSTAND -> UebersichtKontostand(model, banner)
            OverviewVariant.SPIELRAUM -> UebersichtSpielraum(model, banner)
            OverviewVariant.ZEITLEISTE -> UebersichtZeitleiste(model, banner)
        }
    }
}

/** „Gehaltstag eintragen“ statt einer Zahl, solange der Gehaltstag fehlt. */
@Composable
fun salaryMissingHint(status: SalaryStatus): String? = when (status) {
    SalaryStatus.SET -> null
    SalaryStatus.MISSING -> stringResource(R.string.salary_missing_value)
}

/** Ruhiger Hinweis, wenn Stände alt sind. Nennt die Zahl, nie einen Vorwurf. */
@Composable
internal fun AlteStaendeHinweis(model: OverviewModel) {
    if (model.dataAge.staleCount > 0) {
        HinweisKarte(
            title = stringResource(R.string.overview_stale_title),
            text = pluralStringResource(R.plurals.overview_stale_text, model.dataAge.staleCount, model.dataAge.staleCount),
            icon = ClockIcon,
        )
    }
}

/** Konten mit Stand und Datenalter, darunter die Pockets als zweite Sicht auf dasselbe Geld. */
@Composable
internal fun KontenUndPockets(model: OverviewModel) {
    Abschnitt(stringResource(R.string.section_accounts))
    model.accounts.forEach { account ->
        ListenZeile(
            title = account.name,
            amountCents = account.stand?.cents,
            supporting = if (account.stand == null) stringResource(R.string.account_no_stand) else null,
            trailing = account.stand?.let { stand ->
                { DatenalterChip(stand.day, stand.ageDays, stand.stale, model.today, Modifier.padding(top = 4.dp)) }
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

/** Wohin das Einkommen geht: Balken und Liste mit Anteil und Betrag. */
@Composable
internal fun EinkommensAufteilung(split: IncomeSplit) {
    Abschnitt(stringResource(R.string.section_income_split))
    Aufteilungsbalken(
        parts = split.parts.map { part ->
            Anteil(
                label = stringResource(part.key.labelRes()),
                cents = part.cents,
                shareText = part.shareBps?.let(::formatWholePercent),
                tone = part.key.tone(),
            )
        },
    )
}

/** Nächster Spielraum: ab wann eine Rate frei wird und was dann im Monat frei ist. */
@Composable
internal fun NaechsterSpielraumKarte(relief: NextRelief) {
    OutlinedCard(modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.relief_title), style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
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
