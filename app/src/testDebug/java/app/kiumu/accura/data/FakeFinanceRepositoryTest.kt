package app.kiumu.accura.data

import app.kiumu.accura.DebugScenario
import app.kiumu.accura.data.fake.FakeFinanceRepository
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeFinanceRepositoryTest {
    private val today = LocalDate.of(2026, 8, 8)
    private val scenario = MutableStateFlow(DebugScenario.STANDARD)
    private val repository = FakeFinanceRepository(scenario, readJson = Vertrag::read)

    @Test
    fun `Standard liefert Daten`() = runTest {
        val state = repository.upcoming(today).first()
        assertTrue(state is ViewState.Data)
        assertEquals(90_430L, (state as ViewState.Data).model.availableUntilSalary.value)
    }

    @Test
    fun `Leer wird je Ansicht nach den Angaben des Modells zu Leer`() = runTest {
        scenario.value = DebugScenario.LEER
        assertEquals(ViewState.Empty, repository.overview(today).first())
        assertEquals(ViewState.Empty, repository.budget(today).first())
        assertEquals(ViewState.Empty, repository.debts(today).first())
        // Demnächst ist nie leer, ein fehlender Gehaltstag steht im Modell
        assertTrue(repository.upcoming(today).first() is ViewState.Data)
    }

    @Test
    fun `Negativ und alte Stände sind Daten, keine Fehler`() = runTest {
        scenario.value = DebugScenario.NEGATIV
        assertTrue(repository.budget(today).first() is ViewState.Data)
        scenario.value = DebugScenario.VERALTET
        assertTrue(repository.overview(today).first() is ViewState.Data)
    }

    @Test
    fun `Offline-Kopie ist veraltet mit Grund und Zeitpunkt`() = runTest {
        scenario.value = DebugScenario.OFFLINE_KOPIE
        val state = repository.overview(today).first() as ViewState.Stale
        assertEquals(ErrorKind.OFFLINE, state.reason)
        assertEquals(135_075L, state.model.accountsTotal.value)
    }

    @Test
    fun `Laden und Fehler`() = runTest {
        scenario.value = DebugScenario.LADEN
        assertEquals(ViewState.Loading, repository.overview(today).first())
        scenario.value = DebugScenario.FEHLER
        assertEquals(ViewState.Error(ErrorKind.SERVER), repository.overview(today).first())
    }

    @Test
    fun `Eine Antwort, die nicht zu den Modellen passt, wird ein Fehler ohne Inhalt`() = runTest {
        val broken = FakeFinanceRepository(scenario, readJson = { """{"today": "kein Datum"}""" })
        assertEquals(ViewState.Error(ErrorKind.UNREADABLE), broken.overview(today).first())
    }

    @Test
    fun `Szenariowechsel kommt im laufenden Fluss an`() = runTest {
        val flow = repository.overview(today)
        assertTrue(flow.first() is ViewState.Data)
        scenario.value = DebugScenario.LEER
        assertEquals(ViewState.Empty, flow.first())
    }
}
