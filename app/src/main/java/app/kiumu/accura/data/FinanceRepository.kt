package app.kiumu.accura.data

import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.UpcomingModel
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

/**
 * Die einzige Stelle, an der die App Finanzdaten bekommt. Hinter dieser Schnittstelle sitzt später
 * der Convex-Client mit dem Clerk-Token; der Rest der App kennt weder Client noch Token.
 *
 * Jede Abfrage bekommt den heutigen Kalendertag in Stevens Zeitzone, weil Convex Abfragen
 * zwischenspeichert und der Server keine Uhr benutzt. Der Fluss liefert fortlaufend den aktuellen
 * Zustand (Convex-Abfragen sind Live-Abfragen). Er schließt nie mit einer Ausnahme ab, Fehler sind
 * [ViewState.Error].
 */
interface FinanceRepository {
    fun overview(today: LocalDate): Flow<ViewState<OverviewModel>>
    fun budget(today: LocalDate): Flow<ViewState<BudgetModel>>
    fun debts(today: LocalDate): Flow<ViewState<DebtsModel>>
    fun upcoming(today: LocalDate): Flow<ViewState<UpcomingModel>>
}
