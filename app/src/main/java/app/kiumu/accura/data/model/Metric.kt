@file:UseSerializers(CalendarDaySerializer::class, CalendarMonthSerializer::class)

package app.kiumu.accura.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers

/**
 * Die Modelle in diesem Paket spiegeln die Antworten der Convex-Abfragen (`convex/lib/views.ts`,
 * `convex/lib/metric.ts`). Alle Ganzzahlen sind int64 und kommen als ganze Zahl; Geld ist immer
 * `Long` in Cent. Die App rechnet damit nichts nach, sie zeigt nur an.
 */

/** cents = Cent, bps = Basispunkte, monthsX100 = Monate mal 100, days = Tage, count = Anzahl, day = Kalendertag (in `Metric.day`). */
@Serializable
enum class MetricUnit {
    @SerialName("cents") CENTS,
    @SerialName("bps") BPS,
    @SerialName("monthsX100") MONTHS_X100,
    @SerialName("days") DAYS,
    @SerialName("count") COUNT,
    @SerialName("day") DAY,
}

/** actual = eingetragen, planned = geplant, estimated = geschätzt, calculated = berechnet. */
@Serializable
enum class MetricKind {
    @SerialName("actual") ACTUAL,
    @SerialName("planned") PLANNED,
    @SerialName("estimated") ESTIMATED,
    @SerialName("calculated") CALCULATED,
}

/** ok = belastbar, stale = beruht auf alten Daten, unavailable = mangels Daten nicht berechenbar. */
@Serializable
enum class MetricStatus {
    @SerialName("ok") OK,
    @SerialName("stale") STALE,
    @SerialName("unavailable") UNAVAILABLE,
}

@Serializable
enum class StepOp {
    @SerialName("start") START,
    @SerialName("plus") PLUS,
    @SerialName("minus") MINUS,
    @SerialName("result") RESULT,
    @SerialName("note") NOTE,
}

/** Eine Zeile des Rechenwegs („So gerechnet“). Höchstens eines der Wertfelder ist gesetzt. */
@Serializable
data class Step(
    val op: StepOp,
    /** Deutscher Text aus dem Backend: feste Formulierung oder Name eines Postens. */
    val label: String,
    val cents: Long? = null,
    val bps: Int? = null,
    val count: Int? = null,
    val day: CalendarDay? = null,
)

/** Kennzahl als Paket: Wert, Rechenweg, Alter der ältesten verwendeten Daten und Status. */
@Serializable
data class Metric(
    val key: String,
    val unit: MetricUnit,
    val kind: MetricKind,
    /** Wert in der Einheit `unit`; `null`, wenn nicht berechenbar oder `unit` = day. */
    val value: Long? = null,
    val day: CalendarDay? = null,
    val status: MetricStatus,
    /** Warum der Wert fehlt oder mit Vorsicht zu lesen ist (deutscher Text aus dem Backend). */
    val reason: String? = null,
    val dataAgeDays: Int? = null,
    val oldestDataDay: CalendarDay? = null,
    val steps: List<Step> = emptyList(),
)

/** Stand eines Kontos oder Pockets. `stale` entscheidet das Backend (ab 7 Tagen). */
@Serializable
data class Stand(
    val day: CalendarDay,
    val cents: Long,
    val recordedDay: CalendarDay? = null,
    val ageDays: Int,
    val stale: Boolean,
)
