package app.kiumu.accura.data.model

import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * Kalendertag als "JJJJ-MM-TT", wie ihn das Backend liefert. Keine Uhrzeit, keine Zeitzone.
 * Die Modelldateien binden die Serializer mit `@file:UseSerializers` ein.
 */
typealias CalendarDay = LocalDate

/** Kalendermonat als "JJJJ-MM". */
typealias CalendarMonth = YearMonth

/** Ein ungültiges Datum ist ein Lesefehler der Antwort ([SerializationException]), kein Absturz. */
private inline fun <T> parseOrFail(what: String, parse: () -> T): T =
    try {
        parse()
    } catch (_: DateTimeParseException) {
        throw SerializationException("Ungültiger $what in der Antwort")
    }

object CalendarDaySerializer : KSerializer<LocalDate> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("CalendarDay", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): LocalDate = parseOrFail("Kalendertag") { LocalDate.parse(decoder.decodeString()) }
    override fun serialize(encoder: Encoder, value: LocalDate) = encoder.encodeString(value.toString())
}

object CalendarMonthSerializer : KSerializer<YearMonth> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("CalendarMonth", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): YearMonth = parseOrFail("Kalendermonat") { YearMonth.parse(decoder.decodeString()) }
    override fun serialize(encoder: Encoder, value: YearMonth) = encoder.encodeString(value.toString())
}
