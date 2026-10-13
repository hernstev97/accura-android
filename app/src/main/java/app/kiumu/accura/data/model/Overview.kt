@file:UseSerializers(CalendarDaySerializer::class, CalendarMonthSerializer::class)

package app.kiumu.accura.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers

@Serializable
enum class AccountKind {
    @SerialName("bank") BANK,
    @SerialName("wallet") WALLET,
    @SerialName("cash") CASH,
}

@Serializable
data class AccountView(val id: String, val name: String, val kind: AccountKind, val stand: Stand? = null)

@Serializable
data class PocketView(val id: String, val accountId: String, val name: String, val stand: Stand? = null)

@Serializable
enum class IncomePartKey {
    @SerialName("expenses") EXPENSES,
    @SerialName("rates") RATES,
    @SerialName("reserves") RESERVES,
    @SerialName("free") FREE,
}

@Serializable
data class IncomePart(val key: IncomePartKey, val cents: Long, val shareBps: Int? = null)

@Serializable
data class IncomeSplit(val incomeCents: Long, val parts: List<IncomePart>)

@Serializable
data class ReliefEvent(
    val debtId: String,
    val lender: String,
    val lastPaymentDay: CalendarDay,
    val monthlyReliefCents: Long,
)

@Serializable
data class NextRelief(
    val freeFromMonth: CalendarMonth,
    val monthlyReliefCents: Long,
    /** Frei im Monat nach dieser Entlastung; `null`, wenn der Spielraum heute nicht berechenbar ist. */
    val freeAfterCents: Long? = null,
    val events: List<ReliefEvent>,
)

@Serializable
enum class DataAgeKind {
    @SerialName("account") ACCOUNT,
    @SerialName("pocket") POCKET,
    @SerialName("debt") DEBT,
}

@Serializable
data class DataAgeItem(
    val kind: DataAgeKind,
    val id: String,
    val name: String,
    val day: CalendarDay,
    val ageDays: Int,
    val stale: Boolean,
)

@Serializable
data class DataAge(
    val oldestDay: CalendarDay? = null,
    val oldestAgeDays: Int? = null,
    val staleCount: Int,
    val items: List<DataAgeItem>,
)

/** Antwort von `views:overview`. */
@Serializable
data class OverviewModel(
    val today: CalendarDay,
    /** Es ist noch gar nichts erfasst. */
    val isEmpty: Boolean,
    val accounts: List<AccountView>,
    val pockets: List<PocketView>,
    val accountsTotal: Metric,
    /** Pockets sind eine zweite Sicht auf dasselbe Geld und werden nie zu den Konten addiert. */
    val pocketsTotal: Metric,
    val availableUntilSalary: Metric,
    val dailyAllowance: Metric,
    val freeMonthly: Metric,
    val bufferMonths: Metric,
    val netWorth: Metric,
    val debtRemaining: Metric,
    val debtFreeDay: Metric,
    val incomeSplit: IncomeSplit? = null,
    val nextRelief: NextRelief? = null,
    val dataAge: DataAge,
)
