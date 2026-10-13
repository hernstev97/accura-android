package app.kiumu.accura.data.fake

import app.kiumu.accura.DebugScenario
import app.kiumu.accura.data.ErrorKind
import app.kiumu.accura.data.FinanceJson
import app.kiumu.accura.data.FinanceRepository
import app.kiumu.accura.data.ViewState
import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.UpcomingModel
import app.kiumu.accura.data.toViewState
import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.transformLatest
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException

/**
 * Fake-Datenquelle mit ausgedachten Testdaten. Die JSON-Dateien sind Antworten der echten
 * Convex-Abfragen (siehe `docs/app/datenschicht.md`), `readJson` liest
 * `"<ansicht>-<szenario>"` ohne Endung. Das heutige Datum ignoriert sie: Die Testdaten gelten für
 * den 8. August 2026.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class FakeFinanceRepository(
    private val scenario: StateFlow<DebugScenario>,
    private val readJson: (name: String) -> String,
    private val fetchedAt: Instant = Instant.parse("2026-08-07T18:30:00Z"),
) : FinanceRepository {

    override fun overview(today: LocalDate) = view("overview", OverviewModel.serializer()) { it.toViewState() }
    override fun budget(today: LocalDate) = view("budget", BudgetModel.serializer()) { it.toViewState() }
    override fun debts(today: LocalDate) = view("debts", DebtsModel.serializer()) { it.toViewState() }
    override fun upcoming(today: LocalDate) = view("upcoming", UpcomingModel.serializer()) { it.toViewState() }

    private fun <T> view(
        name: String,
        serializer: DeserializationStrategy<T>,
        toState: (T) -> ViewState<T>,
    ): Flow<ViewState<T>> = scenario.transformLatest { current ->
        when (current) {
            DebugScenario.LADEN -> emit(ViewState.Loading)
            DebugScenario.FEHLER -> emit(ViewState.Error(ErrorKind.SERVER))
            DebugScenario.OFFLINE_KOPIE ->
                emit(read(name, "standard", serializer)?.let { ViewState.Stale(it, fetchedAt, ErrorKind.OFFLINE) } ?: unreadable())
            else -> emit(read(name, current.fileSuffix(), serializer)?.let(toState) ?: unreadable())
        }
    }

    private fun <T> read(name: String, suffix: String, serializer: DeserializationStrategy<T>): T? = try {
        FinanceJson.lenient.decodeFromString(serializer, readJson("$name-$suffix"))
    } catch (_: SerializationException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }

    private fun <T> unreadable(): ViewState<T> = ViewState.Error(ErrorKind.UNREADABLE)

    private fun DebugScenario.fileSuffix(): String = when (this) {
        DebugScenario.LEER -> "leer"
        DebugScenario.NEGATIV -> "negativ"
        DebugScenario.VERALTET -> "veraltet"
        DebugScenario.OHNE_GEHALTSTAG -> "ohne-gehaltstag"
        else -> "standard"
    }
}
