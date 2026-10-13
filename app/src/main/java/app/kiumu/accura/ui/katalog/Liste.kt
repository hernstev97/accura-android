package app.kiumu.accura.ui.katalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

/**
 * Listenzeile: Titel, Zusatz, Betrag rechts. Bei sehr großer Schrift steht der Betrag unter dem Titel,
 * damit weder Betrag noch Name abgeschnitten werden.
 */
@Composable
fun ListenZeile(
    title: String,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    amountCents: Long? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val stacked = LocalDensity.current.fontScale >= 1.5f
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 48.dp).padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        if (stacked) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyLarge)
                supporting?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                amountCents?.let { Betrag(it, style = MaterialTheme.typography.bodyLarge) }
                trailing?.invoke()
            }
        } else {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyLarge)
                supporting?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                trailing?.invoke()
            }
            amountCents?.let { Betrag(it, style = MaterialTheme.typography.bodyLarge) }
        }
    }
}
