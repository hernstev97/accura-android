package app.kiumu.accura

import android.content.Context
import app.kiumu.accura.auth.AuthGateway
import app.kiumu.accura.data.FinanceRepository
import java.time.Clock
import java.time.ZoneId
import kotlinx.coroutines.flow.StateFlow

/** Stevens Zeitzone. Der heutige Kalendertag wird immer hier bestimmt und dem Backend mitgegeben. */
val StevenZone: ZoneId = ZoneId.of("Europe/Berlin")

/** Szenarien der Fake-Datenquelle für den Debug-Build. */
enum class DebugScenario { STANDARD, LEER, NEGATIV, VERALTET, OFFLINE_KOPIE, LADEN, FEHLER }

/** Schalter, die es nur im Debug-Build gibt. */
interface DebugTools {
    val scenario: StateFlow<DebugScenario>
    fun select(scenario: DebugScenario)
}

/**
 * Von Hand verdrahtete Abhängigkeiten (keine DI-Bibliothek in v1). Welche Implementierungen
 * dahinterstehen, entscheidet `createAppGraph` je Build-Typ: Debug nutzt Fake-Daten mit anonymen
 * Testdaten, Release ist ohne Backend „nicht verbunden“ und zeigt nie erfundene Zahlen.
 */
class AppGraph(
    val auth: AuthGateway,
    val finance: FinanceRepository,
    val clock: Clock = Clock.system(StevenZone),
    val debugTools: DebugTools? = null,
)

