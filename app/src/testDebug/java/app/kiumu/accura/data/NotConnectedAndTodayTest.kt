package app.kiumu.accura.data

import java.time.LocalDate
import java.time.ZoneId
import java.time.Clock
import java.time.Instant
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class NotConnectedAndTodayTest {
    @Test
    fun `Der Release-Build erfindet keine Zahlen`() = runTest {
        val today = LocalDate.of(2026, 8, 8)
        assertEquals(ViewState.Error(ErrorKind.NOT_CONNECTED), NotConnectedFinanceRepository.overview(today).first())
        assertEquals(ViewState.Error(ErrorKind.NOT_CONNECTED), NotConnectedFinanceRepository.upcoming(today).first())
    }

    @Test
    fun `Der Tag kommt aus der Zeitzone der Uhr`() = runTest {
        // 22:30 UTC am 7. August ist in Berlin schon der 8. August
        val clock = Clock.fixed(Instant.parse("2026-08-07T22:30:00Z"), ZoneId.of("Europe/Berlin"))
        assertEquals(listOf(LocalDate.of(2026, 8, 8)), clock.todayFlow().take(1).toList())
        val utc = Clock.fixed(Instant.parse("2026-08-07T22:30:00Z"), ZoneId.of("UTC"))
        assertEquals(listOf(LocalDate.of(2026, 8, 7)), utc.todayFlow().take(1).toList())
    }
}
