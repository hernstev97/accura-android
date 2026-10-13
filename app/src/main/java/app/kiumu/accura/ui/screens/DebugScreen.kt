package app.kiumu.accura.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kiumu.accura.DebugScenario
import app.kiumu.accura.DebugTools
import app.kiumu.accura.R
import app.kiumu.accura.ui.katalog.Abschnitt
import app.kiumu.accura.ui.katalog.Ansicht
import app.kiumu.accura.ui.katalog.KatalogInhalt

/** Verstecktes Debug-Menü: Szenario der Fake-Daten wählen, darunter der Bausteinkatalog. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DebugScreen(tools: DebugTools, modifier: Modifier = Modifier) {
    val current by tools.scenario.collectAsStateWithLifecycle()
    Ansicht(banner = {}, modifier = modifier) {
        Abschnitt(stringResource(R.string.debug_scenario))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DebugScenario.entries.forEach { scenario ->
                FilterChip(
                    selected = scenario == current,
                    onClick = { tools.select(scenario) },
                    label = { Text(stringResource(scenario.label())) },
                )
            }
        }
        KatalogInhalt()
    }
}

private fun DebugScenario.label(): Int = when (this) {
    DebugScenario.STANDARD -> R.string.debug_standard
    DebugScenario.LEER -> R.string.debug_leer
    DebugScenario.NEGATIV -> R.string.debug_negativ
    DebugScenario.VERALTET -> R.string.debug_veraltet
    DebugScenario.OFFLINE_KOPIE -> R.string.debug_offline
    DebugScenario.LADEN -> R.string.debug_laden
    DebugScenario.FEHLER -> R.string.debug_fehler
}
