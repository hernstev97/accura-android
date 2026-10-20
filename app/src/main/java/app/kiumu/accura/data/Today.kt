package app.kiumu.accura.data

import java.time.Clock
import java.time.Duration
import java.time.LocalDate
import java.time.ZonedDateTime
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Der heutige Kalendertag in der Zeitzone der Uhr, und wieder neu, sobald er wechselt. Das Backend
 * bekommt den Tag als Argument und fragt neu, wenn er sich ändert (Convex speichert Abfragen zwischen).
 */
fun Clock.todayFlow(): Flow<LocalDate> = flow {
    while (true) {
        val now = ZonedDateTime.now(this@todayFlow)
        emit(now.toLocalDate())
        val nextMidnight = now.toLocalDate().plusDays(1).atStartOfDay(now.zone)
        delay(Duration.between(now, nextMidnight).toMillis() + 1_000)
    }
}
