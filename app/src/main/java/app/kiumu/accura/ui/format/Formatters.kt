package app.kiumu.accura.ui.format

import app.kiumu.accura.data.model.Metric
import app.kiumu.accura.data.model.MetricUnit
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

/**
 * Nur Anzeigeformate, keine Fachlogik. Zahlen werden aus ganzen Zahlen zusammengesetzt, nie über
 * Kommazahlen. Format fest Deutsch, unabhängig von der Gerätesprache: `1.482,60 €` mit geschütztem
 * Leerzeichen vor dem Euro-Zeichen (das Zeichen steht nie allein in der Zeile) und Minuszeichen.
 */
private const val NBSP = ' '
private const val MINUS = '−'

private fun groupThousands(value: Long): String {
    val digits = abs(value).toString()
    val out = StringBuilder()
    digits.forEachIndexed { index, char ->
        if (index > 0 && (digits.length - index) % 3 == 0) out.append('.')
        out.append(char)
    }
    return out.toString()
}

/** `Long.MIN_VALUE` kommt in Geldbeträgen nicht vor; `abs` ist hier sicher. */
fun formatCents(cents: Long): String {
    val sign = if (cents < 0) "$MINUS" else ""
    val absolute = abs(cents)
    return "$sign${groupThousands(absolute / 100)},${(absolute % 100).toString().padStart(2, '0')}$NBSP€"
}

/** Mit Vorzeichen für Rechenwege, zum Beispiel `+120,00 €`. Null bekommt keins. */
fun formatSignedCents(cents: Long): String = if (cents > 0) "+${formatCents(cents)}" else formatCents(cents)

/** Basispunkte als Prozent mit zwei Nachkommastellen nur, wenn nötig: 512 → `5,12 %`, 500 → `5 %`. */
fun formatBps(bps: Int): String {
    val sign = if (bps < 0) "$MINUS" else ""
    val absolute = abs(bps)
    val whole = absolute / 100
    val fraction = absolute % 100
    val number = when {
        fraction == 0 -> "$whole"
        fraction % 10 == 0 -> "$whole,${fraction / 10}"
        else -> "$whole,${fraction.toString().padStart(2, '0')}"
    }
    return "$sign$number$NBSP%"
}

/** Ganze Prozent aus Basispunkten, für Anteile: 7167 → `72 %`. */
fun formatWholePercent(bps: Int): String = "${(bps + 50) / 100}$NBSP%"

/** Monate mal 100 → `5,6`, abgeschnitten (nicht gerundet) auf eine Nachkommastelle. Das Wort „Monate“ setzt die Oberfläche. */
fun formatMonthsX100(value: Long): String {
    val tenths = value / 10
    return "${tenths / 10},${tenths % 10}"
}

private val dayShort = DateTimeFormatter.ofPattern("d. MMM", Locale.GERMAN)
private val dayLong = DateTimeFormatter.ofPattern("d. MMM yyyy", Locale.GERMAN)
private val monthYear = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.GERMAN)

/** `12. Okt.`, mit Jahr, wenn es nicht das von `reference` ist. */
fun formatDay(day: LocalDate, reference: LocalDate? = null): String =
    if (reference == null || day.year == reference.year) dayShort.format(day) else dayLong.format(day)

fun formatMonth(month: YearMonth): String = monthYear.format(month)

/** Zahl einer Kennzahl nach Einheit, ohne Einheitswort für Tage und Monate. `null`, wenn kein Wert da ist. */
fun formatMetricNumber(metric: Metric): String? = when (metric.unit) {
    MetricUnit.CENTS -> metric.value?.let(::formatCents)
    MetricUnit.BPS -> metric.value?.let { formatBps(it.toInt()) }
    MetricUnit.MONTHS_X100 -> metric.value?.let(::formatMonthsX100)
    MetricUnit.DAYS, MetricUnit.COUNT -> metric.value?.let { groupThousands(it) }
    MetricUnit.DAY -> metric.day?.let { monthYear.format(it) }
}
