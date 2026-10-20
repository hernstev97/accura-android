package app.kiumu.accura.data

/** Liest ein Vertragsbeispiel (Antwort einer Convex-Abfrage) aus den Testressourcen. */
object Vertrag {
    fun read(name: String): String {
        val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("vertrag/$name.json")) { "Fehlt: vertrag/$name.json" }
        return stream.bufferedReader().use { it.readText() }
    }

    val views = listOf("overview", "budget", "debts", "upcoming")
    val scenarios = listOf("standard", "leer", "negativ", "veraltet", "ohne-gehaltstag")
}
