package app.kiumu.accura.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.AccountKind
import app.kiumu.accura.data.model.IncomePart
import app.kiumu.accura.data.model.IncomePartKey
import app.kiumu.accura.data.model.IncomeSplit
import app.kiumu.accura.data.model.NextRelief
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.SalaryStatus
import app.kiumu.accura.data.model.Stand
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.formatDay
import app.kiumu.accura.ui.format.formatMetricNumber
import app.kiumu.accura.ui.format.formatMonth
import app.kiumu.accura.ui.format.formatPercent
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.AnteilPille
import app.kiumu.accura.ui.katalog.BankIcon
import app.kiumu.accura.ui.katalog.Betrag
import app.kiumu.accura.ui.katalog.BetragGross
import app.kiumu.accura.ui.katalog.CashIcon
import app.kiumu.accura.ui.katalog.ClockIcon
import app.kiumu.accura.ui.katalog.DatenalterChip
import app.kiumu.accura.ui.katalog.GruppenZeileInnen
import app.kiumu.accura.ui.katalog.HinweisKarte
import app.kiumu.accura.ui.katalog.IconScheibe
import app.kiumu.accura.ui.katalog.Kachel
import app.kiumu.accura.ui.katalog.KachelRaster
import app.kiumu.accura.ui.katalog.Kopfzeile
import app.kiumu.accura.ui.katalog.Leerzustand
import app.kiumu.accura.ui.katalog.ListenZeile
import app.kiumu.accura.ui.katalog.Listengruppe
import app.kiumu.accura.ui.katalog.PillenKnopf
import app.kiumu.accura.ui.katalog.RateLaeuftAusZeichen
import app.kiumu.accura.ui.katalog.Ring
import app.kiumu.accura.ui.katalog.RingTeil
import app.kiumu.accura.ui.katalog.StackedFontScale
import app.kiumu.accura.ui.katalog.Tone
import app.kiumu.accura.ui.katalog.ViewStateHost
import app.kiumu.accura.ui.katalog.WalletIcon
import app.kiumu.accura.ui.katalog.WertKachel
import app.kiumu.accura.ui.katalog.colors
import app.kiumu.accura.ui.katalog.kachelZusatz
import app.kiumu.accura.ui.theme.Raster
import java.time.LocalDate
import java.time.YearMonth

/**
 * Übersicht nach dem Aufbau der alten Web-App, ausgeführt nach Google Health (Prototyp Runde 2):
 * Begrüßung mit Monat, Einkommens-Ring mit Anteil-Pillen, Hauptaktion als Pillen-Knopf, wichtigste
 * Werte als Kacheln, nächster Spielraum, Konten als Liste, Pockets als Kacheln. Datenalter und
 * „So gerechnet“ liegen ruhig darunter: ein Chip für den ältesten Stand, die Einzelheiten im Blatt
 * jeder Kachel. Expressive-Höhepunkt: der Stern „Eine Rate läuft aus“ in der Karte „Nächster Spielraum“.
 */
@Composable
fun OverviewScreen(
    state: ViewState<OverviewModel>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onStaendeAktualisieren: () -> Unit = {},
) {
    ViewStateHost(
        state = state,
        onRetry = onRetry,
        modifier = modifier,
        empty = {
            Leerzustand(
                stringResource(R.string.overview_empty_title),
                stringResource(R.string.overview_empty_text),
                aktion = stringResource(R.string.overview_empty_action),
                onAktion = onStaendeAktualisieren,
            )
        },
    ) { model, banner -> Uebersicht(model, banner, onStaendeAktualisieren) }
}

@Composable
private fun Uebersicht(model: OverviewModel, banner: @Composable () -> Unit, onStaendeAktualisieren: () -> Unit) {
    val today = model.today
    Ansicht(banner) {
        Kopfzeile(
            titel = stringResource(R.string.overview_greeting),
            untertitel = stringResource(R.string.overview_month, formatMonth(YearMonth.from(today))),
        )
        model.incomeSplit?.let { EinkommensAufteilung(it) }
        PillenKnopf(
            text = stringResource(R.string.action_update_stands),
            onClick = onStaendeAktualisieren,
            icon = Icons.Default.Refresh,
            modifier = Modifier.fillMaxWidth(),
        )
        model.dataAge.oldestDay?.let { day ->
            DatenalterChip(day, model.dataAge.oldestAgeDays ?: 0, stale = model.dataAge.staleCount > 0, today = today, oldest = true)
        }
        AlteStaendeHinweis(model)

        Abschnitt(stringResource(R.string.section_glance))
        WichtigsteWerte(model)
        model.nextRelief?.let { NaechsterSpielraumKarte(it) }

        Konten(model)
        Pockets(model)
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
private fun AlteStaendeHinweis(model: OverviewModel) {
    if (model.dataAge.staleCount > 0) {
        HinweisKarte(
            title = stringResource(R.string.overview_stale_title),
            text = pluralStringResource(R.plurals.overview_stale_text, model.dataAge.staleCount, model.dataAge.staleCount),
            icon = ClockIcon,
        )
    }
}

/**
 * Einkommens-Ring links, Anteil-Pillen rechts (bei großer Schrift untereinander). Eine Pille je Anteil,
 * den das Backend liefert, mit dessen ganzen Prozent; die App summiert und rundet nichts. In der Mitte
 * steht der Anteil „frei“.
 */
@Composable
private fun EinkommensAufteilung(split: IncomeSplit) {
    val frei = split.parts.firstOrNull { it.key == IncomePartKey.FREE }
    val anteile = split.parts.map { part -> part.anzeige() }
    val ring: @Composable (Modifier) -> Unit = { mod ->
        Ring(
            teile = split.parts.map { RingTeil(it.cents, it.tone().colors().accent) },
            beschreibung = stringResource(
                R.string.overview_ring_description,
                formatCents(split.incomeCents),
                anteile.joinToString(", ") { "${it.name} ${it.prozent ?: formatCents(it.part.cents)}" },
            ),
            modifier = mod,
        ) {
            frei?.sharePercent?.let { BetragGross(formatPercent(it), style = MaterialTheme.typography.headlineMedium) }
            Text(stringResource(R.string.ring_center_free), style = MaterialTheme.typography.labelLarge)
        }
    }
    val pillen: @Composable (Modifier) -> Unit = { mod ->
        Column(modifier = mod, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            anteile.forEach { a ->
                AnteilPille(
                    name = a.name,
                    anteil = a.prozent,
                    cents = a.part.cents,
                    tone = a.tone,
                    fuellung = (a.part.sharePercent ?: 0) / 100f,
                )
            }
        }
    }
    if (LocalDensity.current.fontScale >= StackedFontScale) {
        Column(verticalArrangement = Arrangement.spacedBy(Raster.Luecke), horizontalAlignment = Alignment.CenterHorizontally) {
            ring(Modifier.width(200.dp))
            pillen(Modifier.fillMaxWidth())
        }
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Luecke), verticalAlignment = Alignment.CenterVertically) {
            ring(Modifier.weight(0.5f))
            pillen(Modifier.weight(0.5f))
        }
    }
    Text(
        stringResource(R.string.overview_income_note, formatCents(split.incomeCents)),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

private class AnteilAnzeige(val part: IncomePart, val name: String, val prozent: String?, val tone: Tone)

@Composable
private fun IncomePart.anzeige(): AnteilAnzeige {
    // Mehr verplant als Einkommen: „frei“ ist negativ und steht in der Rolle „Achtung“, nie in Rot.
    val tone = if (key == IncomePartKey.FREE && cents < 0) Tone.Attention else tone()
    return AnteilAnzeige(this, stringResource(key.labelRes()), sharePercent?.let(::formatPercent), tone)
}

/**
 * Die wichtigsten Werte als Kacheln, nach Google Health. „Jetzt verfügbar“ ist der Fokus (kräftig).
 * Ohne Gehaltstag steht bei „Bis Gehalt“ „Gehaltstag eintragen“.
 */
@Composable
private fun WichtigsteWerte(model: OverviewModel) {
    val today = model.today
    val bisGehalt = model.availableUntilSalary
    val bisGehaltTone = if ((bisGehalt.value ?: 0L) < 0L) Tone.Attention else Tone.Free
    KachelRaster(
        listOf(
            { mod ->
                WertKachel(
                    stringResource(R.string.tile_available_now),
                    model.accountsTotal,
                    today,
                    mod,
                    tone = Tone.Neutral,
                    betont = true,
                    supporting = stringResource(R.string.tile_available_now_text),
                )
            },
            { mod ->
                WertKachel(
                    stringResource(R.string.tile_until_salary),
                    bisGehalt,
                    today,
                    mod,
                    tone = bisGehaltTone,
                    supporting = formatMetricNumber(model.dailyAllowance)?.let { stringResource(R.string.tile_until_salary_text, it) },
                    missingHint = salaryMissingHint(model.salaryStatus),
                )
            },
            { mod ->
                WertKachel(
                    stringResource(R.string.tile_reserves),
                    model.pocketsTotal,
                    today,
                    mod,
                    tone = Tone.Reserve,
                    supporting = stringResource(R.string.tile_reserves_text),
                )
            },
            { mod ->
                WertKachel(
                    stringResource(R.string.metric_buffer),
                    model.bufferMonths,
                    today,
                    mod,
                    tone = Tone.Reserve,
                    supporting = stringResource(R.string.tile_buffer_text),
                )
            },
        ),
    )
}

/**
 * Nächster Spielraum: welche Rate endet, ab wann wie viel mehr frei ist. Kräftig in der Rolle „Frei“,
 * mit dem Stern als einzigem Expressive-Höhepunkt der Übersicht.
 */
@Composable
private fun NaechsterSpielraumKarte(relief: NextRelief) {
    val zusatz = Tone.Free.kachelZusatz(betont = true)
    Kachel(modifier = Modifier.fillMaxWidth(), tone = Tone.Free, betont = true, innen = Raster.Hauptkarte) {
        Row(horizontalArrangement = Arrangement.spacedBy(Raster.Luecke), verticalAlignment = Alignment.Top) {
            RateLaeuftAusZeichen()
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.relief_title), style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
                Text(
                    stringResource(R.string.relief_card_text, relief.events.joinToString { it.lender }, formatMonth(relief.freeFromMonth)),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    stringResource(R.string.timeline_relief_more, formatCents(relief.monthlyReliefCents)),
                    style = MaterialTheme.typography.titleSmall,
                )
                relief.freeAfterCents?.let { after ->
                    Text(stringResource(R.string.relief_card_after), style = MaterialTheme.typography.bodySmall, color = zusatz)
                    Betrag(after, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, autoShrink = true)
                }
            }
        }
    }
}

/** Konten als Listengruppe mit Gesamt, wie in der alten App. Frische Stände stehen leise als Zusatz, alte als Chip. */
@Composable
private fun Konten(model: OverviewModel) {
    Abschnitt(stringResource(R.string.section_accounts))
    if (model.accounts.isEmpty()) return
    val today = model.today
    Listengruppe {
        model.accounts.forEach { account ->
            zeile {
                ListenZeile(
                    title = account.name,
                    supporting = listOfNotNull(stringResource(account.kind.labelRes()), standText(account.stand, today)).joinToString(" · "),
                    amountCents = account.stand?.cents,
                    leading = { IconScheibe(account.kind.icon(), Tone.Neutral) },
                    trailing = account.stand?.takeIf { it.stale }?.let { stand ->
                        { DatenalterChip(stand.day, stand.ageDays, stale = true, today = today) }
                    },
                    innen = GruppenZeileInnen,
                    betragStil = MaterialTheme.typography.titleMedium,
                )
            }
        }
        zeile(fuss = true) {
            ListenZeile(
                title = stringResource(R.string.accounts_total),
                amountCents = model.accountsTotal.value,
                innen = GruppenZeileInnen,
                betragStil = MaterialTheme.typography.titleMedium,
            )
        }
    }
}

/** Pockets als Kachelraster (gedämpft, keine davon ist Fokus). Sie sind eine zweite Sicht auf dasselbe Geld. */
@Composable
private fun Pockets(model: OverviewModel) {
    if (model.pockets.isEmpty()) return
    val today = model.today
    Abschnitt(stringResource(R.string.section_pockets), untertitel = stringResource(R.string.pockets_note))
    KachelRaster(
        model.pockets.map { pocket ->
            { mod: Modifier ->
                Kachel(modifier = mod.semantics(mergeDescendants = true) { }) {
                    Text(pocket.name, style = MaterialTheme.typography.titleSmall)
                    val stand = pocket.stand
                    if (stand == null) {
                        Text(stringResource(R.string.account_no_stand), style = MaterialTheme.typography.bodySmall)
                    } else {
                        Betrag(stand.cents, style = MaterialTheme.typography.titleLarge, autoShrink = true)
                        if (stand.stale) DatenalterChip(stand.day, stand.ageDays, stale = true, today = today)
                    }
                }
            }
        },
    )
}

/** „Stand von heute“ oder „Stand vom 3. Aug.“; alte Stände zeigt der Chip, nicht dieser Text. */
@Composable
private fun standText(stand: Stand?, today: LocalDate): String? = when {
    stand == null -> stringResource(R.string.account_no_stand)
    stand.stale -> null
    stand.ageDays == 0 -> stringResource(R.string.chip_data_today)
    else -> stringResource(R.string.chip_data_from, formatDay(stand.day, today))
}

private fun AccountKind.labelRes(): Int = when (this) {
    AccountKind.BANK -> R.string.account_kind_bank
    AccountKind.WALLET -> R.string.account_kind_wallet
    AccountKind.CASH -> R.string.account_kind_cash
}

private fun AccountKind.icon(): ImageVector = when (this) {
    AccountKind.BANK -> BankIcon
    AccountKind.WALLET -> WalletIcon
    AccountKind.CASH -> CashIcon
}

private fun IncomePartKey.labelRes(): Int = when (this) {
    IncomePartKey.EXPENSES -> R.string.split_expenses
    IncomePartKey.RATES -> R.string.split_rates
    IncomePartKey.RESERVES -> R.string.split_reserves
    IncomePartKey.FREE -> R.string.split_free
}

private fun IncomePart.tone(): Tone = when (key) {
    IncomePartKey.EXPENSES -> Tone.Neutral
    IncomePartKey.RATES -> Tone.Debt
    IncomePartKey.RESERVES -> Tone.Reserve
    IncomePartKey.FREE -> Tone.Free
}
