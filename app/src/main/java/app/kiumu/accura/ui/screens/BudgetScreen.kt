package app.kiumu.accura.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.BudgetStatus
import app.kiumu.accura.data.model.Necessity
import app.kiumu.accura.data.model.NecessityGroup
import app.kiumu.accura.ui.format.formatBps
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.AuswahlEinzeln
import app.kiumu.accura.ui.katalog.BalkenZeile
import app.kiumu.accura.ui.katalog.Betrag
import app.kiumu.accura.ui.katalog.BetragGross
import app.kiumu.accura.ui.katalog.GruppenZeileInnen
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.Kachel
import app.kiumu.accura.ui.katalog.KachelRaster
import app.kiumu.accura.ui.katalog.Kopfzeile
import app.kiumu.accura.ui.katalog.LegendenZeile
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Listengruppe
import app.kiumu.accura.ui.katalog.Ring
import app.kiumu.accura.ui.katalog.RingTeil
import app.kiumu.accura.ui.katalog.RollenPunkt
import app.kiumu.accura.ui.katalog.StackedFontScale
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost
import app.kiumu.accura.ui.katalog.WertKachel
import app.kiumu.accura.ui.katalog.aufklappen
import app.kiumu.accura.ui.katalog.colors
import app.kiumu.accura.ui.katalog.kachelZusatz
import app.kiumu.accura.ui.katalog.zuklappen
import app.kiumu.accura.ui.theme.Raster
import java.time.YearMonth

/**
 * Budget nach dem Aufbau der alten Web-App: Einkommen mit Ring nach Notwendigkeit, „Frei im Monat“ als
 * Fokus-Kachel neben den Rücklagen, Ausgaben als Balken nach Kategorie oder Notwendigkeit, die Raten
 * als Liste. Überplant steht in „Achtung“, nie in Rot.
 */
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
    val monat = formatMonth(YearMonth.from(today))
    val overdrawn = model.status == BudgetStatus.OVERDRAWN
    Ansicht(banner) {
        Kopfzeile(
            titel = stringResource(R.string.budget_title),
            untertitel = model.utilizationBps?.let { stringResource(R.string.budget_subtitle, monat, formatBps(it)) } ?: monat,
        )
        if (model.status == BudgetStatus.INCOME_MISSING) {
            HinweisKarte(stringResource(R.string.budget_income_missing_title), stringResource(R.string.budget_income_missing_text))
        }
        Einkommenskarte(model)
        KachelRaster(
            listOf(
                { mod ->
                    WertKachel(
                        stringResource(R.string.metric_free_monthly),
                        model.freeMonthly,
                        today,
                        mod,
                        tone = if (overdrawn) Tone.Attention else Tone.Free,
                        betont = true,
                        supporting = model.deficitCents?.let { stringResource(R.string.budget_overdrawn_text, formatCents(it)) }
                            ?: stringResource(R.string.budget_free_text),
                    )
                },
                { mod ->
                    Kachel(modifier = mod.semantics(mergeDescendants = true) { }) {
                        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Eng), verticalAlignment = Alignment.CenterVertically) {
                            RollenPunkt(Tone.Reserve)
                            Text(stringResource(R.string.split_reserves), style = MaterialTheme.typography.titleSmall)
                        }
                        Betrag(model.reservesCents, style = MaterialTheme.typography.headlineSmall, autoShrink = true)
                        Text(
                            stringResource(R.string.budget_reserves_text),
                            style = MaterialTheme.typography.bodySmall,
                            color = Tone.Reserve.kachelZusatz(betont = false),
                        )
                    }
                },
            ),
        )

        Abschnitt(stringResource(R.string.section_spending), untertitel = stringResource(R.string.section_spending_text))
        Ausgaben(model)

        if (model.rates.isNotEmpty()) {
            Abschnitt(stringResource(R.string.section_rates))
            Listengruppe {
                model.rates.forEach { rate ->
                    zeile {
                        ListenZeile(
                            title = rate.lender,
                            amountCents = rate.monthlyPaymentCents,
                            innen = GruppenZeileInnen,
                            betragStil = MaterialTheme.typography.titleMedium,
                        )
                    }
                }
                zeile(fuss = true) {
                    ListenZeile(
                        title = stringResource(R.string.rates_total),
                        amountCents = model.ratesCents,
                        innen = GruppenZeileInnen,
                        betragStil = MaterialTheme.typography.titleMedium,
                    )
                }
            }
        }
    }
}

/**
 * Hauptkarte: Einkommen groß, daneben der Ring aus den Stufen der Notwendigkeit, den Raten und dem
 * freien Rest; darunter die Legende mit genauen Beträgen. Der Ring zeigt, die Legende trägt.
 */
@Composable
private fun Einkommenskarte(model: BudgetModel) {
    val farben = notwendigkeitsFarben()
    val zusatz = Tone.Neutral.kachelZusatz(betont = true)
    val teile = buildList {
        model.necessityGroups.forEach { add(Triple(stringResource(it.necessity.labelRes()), it.totalCents, farben.getValue(it.necessity))) }
        if (model.ratesCents > 0) add(Triple(stringResource(R.string.split_rates), model.ratesCents, Tone.Debt.colors().accent))
        model.freeMonthly.value?.takeIf { it > 0 }?.let { add(Triple(stringResource(R.string.split_free), it, Tone.Free.colors().accent)) }
    }
    val gross = LocalDensity.current.fontScale >= StackedFontScale
    Kachel(modifier = Modifier.fillMaxWidth(), tone = Tone.Neutral, betont = true, innen = Raster.Hauptkarte) {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Luecke), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.budget_income), style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
                val income = model.incomeCents
                if (income != null) {
                    BetragGross(formatCents(income))
                    Text(stringResource(R.string.budget_per_month), style = MaterialTheme.typography.bodyMedium, color = zusatz)
                } else {
                    Text(stringResource(R.string.budget_income_missing_title), style = MaterialTheme.typography.titleMedium)
                }
            }
            if (!gross && teile.isNotEmpty()) BudgetRing(model, teile.map { RingTeil(it.second, it.third) }, Modifier.width(128.dp))
        }
        if (gross && teile.isNotEmpty()) BudgetRing(model, teile.map { RingTeil(it.second, it.third) }, Modifier.width(180.dp).align(Alignment.CenterHorizontally))
        KachelRaster(
            teile.map { (name, cents, farbe) -> { mod: Modifier -> LegendenZeile(name, cents, farbe, mod.padding(top = Raster.Eng)) } },
            spalten = 2,
        )
    }
}

@Composable
private fun BudgetRing(model: BudgetModel, teile: List<RingTeil>, modifier: Modifier) {
    val verplant = model.utilizationBps?.let(::formatBps)
    Ring(
        teile = teile,
        beschreibung = verplant?.let { stringResource(R.string.budget_ring_description, it) } ?: stringResource(R.string.budget_ring_description_no_income),
        modifier = modifier,
        staerke = 14.dp,
    ) {
        verplant?.let { BetragGross(it, style = MaterialTheme.typography.titleMedium) }
        Text(stringResource(R.string.budget_ring_center), style = MaterialTheme.typography.labelSmall)
    }
}

/**
 * Ausgaben als Balken, umschaltbar nach Kategorie oder Notwendigkeit. Nach Notwendigkeit klappt jede
 * Stufe auf Tipp ihre Posten auf. Die Balkenlänge ist der Anteil am größten Wert, reine Darstellung.
 */
@Composable
private fun Ausgaben(model: BudgetModel) {
    var ansicht by rememberSaveable { mutableIntStateOf(0) }
    AuswahlEinzeln(
        label = stringResource(R.string.spending_view_label),
        optionen = listOf(stringResource(R.string.spending_by_category), stringResource(R.string.spending_by_necessity)),
        gewaehlt = ansicht,
        onWahl = { ansicht = it },
    )
    val primary = MaterialTheme.colorScheme.primary
    Kachel(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(Raster.Luecke)) {
            if (ansicht == 0) {
                val max = model.categories.maxOfOrNull { it.totalCents }?.coerceAtLeast(1L) ?: 1L
                model.categories.forEach { category ->
                    BalkenZeile(
                        name = category.category,
                        cents = category.totalCents,
                        anteil = category.totalCents.toFloat() / max,
                        farbe = primary,
                        zusatz = category.shareBps?.let { stringResource(R.string.budget_share_of_income, formatBps(it)) },
                    )
                }
            } else {
                val farben = notwendigkeitsFarben()
                val max = model.necessityGroups.maxOfOrNull { it.totalCents }?.coerceAtLeast(1L) ?: 1L
                model.necessityGroups.forEach { group -> NotwendigkeitsStufe(group, max, farben.getValue(group.necessity)) }
            }
        }
    }
}

/** Eine Stufe der Notwendigkeit als Balken; ein Tipp zeigt ihre Posten mit Fälligkeit. */
@Composable
private fun NotwendigkeitsStufe(group: NecessityGroup, max: Long, farbe: Color) {
    var offen by rememberSaveable(group.necessity.name) { mutableStateOf(false) }
    val stateText = stringResource(if (offen) R.string.state_expanded else R.string.state_collapsed)
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClickLabel = stringResource(R.string.budget_items_action)) { offen = !offen }
                .semantics { stateDescription = stateText },
            horizontalArrangement = Arrangement.spacedBy(Raster.Eng),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BalkenZeile(
                name = stringResource(group.necessity.labelRes()),
                cents = group.totalCents,
                anteil = group.totalCents.toFloat() / max,
                farbe = farbe,
                zusatz = group.shareBps?.let { stringResource(R.string.budget_share_of_income, formatBps(it)) },
                modifier = Modifier.weight(1f),
            )
            Icon(if (offen) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null)
        }
        AnimatedVisibility(visible = offen, enter = aufklappen(), exit = zuklappen()) {
            Column(modifier = Modifier.padding(top = 4.dp)) {
                group.items.forEach { item ->
                    ListenZeile(
                        title = item.label,
                        supporting = listOfNotNull(item.category, item.dueDay?.let { stringResource(R.string.budget_due_day, it) }).joinToString(" · "),
                        amountCents = item.monthlyAmountCents,
                    )
                }
            }
        }
    }
}

/**
 * Farben der fünf Stufen: von „primary“ (existenziell) in Schritten zur Spur hin (unnötig). Eine
 * Reihe statt fünf Farbtönen, weil die Stufen eine Rangfolge sind. Die Legende nennt jede Stufe beim Namen.
 */
@Composable
private fun notwendigkeitsFarben(): Map<Necessity, Color> {
    val primary = MaterialTheme.colorScheme.primary
    val spur = MaterialTheme.colorScheme.surfaceContainerHighest
    val schritte = listOf(0f, 0.22f, 0.4f, 0.55f, 0.68f)
    return Necessity.entries.mapIndexed { i, n -> n to lerp(primary, spur, schritte[i]) }.toMap()
}

private fun Necessity.labelRes(): Int = when (this) {
    Necessity.ESSENTIAL -> R.string.necessity_essential
    Necessity.NECESSARY -> R.string.necessity_necessary
    Necessity.WORTHWHILE -> R.string.necessity_worthwhile
    Necessity.OPTIONAL -> R.string.necessity_optional
    Necessity.UNNECESSARY -> R.string.necessity_unnecessary
}
