package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.ui.format.BetragEingabe
import app.kiumu.accura.ui.format.formatCents
import app.kiumu.accura.ui.format.parseBetrag

/**
 * Betragsfeld: Ziffern und ein Komma. Darunter steht, was accura daraus liest („Gelesen als
 * 1.482,60 €“), bei Ungültigem, wie es richtig geht. Mit [minus] gibt es den Schalter „Im Minus“
 * (für Kontostände). Das Feld hält keinen eigenen Zustand.
 */
@Composable
fun Betragsfeld(
    label: String,
    text: String,
    onTextChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    minus: Boolean? = null,
    onMinusChange: (Boolean) -> Unit = {},
    hint: String? = null,
) {
    val parsed = parseBetrag(text, minus == true)
    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            label = { Text(label) },
            suffix = { Text("€") },
            singleLine = true,
            isError = parsed is BetragEingabe.Ungueltig,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
            supportingText = {
                when (parsed) {
                    BetragEingabe.Leer -> hint?.let { Text(it) }
                    is BetragEingabe.Gueltig -> Text(stringResource(R.string.amount_read_as, formatCents(parsed.cents)))
                    BetragEingabe.Ungueltig -> Text(stringResource(R.string.amount_invalid))
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        if (minus != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(value = minus, role = Role.Checkbox, onValueChange = onMinusChange),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Checkbox(checked = minus, onCheckedChange = null)
                Text(stringResource(R.string.amount_minus), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

/** Auswahl, eine Wahl: Chips, die bei großer Schrift umbrechen. Jeder Chip ist mindestens 48 dp hoch. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AuswahlEinzeln(
    label: String,
    optionen: List<String>,
    gewaehlt: Int?,
    onWahl: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.titleSmall)
        FlowRow(
            modifier = Modifier.selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            optionen.forEachIndexed { index, option ->
                val selected = index == gewaehlt
                FilterChip(
                    selected = selected,
                    onClick = { onWahl(index) },
                    label = { Text(option) },
                    leadingIcon = if (selected) {
                        { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.heightIn(max = FilterChipDefaults.IconSize)) }
                    } else {
                        null
                    },
                )
            }
        }
    }
}

/** Auswahl, mehrere: Liste mit Häkchen (zum Beispiel Vorlagen für feste Kosten). Die ganze Zeile schaltet. */
@Composable
fun AuswahlMehrere(
    optionen: List<String>,
    gewaehlt: Set<Int>,
    onUmschalten: (Int, Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        optionen.forEachIndexed { index, option ->
            val checked = index in gewaehlt
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(value = checked, role = Role.Checkbox) { onUmschalten(index, it) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Checkbox(checked = checked, onCheckedChange = null)
                Text(option, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

/** Schrittanzeige der Ersterfassung: „Thema 2 von 6“, Fortschrittsbalken, Zurück und „Später“. */
@Composable
fun Schrittanzeige(
    nummer: Int,
    gesamt: Int,
    thema: String,
    onZurueck: (() -> Unit)?,
    onSpaeter: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val progressLabel = stringResource(R.string.step_progress, nummer, gesamt)
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(progressLabel, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        LinearProgressIndicator(
            progress = { nummer.toFloat() / gesamt },
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = progressLabel },
        )
        Text(thema, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (onZurueck != null) TextButton(onClick = onZurueck) { Text(stringResource(R.string.action_back)) }
            TextButton(onClick = onSpaeter) { Text(stringResource(R.string.step_later)) }
        }
    }
}
