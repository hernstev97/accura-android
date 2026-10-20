package app.kiumu.accura.data

import app.kiumu.accura.data.model.BudgetModel
import app.kiumu.accura.data.model.BudgetStatus
import app.kiumu.accura.data.model.DebtsModel
import app.kiumu.accura.data.model.OverviewModel
import app.kiumu.accura.data.model.UpcomingModel
import java.time.Instant

/** Warum keine frischen Daten da sind. Enthält nie Beträge, Namen oder Tokens. */
enum class ErrorKind {
    /** Keine Verbindung zum Server. */
    OFFLINE,

    /** Der Server hat die Anfrage abgelehnt oder ist ausgefallen. */
    SERVER,

    /** Die Antwort passt nicht zu den Modellen der App (Vertragsbruch zwischen Backend und App). */
    UNREADABLE,

    /** Die Datenquelle ist in diesem Build noch nicht angeschlossen. */
    NOT_CONNECTED,
}

/** Zustand einer Ansicht. Die Oberfläche behandelt jeden Fall mit erschöpfendem `when`. */
sealed interface ViewState<out T> {
    /** Die erste Antwort steht noch aus. */
    data object Loading : ViewState<Nothing>

    /** Es ist noch nichts erfasst. */
    data object Empty : ViewState<Nothing>

    data class Error(val kind: ErrorKind) : ViewState<Nothing>

    data class Data<T>(val model: T) : ViewState<T>

    /** Letzter bekannter Stand, weil frische Daten fehlen (zum Beispiel ohne Netz). */
    data class Stale<T>(val model: T, val fetchedAt: Instant, val reason: ErrorKind) : ViewState<T>
}

/**
 * Wann das Backend „noch nichts erfasst“ meldet. Die Entscheidung liegt im Modell
 * (`isEmpty`, Status `empty`, keine Kredite); die App leitet sie nicht selbst her.
 */
fun OverviewModel.toViewState(): ViewState<OverviewModel> = if (isEmpty) ViewState.Empty else ViewState.Data(this)

fun BudgetModel.toViewState(): ViewState<BudgetModel> =
    if (status == BudgetStatus.EMPTY) ViewState.Empty else ViewState.Data(this)

fun DebtsModel.toViewState(): ViewState<DebtsModel> = if (debts.isEmpty()) ViewState.Empty else ViewState.Data(this)

/** „Demnächst“ ist nie leer im Sinne von „nichts erfasst“: Ein fehlender Gehaltstag steht im Modell. */
fun UpcomingModel.toViewState(): ViewState<UpcomingModel> = ViewState.Data(this)
