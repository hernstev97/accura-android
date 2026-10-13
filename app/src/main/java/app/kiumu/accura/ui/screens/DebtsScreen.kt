package app.kiumu.accura.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.DebtKind
import app.kiumu.accura.data.model.DebtState
import app.kiumu.accura.data.model.DebtView
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.ReliefGroup
import app.kiumu.accura.data.model.ScheduleWarning
import app.kiumu.accura.data.model.TrajectoryPoint
import app.kiumu.accura.ui.format.formatBps
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.format.formatMonthShort
import app.kiumu.accura.ui.format.formatSignedCents
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.Betrag
import app.kiumu.accura.ui.katalog.BetragGross
import app.kiumu.accura.ui.katalog.Blatt
import app.kiumu.accura.ui.katalog.FlagIcon
import app.kiumu.accura.ui.katalog.GruppenZeileInnen
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.IconScheibe
import app.kiumu.accura.ui.katalog.Kachel
import app.kiumu.accura.ui.katalog.KachelRaster
import app.kiumu.accura.ui.katalog.Kopfzeile
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Listengruppe
import app.kiumu.accura.ui.katalog.Punkt
import app.kiumu.accura.ui.katalog.RateLaeuftAusZeichen
import app.kiumu.accura.ui.katalog.Rechenweg
import app.kiumu.accura.ui.katalog.SoGerechnet
import app.kiumu.accura.ui.katalog.StackedFontScale
import app.kiumu.accura.ui.katalog.Station
import app.kiumu.accura.ui.katalog.Stufendiagramm
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.TrendingDownIcon
import app.kiumu.accura.ui.katalog.Verlaufskurve
import app.kiumu.accura.ui.katalog.ViewStateHost
import app.kiumu.accura.ui.katalog.WertKachel
import app.kiumu.accura.ui.katalog.ZustandsChips
import app.kiumu.accura.ui.katalog.aufklappen
import app.kiumu.accura.ui.katalog.colors
import app.kiumu.accura.ui.katalog.kachelZusatz
import app.kiumu.accura.ui.katalog.metricDisplayValue
import app.kiumu.accura.ui.katalog.zuklappen
import app.kiumu.accura.ui.theme.Raster
import java.time.LocalDate
import java.time.YearMonth

/**
 * Schulden als „Dein Weg auf null“ (Aufbau der alten Web-App): große Karte mit Restschuld, Ablösesumme
 * und Ziel, zwei Kacheln, Gläubiger, Restschuldverlauf und die Stufen „Mehr frei durch auslaufende
 * Raten“ mit der Zeitleiste als Textfassung. Schulden stehen ruhig in Schiefergrau (Leitfaden), nicht in
 * Rosa oder Rot. Expressive-Höhepunkt: der Stern an der nächsten auslaufenden Rate.
 */
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
    val ziel = model.debtFreeDay.day?.let { YearMonth.from(it) }
    Ansicht(banner) {
        Kopfzeile(
            titel = stringResource(R.string.debts_title),
            untertitel = ziel?.let { stringResource(R.string.debts_subtitle, formatMonth(it)) },
        )
        Hauptkarte(model, ziel)
        KachelRaster(
            listOf(
                { mod ->
                    WertKachel(
                        stringResource(R.string.metric_interest_to_end),
                        model.interestToEnd,
                        today,
                        mod,
                        tone = Tone.Debt,
                        supporting = stringResource(R.string.tile_interest_text),
                    )
                },
                { mod ->
                    WertKachel(
                        stringResource(R.string.tile_extra_cost),
                        model.extraCostVsPayoff,
                        today,
                        mod,
                        tone = Tone.Debt,
                        supporting = stringResource(R.string.tile_extra_cost_text),
                    )
                },
            ),
        )

        Abschnitt(stringResource(R.string.section_lenders), untertitel = stringResource(R.string.section_lenders_text))
        Glaeubiger(model.debts, today)

        if (model.trajectory.size > 1) {
            Abschnitt(stringResource(R.string.section_trajectory), untertitel = stringResource(R.string.section_trajectory_text))
            RestschuldVerlauf(model.trajectory, today)
        }

        if (model.relief.isNotEmpty()) {
            Abschnitt(stringResource(R.string.section_relief), untertitel = stringResource(R.string.section_relief_text))
            MehrFrei(model.relief, ziel, today)
        }
    }
}

/** Große Karte: Restschuld heute, Ablösesumme als Obergrenze, Ziel als runde Plakette, Zustand und Rechenweg. */
@Composable
private fun Hauptkarte(model: DebtsModel, ziel: YearMonth?) {
    val zusatz = Tone.Debt.kachelZusatz(betont = true)
    // Ab 130 % Schrift steht das Ziel unter der Zahl, damit die Zahl die ganze Breite hat.
    val gross = LocalDensity.current.fontScale >= StackedFontScale
    Kachel(modifier = Modifier.fillMaxWidth(), tone = Tone.Debt, betont = true, innen = Raster.Hauptkarte) {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Luecke), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.debts_hero_label), style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
                BetragGross(metricDisplayValue(model.remaining))
                model.payoffMax.value?.let {
                    Text(stringResource(R.string.debts_payoff_line, formatCents(it)), style = MaterialTheme.typography.bodyMedium, color = zusatz)
                }
            }
            if (ziel != null && !gross) ZielPlakette(ziel, pille = false)
        }
        if (ziel != null && gross) ZielPlakette(ziel, pille = true)
        ZustandsChips(model.remaining, model.today, Modifier.padding(top = Raster.Eng))
        SoGerechnet(model.remaining)
    }
}

/**
 * Ziel als runde Plakette mit Rand in der Akzentfarbe: Monat der letzten Rate. Bei sehr großer Schrift
 * passt der Monat nicht in einen Kreis; dann ist die Plakette eine Pille unter der Zahl.
 */
@Composable
private fun ZielPlakette(ziel: YearMonth, pille: Boolean) {
    val farben = Tone.Debt.colors()
    val inhalt: @Composable () -> Unit = {
        Icon(FlagIcon, contentDescription = null, tint = farben.accent, modifier = Modifier.size(20.dp))
        Text(stringResource(R.string.debts_goal), style = MaterialTheme.typography.labelMedium)
        Text(formatMonthShort(ziel), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    }
    if (pille) {
        Row(
            modifier = Modifier
                .border(3.dp, farben.accent, CircleShape)
                .padding(horizontal = 20.dp, vertical = 10.dp)
                .semantics(mergeDescendants = true) { },
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) { inhalt() }
    } else {
        Column(
            modifier = Modifier
                .size(104.dp)
                .border(3.dp, farben.accent, CircleShape)
                .padding(8.dp)
                .semantics(mergeDescendants = true) { },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) { inhalt() }
    }
}

/** Gläubiger als Listengruppe. Ein Tipp öffnet die Einzelheiten des Kredits im Blatt. */
@Composable
private fun Glaeubiger(debts: List<DebtView>, today: LocalDate) {
    var offen by rememberSaveable { mutableStateOf<String?>(null) }
    Listengruppe {
        debts.forEach { debt ->
            zeile {
                ListenZeile(
                    title = debt.lender,
                    supporting = if (debt.state == DebtState.INVALID) {
                        stringResource(R.string.debts_invalid_title)
                    } else {
                        stringResource(
                            R.string.debt_supporting,
                            stringResource(debt.kind.labelRes()),
                            pluralStringResource(R.plurals.payments_count, debt.remainingPaymentCount, debt.remainingPaymentCount),
                        )
                    },
                    amountCents = debt.balance.value,
                    leading = { IconScheibe(TrendingDownIcon, Tone.Debt) },
                    onClick = { offen = debt.id },
                    onClickLabel = stringResource(R.string.debt_open_action),
                    innen = GruppenZeileInnen,
                    betragStil = MaterialTheme.typography.titleMedium,
                )
            }
        }
    }
    debts.firstOrNull { it.id == offen }?.let { debt -> KreditBlatt(debt, today, onDismiss = { offen = null }) }
}

/** Einzelheiten eines Kredits: Restschuld, Zustand, Raten, Zinsen, Ablösung, Abweichung, Warnungen, Rechenweg. */
@Composable
private fun KreditBlatt(debt: DebtView, today: LocalDate, onDismiss: () -> Unit) {
    Blatt(titel = debt.lender, onDismiss = onDismiss) {
        BetragGross(metricDisplayValue(debt.balance), style = MaterialTheme.typography.displaySmall)
        ZustandsChips(debt.balance, today)
        if (debt.state == DebtState.INVALID) {
            HinweisKarte(stringResource(R.string.debts_invalid_title), debt.issues.joinToString(" "))
        } else {
            debt.nextPayment?.let {
                Text(stringResource(R.string.debts_next_payment, formatDay(it.day, today), formatCents(it.cents)), style = MaterialTheme.typography.bodyLarge)
            }
            debt.lastPaymentDay?.let { Text(stringResource(R.string.debts_last_payment, formatDay(it)), style = MaterialTheme.typography.bodyLarge) }
            Text(
                stringResource(
                    R.string.debts_remaining,
                    pluralStringResource(R.plurals.payments_count, debt.remainingPaymentCount, debt.remainingPaymentCount),
                    formatCents(debt.remainingTotalCents),
                ),
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                stringResource(R.string.debts_rates, formatBps(debt.terms.nominalRateBps), formatBps(debt.terms.effectiveRateBps)),
                style = MaterialTheme.typography.bodyLarge,
            )
            debt.payoff?.let { Text(stringResource(R.string.debts_payoff_line, formatCents(it.maxCents)), style = MaterialTheme.typography.bodyLarge) }
            debt.deviation?.let {
                Text(stringResource(R.string.debts_deviation, formatSignedCents(it.differenceCents), formatDay(it.day, today)), style = MaterialTheme.typography.bodyLarge)
            }
            debt.warnings.forEach { warning ->
                HinweisKarte(stringResource(R.string.debts_warning_title), stringResource(warning.textRes()))
            }
        }
        Text(
            stringResource(R.string.how_calculated),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = Raster.Eng).semantics { heading() },
        )
        Rechenweg(debt.balance)
    }
}

/**
 * Restschuld bei planmäßiger Zahlung als Kurve, darüber heute und Ziel, darunter auf Wunsch die Werte
 * als Tabelle (heute, jeder Januar, letzter Monat).
 */
@Composable
private fun RestschuldVerlauf(trajectory: List<TrajectoryPoint>, today: LocalDate) {
    val erster = trajectory.first()
    val letzter = trajectory.last()
    Kachel(modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Luecke)) {
            Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) { }) {
                Text(stringResource(R.string.trajectory_today), style = MaterialTheme.typography.labelMedium)
                Betrag(erster.balanceCents, style = MaterialTheme.typography.titleMedium, autoShrink = true)
            }
            Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) { }, horizontalAlignment = Alignment.End) {
                Text(stringResource(R.string.debts_goal), style = MaterialTheme.typography.labelMedium)
                Text(formatMonth(letzter.month), style = MaterialTheme.typography.titleMedium)
            }
        }
        Verlaufskurve(
            werte = trajectory.map { it.balanceCents },
            tone = Tone.Debt,
            beschreibung = stringResource(
                R.string.trajectory_description,
                formatCents(erster.balanceCents),
                formatCents(letzter.balanceCents),
                formatMonth(letzter.month),
            ),
            anfang = formatDay(erster.day ?: today, today),
            ende = formatMonthShort(letzter.month),
            modifier = Modifier.padding(top = Raster.Eng),
        )
        TabelleUmschalter { VerlaufTabelle(trajectory, today) }
    }
}

/** Schalter „Werte als Tabelle“ mit Zustand für TalkBack; die Tabelle ist die Textfassung des Diagramms. */
@Composable
private fun TabelleUmschalter(tabelle: @Composable () -> Unit) {
    var offen by rememberSaveable { mutableStateOf(false) }
    val stateText = stringResource(if (offen) R.string.state_expanded else R.string.state_collapsed)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClickLabel = stringResource(R.string.table_action)) { offen = !offen }
            .semantics { stateDescription = stateText },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(stringResource(R.string.table_toggle), style = MaterialTheme.typography.labelLarge)
        Icon(if (offen) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null)
    }
    AnimatedVisibility(visible = offen, enter = aufklappen(), exit = zuklappen()) { tabelle() }
}

/** Heute, jeder Januar und der letzte Monat: genug für den Weg, ohne 40 Zeilen. Beträge genau. */
@Composable
private fun VerlaufTabelle(trajectory: List<TrajectoryPoint>, today: LocalDate) {
    val zeilen = trajectory.filterIndexed { index, p ->
        index == 0 || index == trajectory.lastIndex || (p.day == null && p.month.monthValue == 1)
    }
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        zeilen.forEachIndexed { index, p ->
            if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            ListenZeile(
                title = p.day?.let { stringResource(R.string.timeline_today, formatDay(it, today)) } ?: formatMonth(p.month),
                amountCents = p.balanceCents,
            )
        }
    }
}

/**
 * Mehr frei durch auslaufende Raten: Stufen von „frei im Monat“ nach jeder Entlastung, darunter die
 * Zeitleiste mit genauen Beträgen (Textfassung des Diagramms) bis „schuldenfrei“. Fehlt der Wert
 * „frei danach“ in einer Stufe, entfällt das Diagramm, die Zeitleiste bleibt.
 */
@Composable
private fun MehrFrei(relief: List<ReliefGroup>, ziel: YearMonth?, today: LocalDate) {
    val werte = relief.mapNotNull { it.freeAfterCents }
    if (werte.size == relief.size) {
        Kachel(modifier = Modifier.fillMaxWidth()) {
            Stufendiagramm(
                werte = werte,
                beschriftungen = relief.map { formatMonthShort(it.freeFromMonth) },
                // Bleibt auch danach weniger als nichts frei, zeigt das Diagramm „Achtung“ statt „Frei“.
                tone = if (werte.any { it < 0 }) Tone.Attention else Tone.Free,
                beschreibung = pluralStringResource(
                    R.plurals.relief_chart_description,
                    relief.size,
                    relief.size,
                    formatMonth(relief.last().freeFromMonth),
                    formatCents(werte.last()),
                ),
            )
        }
    }
    Column {
        relief.forEachIndexed { index, group ->
            Station(
                wann = stringResource(R.string.relief_from, formatMonth(group.freeFromMonth)),
                // Der Stern steht nur an der nächsten Entlastung: ein Höhepunkt je Bildschirm.
                punkt = { if (index == 0) RateLaeuftAusZeichen() else Punkt(Tone.Free) },
                first = index == 0,
                last = index == relief.lastIndex && ziel == null,
            ) {
                group.events.forEach { event ->
                    Text(
                        stringResource(R.string.timeline_relief_event, event.lender, formatDay(event.lastPaymentDay, today)),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
                Text(stringResource(R.string.timeline_relief_more, formatCents(group.monthlyReliefCents)), style = MaterialTheme.typography.titleSmall)
                group.freeAfterCents?.let { after ->
                    Text(stringResource(R.string.relief_free_after, formatCents(after)), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        ziel?.let {
            Station(wann = formatMonth(it), punkt = { Punkt(Tone.Debt, FlagIcon) }, last = true) {
                Text(stringResource(R.string.timeline_debt_free), style = MaterialTheme.typography.titleSmall)
            }
        }
    }
    Kachel(modifier = Modifier.fillMaxWidth(), tone = Tone.Reserve, betont = true) {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Luecke), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(24.dp)) { Icon(Icons.Default.DateRange, contentDescription = null) }
            Column(modifier = Modifier.weight(1f)) {
                Text(stringResource(R.string.relief_assumption_title), style = MaterialTheme.typography.titleSmall)
                Text(stringResource(R.string.relief_assumption_text), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

private fun DebtKind.labelRes(): Int = when (this) {
    DebtKind.LOAN -> R.string.debt_kind_loan
    DebtKind.INSTALLMENT -> R.string.debt_kind_installment
}

private fun ScheduleWarning.textRes(): Int = when (this) {
    ScheduleWarning.PAYMENT_BELOW_INTEREST -> R.string.warning_payment_below_interest
    ScheduleWarning.UNEXPECTED_RESIDUAL -> R.string.warning_unexpected_residual
    ScheduleWarning.FINAL_PAYMENT_FAR_FROM_RATE -> R.string.warning_final_payment_far
}
