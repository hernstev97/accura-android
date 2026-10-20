@file:UseSerializers(CalendarDaySerializer::class, CalendarMonthSerializer::class)

package app.kiumu.accura.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers

@Serializable
enum class BudgetStatus {
    @SerialName("empty") EMPTY,
    @SerialName("income_missing") INCOME_MISSING,
    @SerialName("within_budget") WITHIN_BUDGET,
    @SerialName("overdrawn") OVERDRAWN,
}

/** Stufen von „existenziell“ bis „unnötig“, in dieser Reihenfolge. */
@Serializable
enum class Necessity {
    @SerialName("essential") ESSENTIAL,
    @SerialName("necessary") NECESSARY,
    @SerialName("worthwhile") WORTHWHILE,
    @SerialName("optional") OPTIONAL,
    @SerialName("unnecessary") UNNECESSARY,
}

@Serializable
enum class BudgetKind {
    @SerialName("expense") EXPENSE,
    @SerialName("reserve") RESERVE,
}

@Serializable
data class BudgetLine(
    val id: String,
    val label: String,
    val kind: BudgetKind,
    val category: String,
    val monthlyAmountCents: Long,
    val dueDay: Int? = null,
)

@Serializable
data class NecessityGroup(
    val necessity: Necessity,
    val totalCents: Long,
    val shareBps: Int? = null,
    val items: List<BudgetLine>,
)

@Serializable
data class CategoryShare(val category: String, val totalCents: Long, val shareBps: Int? = null)

@Serializable
data class RateLine(val debtId: String, val lender: String, val monthlyPaymentCents: Long)

/** Antwort von `views:budget`. */
@Serializable
data class BudgetModel(
    val today: CalendarDay,
    val status: BudgetStatus,
    val incomeCents: Long? = null,
    /** Ausgaben plus Rücklagen plus Raten. */
    val plannedCents: Long,
    val expensesCents: Long,
    val reservesCents: Long,
    val ratesCents: Long,
    val freeMonthly: Metric,
    /** Fehlbetrag, nur wenn überplant. */
    val deficitCents: Long? = null,
    /** Geplantes in Prozent des Einkommens, in Basispunkten. */
    val utilizationBps: Int? = null,
    val necessityGroups: List<NecessityGroup>,
    val categories: List<CategoryShare>,
    val rates: List<RateLine>,
)
