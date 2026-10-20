package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.kiumu.accura.R
import app.kiumu.accura.StevenZone
import app.kiumu.accura.data.ErrorKind
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.ui.theme.Raster
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val fetchedFormat = DateTimeFormatter.ofPattern("d. MMM, HH:mm", Locale.GERMAN)

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun Laden(modifier: Modifier = Modifier) {
    val label = stringResource(R.string.state_loading)
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        LoadingIndicator(modifier = Modifier.semantics { contentDescription = label })
    }
}

@Composable
fun Fehler(kind: ErrorKind, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val text = stringResource(
        when (kind) {
            ErrorKind.OFFLINE -> R.string.error_offline
            ErrorKind.SERVER -> R.string.error_server
            ErrorKind.UNREADABLE -> R.string.error_unreadable
            ErrorKind.NOT_CONNECTED -> R.string.error_not_connected
        },
    )
    Column(
        modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Leerzustand(title = stringResource(R.string.error_title), text = text)
        if (kind != ErrorKind.NOT_CONNECTED) {
            Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.state_retry)) }
        }
    }
}

/** Hinweis über einer Ansicht, die nur den letzten bekannten Stand zeigt. */
@Composable
fun VeraltetHinweis(fetchedAt: Instant, modifier: Modifier = Modifier, zone: ZoneId = StevenZone) {
    HinweisKarte(
        title = stringResource(R.string.stale_title),
        text = stringResource(R.string.stale_text, fetchedFormat.format(fetchedAt.atZone(zone))),
        modifier = modifier,
    )
}

/**
 * Behandelt jeden [ViewState] einheitlich. Ansichten liefern nur den Inhalt für Daten; Leer, Laden,
 * Fehler und veraltet sehen überall gleich aus.
 */
@Composable
fun <T> ViewStateHost(
    state: ViewState<T>,
    onRetry: () -> Unit,
    empty: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable (model: T, banner: @Composable () -> Unit) -> Unit,
) {
    Box(modifier = modifier.fillMaxSize()) {
        when (state) {
            ViewState.Loading -> Laden()
            ViewState.Empty -> Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            ) { empty() }
            is ViewState.Error -> Fehler(state.kind, onRetry)
            is ViewState.Data -> content(state.model) {}
            is ViewState.Stale -> content(state.model) { VeraltetHinweis(state.fetchedAt) }
        }
    }
}

/**
 * Gemeinsamer Rahmen der Ansichten: scrollbar, Seitenrand und Lücken aus dem [Raster], optional der
 * Hinweis „veraltet“ oben.
 */
@Composable
fun Ansicht(
    banner: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(start = Raster.Rand, end = Raster.Rand, top = Raster.Rand, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(Raster.Luecke),
    ) {
        banner()
        content()
    }
}
