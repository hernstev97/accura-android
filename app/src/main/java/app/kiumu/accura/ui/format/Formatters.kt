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

/** Ganze Prozent, wie das Backend sie liefert: 72 → `72 %`. Die App rundet nicht selbst. */
fun formatPercent(percent: Int): String = "$percent$NBSP%"

/** Ganze Prozent aus Basispunkten, für einzeln gerundete Anteile: 7166 → `72 %`, 7150 → `72 %`. */
fun formatWholePercent(bps: Int): String = "${(bps + 50) / 100}$NBSP%"

/**
 * Monate mal 100 → `5,6`, abgeschnitten (nicht gerundet) auf eine Nachkommastelle, negativ mit
 * Minuszeichen (`−0,1`). Das Wort „Monate“ setzt die Oberfläche.
 */
fun formatMonthsX100(value: Long): String {
    val tenths = kotlin.math.abs(value) / 10
    val sign = if (value < 0 && tenths > 0) "−" else ""
    return "$sign${tenths / 10},${tenths % 10}"
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

/** Was das Betragsfeld aus einer Eingabe liest. */
sealed interface BetragEingabe {
    data object Leer : BetragEingabe
    data class Gueltig(val cents: Long) : BetragEingabe
    data object Ungueltig : BetragEingabe
}

private val thousandsGrouped = Regex("""^\d{1,3}(\.\d{3})+$""")
private val dotDecimal = Regex("""^(\d+)\.(\d{1,2})$""")
private val digits = Regex("""^\d{1,13}$""")
private val fraction = Regex("""^\d{0,2}$""")

/**
 * Liest einen Betrag in Euro, wie man ihn tippt: Ziffern und ein Komma, Tausenderpunkte erlaubt
 * (`1.482,60`, `1482,6`, `0,05`, `1482`). Ein Punkt mit ein oder zwei Ziffern dahinter gilt als Komma
 * (`12.5`). Mehr als zwei Nachkommastellen, Buchstaben oder zwei Kommas sind ungültig, es wird nichts
 * gerundet oder geraten. Ein Minus am Anfang oder [minus] („Im Minus“) macht den Betrag negativ.
 * Dieselben Regeln wie im Klick-Dummy (`parseEUR`).
 */
fun parseBetrag(text: String, minus: Boolean = false): BetragEingabe {
    var t = text.trim().replace(" ", "").replace(NBSP.toString(), "").replace("€", "")
    var negative = minus
    if (t.startsWith("-") || t.startsWith("−")) {
        negative = true
        t = t.substring(1)
    }
    if (t.isEmpty()) return BetragEingabe.Leer
    var whole: String
    var frac = ""
    when {
        ',' in t -> {
            val parts = t.split(',')
            if (parts.size != 2) return BetragEingabe.Ungueltig
            whole = parts[0]
            frac = parts[1]
            if ('.' in whole) {
                if (!thousandsGrouped.matches(whole)) return BetragEingabe.Ungueltig
                whole = whole.replace(".", "")
            }
        }
        '.' in t -> {
            if (thousandsGrouped.matches(t)) {
                whole = t.replace(".", "")
            } else {
                val match = dotDecimal.matchEntire(t) ?: return BetragEingabe.Ungueltig
                whole = match.groupValues[1]
                frac = match.groupValues[2]
            }
        }
        else -> whole = t
    }
    if (whole.isEmpty()) whole = "0"
    if (!digits.matches(whole) || !fraction.matches(frac)) return BetragEingabe.Ungueltig
    val cents = whole.toLong() * 100 + frac.padEnd(2, '0').toLong()
    return BetragEingabe.Gueltig(if (negative) -cents else cents)
}
