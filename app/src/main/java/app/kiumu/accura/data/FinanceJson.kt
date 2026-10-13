package app.kiumu.accura.data

import kotlinx.serialization.json.Json

object FinanceJson {
    /**
     * Im Betrieb dürfen neue Felder im Backend die App nicht brechen. Der Vertragstest liest dieselben
     * Antworten dagegen streng (`ignoreUnknownKeys = false`) und meldet jedes Feld, das die App nicht kennt.
     */
    val lenient: Json = Json { ignoreUnknownKeys = true }
}
