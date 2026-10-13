package app.kiumu.accura.ui.katalog

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

// Pfade aus den Material Symbols (Apache 2.0); der Kern-Satz der Compose-Icons hat sie nicht.
private fun icon(name: String, pathData: String): ImageVector =
    ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
        .addPath(PathParser().parsePathString(pathData).toNodes(), fill = SolidColor(Color.Black))
        .build()

/** Uhr: markiert einen alten Stand. */
val ClockIcon: ImageVector = icon(
    "Clock",
    "M11.99,2C6.47,2 2,6.48 2,12s4.47,10 9.99,10C17.52,22 22,17.52 22,12S17.52,2 11.99,2zM12,20c-4.42,0 -8,-3.58 -8,-8s3.58,-8 8,-8 8,3.58 8,8 -3.58,8 -8,8zM12.5,7H11v6l5.25,3.15 0.75,-1.23 -4.5,-2.67z",
)

/** Fallende Linie: Weg auf null. */
val TrendingDownIcon: ImageVector = icon(
    "TrendingDown",
    "M16,18l2.29,-2.29 -4.88,-4.88 -4,4L2,7.41 3.41,6l6,6 4,-4 6.3,6.29L22,12v6z",
)

/** Strich: Wert fehlt, nicht berechenbar. */
val DashIcon: ImageVector = icon("Dash", "M19,13H5v-2h14v2z")

/** Glühbirne: Einspar-Hinweis. */
val LightbulbIcon: ImageVector = icon(
    "Lightbulb",
    "M9,21c0,0.55 0.45,1 1,1h4c0.55,0 1,-0.45 1,-1v-1L9,20v1zM12,2C8.14,2 5,5.14 5,9c0,2.38 1.19,4.47 3,5.74L8,17c0,0.55 0.45,1 1,1h6c0.55,0 1,-0.45 1,-1v-2.26c1.81,-1.27 3,-3.36 3,-5.74 0,-3.86 -3.14,-7 -7,-7zM14.85,13.1l-0.85,0.6L14,16h-4v-2.3l-0.85,-0.6C7.8,12.16 7,10.63 7,9c0,-2.76 2.24,-5 5,-5s5,2.24 5,5c0,1.63 -0.8,3.16 -2.15,4.1z",
)

/** Steigende Linie: Geld wird frei. */
val TrendingUpIcon: ImageVector = icon(
    "TrendingUp",
    "M16,6l2.29,2.29 -4.88,4.88 -4,-4L2,16.59 3.41,18l6,-6 4,4 6.3,-6.29L22,12V6z",
)

/** Fahne: Ziel erreicht (schuldenfrei). */
val FlagIcon: ImageVector = icon("Flag", "M14.4,6L14,4H5v17h2v-7h5.6l0.4,2h7V6z")

/** Wechselpfeile: Testdaten wechseln (nur Debug-Build). */
val SwapIcon: ImageVector = icon(
    "Swap",
    "M6.99,11L3,15l3.99,4v-3H14v-2H6.99v-3zM21,9l-3.99,-4v3H10v2h7.01v3L21,9z",
)
