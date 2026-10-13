package app.kiumu.accura.ui.format

import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Test

class FormattersTest {
    private val nbsp = " "
    private val minus = "−"

    @Test
    fun `Cent mit Tausenderpunkt, Komma, geschütztem Leerzeichen und Euro-Zeichen`() {
        assertEquals("0,00${nbsp}€", formatCents(0))
        assertEquals("0,01${nbsp}€", formatCents(1))
        assertEquals("1,05${nbsp}€", formatCents(105))
        assertEquals("1.482,60${nbsp}€", formatCents(148_260))
        assertEquals("1.234.567,89${nbsp}€", formatCents(123_456_789))
        assertEquals("100,00${nbsp}€", formatCents(10_000))
    }

    @Test
    fun `Negative Beträge mit Minuszeichen, nie auf null geschönt`() {
        assertEquals("${minus}398,34${nbsp}€", formatCents(-39_834))
        assertEquals("${minus}0,01${nbsp}€", formatCents(-1))
        assertEquals("${minus}3.983,46${nbsp}€", formatCents(-398_346))
    }

    @Test
    fun `Sehr große Beträge laufen nicht über`() {
        assertEquals("92.233.720.368.547.758,07${nbsp}€", formatCents(Long.MAX_VALUE))
    }

    @Test
    fun `Vorzeichen für Rechenwege`() {
        assertEquals("+120,00${nbsp}€", formatSignedCents(12_000))
        assertEquals("${minus}1,00${nbsp}€", formatSignedCents(-100))
        assertEquals("0,00${nbsp}€", formatSignedCents(0))
    }

    @Test
    fun `Basispunkte als Prozent`() {
        assertEquals("5${nbsp}%", formatBps(500))
        assertEquals("5,12${nbsp}%", formatBps(512))
        assertEquals("5,1${nbsp}%", formatBps(510))
        assertEquals("0${nbsp}%", formatBps(0))
        assertEquals("72${nbsp}%", formatWholePercent(7167))
        assertEquals("5${nbsp}%", formatWholePercent(479))
    }

    @Test
    fun `Monate mal 100 werden abgeschnitten, nicht aufgerundet`() {
        assertEquals("0,5", formatMonthsX100(56))
        assertEquals("5,6", formatMonthsX100(560))
        assertEquals("5,6", formatMonthsX100(569))
        assertEquals("12,0", formatMonthsX100(1200))
    }

    @Test
    fun `Datum kurz, mit Jahr nur wenn es nicht das aktuelle ist, und Monat mit Jahr`() {
        val today = LocalDate.of(2026, 8, 8)
        assertEquals("12. Okt.", formatDay(LocalDate.of(2026, 10, 12), today))
        assertEquals("20. Dez. 2029", formatDay(LocalDate.of(2029, 12, 20), today))
        assertEquals("Dezember 2029", formatMonth(YearMonth.of(2029, 12)))
    }
}
