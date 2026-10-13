package app.kiumu.accura.ui.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.ui.graphics.vector.ImageVector
import app.kiumu.accura.R
import app.kiumu.accura.ui.katalog.TrendingDownIcon

/** Die vier Ansichten, in der Reihenfolge der Navigationsleiste. */
enum class Destination(val route: String, @StringRes val label: Int, val icon: ImageVector) {
    Overview("uebersicht", R.string.nav_overview, Icons.Default.Home),
    Upcoming("demnaechst", R.string.nav_upcoming, Icons.Default.DateRange),
    Budget("budget", R.string.nav_budget, Icons.AutoMirrored.Filled.List),
    Debts("schulden", R.string.nav_debts, TrendingDownIcon),
}

/** Nur im Debug-Build erreichbar: Szenarien der Fake-Daten und Bausteinkatalog. */
const val DebugRoute = "entwicklung"
