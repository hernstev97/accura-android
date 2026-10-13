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
        assertEquals("72${nbsp}%", formatWholePercent(7166))
        assertEquals("72${nbsp}%", formatWholePercent(7150))
        assertEquals("71${nbsp}%", formatWholePercent(7149))
        assertEquals("5${nbsp}%", formatWholePercent(479))
    }

    @Test
    fun `Monate mal 100 werden abgeschnitten, nicht aufgerundet`() {
        assertEquals("0,5", formatMonthsX100(56))
        assertEquals("5,6", formatMonthsX100(560))
        assertEquals("5,6", formatMonthsX100(569))
        assertEquals("12,0", formatMonthsX100(1200))
        // Negativ (Konten im Minus): Vorzeichen vorn, nicht hinter dem Komma („0,-1“ war falsch).
        assertEquals("${minus}0,1", formatMonthsX100(-11))
        assertEquals("${minus}5,6", formatMonthsX100(-569))
        assertEquals("0,0", formatMonthsX100(-5))
    }

    @Test
    fun `Datum kurz, mit Jahr nur wenn es nicht das aktuelle ist, und Monat mit Jahr`() {
        val today = LocalDate.of(2026, 8, 8)
        assertEquals("12. Okt.", formatDay(LocalDate.of(2026, 10, 12), today))
        assertEquals("20. Dez. 2029", formatDay(LocalDate.of(2029, 12, 20), today))
        assertEquals("Dezember 2029", formatMonth(YearMonth.of(2029, 12)))
        assertEquals("Okt. 2026", formatMonthShort(YearMonth.of(2026, 10)))
        assertEquals("Jan. 2030", formatMonthShort(YearMonth.of(2030, 1)))
    }

    @Test
    fun `Achsengrenze ist der nächste runde Euro-Betrag, nur für Diagrammachsen`() {
        assertEquals(0L, achsenGrenze(0))
        assertEquals(0L, achsenGrenze(-500))
        // Ein Cent reicht für einen ganzen Euro, damit die Linie nie über die Achse ragt.
        assertEquals(100L, achsenGrenze(1))
        assertEquals(60_000L, achsenGrenze(55_000))
        assertEquals(30_000L, achsenGrenze(26_355))
        assertEquals(100_000L, achsenGrenze(100_000))
        assertEquals(150_000L, achsenGrenze(100_001))
        assertEquals(1_000_000L, achsenGrenze(894_500))
        assertEquals(150_000L, achsenGrenze(123_645))
    }

    @Test
    fun `Ganze Prozent vom Backend, negativ mit Minuszeichen`() {
        assertEquals("72${nbsp}%", formatPercent(72))
        assertEquals("0${nbsp}%", formatPercent(0))
        assertEquals("${minus}90${nbsp}%", formatPercent(-90))
    }

    @Test
    fun `Achsenbeschriftung in ganzen Euro`() {
        assertEquals("10.000${nbsp}€", formatAchse(1_000_000))
        assertEquals("0${nbsp}€", formatAchse(0))
        assertEquals("${minus}1.500${nbsp}€", formatAchse(-150_000))
    }

    @Test
    fun `Betragsfeld liest Ziffern und ein Komma, wie im Klick-Dummy`() {
        assertEquals(BetragEingabe.Gueltig(148_260), parseBetrag("1.482,60"))
        assertEquals(BetragEingabe.Gueltig(148_260), parseBetrag("1482,6"))
        assertEquals(BetragEingabe.Gueltig(148_200), parseBetrag("1482"))
        assertEquals(BetragEingabe.Gueltig(148_200), parseBetrag("1.482"))
        assertEquals(BetragEingabe.Gueltig(1_250), parseBetrag("12.5"))
        assertEquals(BetragEingabe.Gueltig(5), parseBetrag("0,05"))
        assertEquals(BetragEingabe.Gueltig(50), parseBetrag(",5"))
        assertEquals(BetragEingabe.Gueltig(148_260), parseBetrag(" 1.482,60 € "))
        assertEquals(BetragEingabe.Leer, parseBetrag("  "))
    }

    @Test
    fun `Betragsfeld rät nicht und rundet nicht`() {
        assertEquals(BetragEingabe.Ungueltig, parseBetrag("12,345"))
        assertEquals(BetragEingabe.Ungueltig, parseBetrag("1,2,3"))
        assertEquals(BetragEingabe.Ungueltig, parseBetrag("14.82,60"))
        assertEquals(BetragEingabe.Ungueltig, parseBetrag("12a"))
        assertEquals(BetragEingabe.Ungueltig, parseBetrag("99999999999999"))
    }

    @Test
    fun `Im Minus und Minuszeichen machen den Betrag negativ`() {
        assertEquals(BetragEingabe.Gueltig(-39_834), parseBetrag("398,34", minus = true))
        assertEquals(BetragEingabe.Gueltig(-39_834), parseBetrag("-398,34"))
        assertEquals(BetragEingabe.Gueltig(-39_834), parseBetrag("−398,34"))
        assertEquals(BetragEingabe.Gueltig(0), parseBetrag("0", minus = true))
    }
}
