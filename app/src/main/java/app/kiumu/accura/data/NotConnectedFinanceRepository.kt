package app.kiumu.accura.data

import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.UpcomingModel
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * Datenquelle des Release-Builds, bis der Convex-Client angeschlossen ist. Sie zeigt ehrlich
 * „nicht verbunden“ und erfindet nichts. Testdaten gibt es nur im Debug-Build.
 */
object NotConnectedFinanceRepository : FinanceRepository {
    private fun <T> notConnected(): Flow<ViewState<T>> = flowOf(ViewState.Error(ErrorKind.NOT_CONNECTED))

    override fun overview(today: LocalDate): Flow<ViewState<OverviewModel>> = notConnected()
    override fun budget(today: LocalDate): Flow<ViewState<BudgetModel>> = notConnected()
    override fun debts(today: LocalDate): Flow<ViewState<DebtsModel>> = notConnected()
    override fun upcoming(today: LocalDate): Flow<ViewState<UpcomingModel>> = notConnected()
}
